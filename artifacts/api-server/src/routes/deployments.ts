import { Router } from "express";
import { createHash } from "crypto";
import { eq, desc, sql, and, inArray } from "drizzle-orm";
import { db, deploymentsTable, serversTable, appsTable, platformConfigTable, deploymentLogsTable } from "@workspace/db";
import type { PgTransaction } from "drizzle-orm/pg-core";
import { CreateDeploymentBody } from "@workspace/api-zod";
import { startBot, stopBot, getCapacityInfo } from "../lib/runner";

const router = Router();

const ACTIVE_STATUSES = ["pending", "running", "restarting"] as const;
// Distinct namespace key for the slot-allocation advisory lock so it cannot
// collide with a SESSION_ID-derived lock key.
const SLOT_LOCK_KEY = -1_234_567_890;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function sessionLockKey(sessionId: string): number {
  // Postgres advisory locks take a bigint; use a stable 31-bit hash so the
  // value comfortably fits a JS number. Trade-off: collisions are rare and
  // only cause temporary serialization, never correctness loss (the in-tx
  // SELECT below is the actual uniqueness gate).
  const h = createHash("sha256").update(sessionId).digest();
  return h.readUInt32BE(0) & 0x7fff_ffff;
}

async function getPlatformAppId(tx: Tx | typeof db = db): Promise<number | null> {
  const [cfg] = await tx.select().from(platformConfigTable).where(eq(platformConfigTable.id, 1));
  if (!cfg) return null;
  const [app] = await tx.select().from(appsTable).where(eq(appsTable.repoUrl, cfg.botRepoUrl));
  return app?.id ?? null;
}

async function findSessionConflict(
  tx: Tx | typeof db,
  sessionId: string,
  excludeDeploymentId?: number,
): Promise<{ id: number; serverId: number } | null> {
  const rows = await tx
    .select({ id: deploymentsTable.id, envConfig: deploymentsTable.envConfig, serverId: deploymentsTable.serverId })
    .from(deploymentsTable)
    .where(inArray(deploymentsTable.status, ACTIVE_STATUSES as unknown as string[]));
  const target = sessionId.trim();
  for (const row of rows) {
    if (excludeDeploymentId && row.id === excludeDeploymentId) continue;
    const sid = (row.envConfig as Record<string, string>)?.SESSION_ID?.trim();
    if (sid && sid === target) return { id: row.id, serverId: row.serverId };
  }
  return null;
}

async function enrichDeployment(dep: typeof deploymentsTable.$inferSelect) {
  const [app] = dep.appId
    ? await db.select().from(appsTable).where(eq(appsTable.id, dep.appId))
    : [null];
  const [server] = dep.serverId
    ? await db.select().from(serversTable).where(eq(serversTable.id, dep.serverId))
    : [null];
  const [{ count }] = dep.appId
    ? await db.select({ count: sql<number>`count(*)::int` }).from(deploymentsTable).where(eq(deploymentsTable.appId, dep.appId))
    : [{ count: 0 }];
  return {
    ...dep,
    app: app ? { ...app, deploymentCount: count ?? 0 } : null,
    server: server ? { ...server, currentDeployment: null } : null,
  };
}

async function appendLog(
  tx: Tx | typeof db,
  deploymentId: number,
  level: "info" | "warn" | "error",
  message: string,
): Promise<void> {
  await tx.insert(deploymentLogsTable).values({ deploymentId, level, message });
}

router.get("/deployments", async (_req, res) => {
  const deps = await db.select().from(deploymentsTable).orderBy(desc(deploymentsTable.createdAt));
  const result = await Promise.all(deps.map(enrichDeployment));
  res.json(result);
});

router.post("/deployments", async (req, res) => {
  const parsed = CreateDeploymentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { serverId, envConfig, deployedBy } = parsed.data;
  let { appId } = parsed.data;

  // If appId not supplied, default to platform's configured bot
  if (!appId) {
    const platformAppId = await getPlatformAppId();
    if (!platformAppId) {
      res.status(503).json({ error: "Platform is not initialized. Admin must configure a bot first." });
      return;
    }
    appId = platformAppId;
  }

  const [app] = await db.select().from(appsTable).where(eq(appsTable.id, appId));
  if (!app) { res.status(400).json({ error: "App not found" }); return; }

  // Validate required env vars from app.json
  const appJson = app.appJson as { env?: Record<string, { required?: boolean }> };
  const requiredEnv = Object.entries(appJson.env ?? {})
    .filter(([, v]) => v?.required)
    .map(([k]) => k);
  for (const key of requiredEnv) {
    if (!envConfig[key] || !envConfig[key].trim()) {
      res.status(400).json({ error: `${key} is required` });
      return;
    }
  }

  const sessionId = envConfig.SESSION_ID?.trim();
  // Concurrency hardening: take advisory locks for the SESSION_ID and the
  // slot pool inside a single transaction. Locks are released at COMMIT.
  type CreateOk = { kind: "ok"; dep: typeof deploymentsTable.$inferSelect };
  type CreateErr = { kind: "err"; status: number; body: Record<string, unknown> };
  const result: CreateOk | CreateErr = await db.transaction(async (tx) => {
    if (sessionId) {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${sessionLockKey(sessionId)})`);
      const conflict = await findSessionConflict(tx, sessionId);
      if (conflict) {
        return {
          kind: "err",
          status: 409,
          body: {
            error: `That SESSION_ID is already running on slot #${conflict.serverId} (deployment #${conflict.id}). Each session can only run in one place at a time — running it twice will get your WhatsApp account disconnected.`,
            conflictDeploymentId: conflict.id,
          },
        };
      }
    }
    // Serialize all slot allocations through a single advisory lock to avoid
    // two concurrent deploys grabbing the same slot.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${SLOT_LOCK_KEY})`);

    let targetServerId: number;
    if (serverId) {
      const [server] = await tx.select().from(serversTable).where(eq(serversTable.id, serverId));
      if (!server) return { kind: "err", status: 400, body: { error: "Server not found" } };
      if (server.status !== "available") {
        return { kind: "err", status: 400, body: { error: "Server slot is not available" } };
      }
      targetServerId = server.id;
    } else {
      const [freeServer] = await tx
        .select()
        .from(serversTable)
        .where(eq(serversTable.status, "available"))
        .orderBy(serversTable.slotNumber)
        .limit(1);
      if (!freeServer) {
        return {
          kind: "err",
          status: 400,
          body: { error: "No available server slots. Ask the admin to increase the slot count." },
        };
      }
      targetServerId = freeServer.id;
    }

    const [dep] = await tx
      .insert(deploymentsTable)
      .values({
        appId,
        serverId: targetServerId,
        status: "running",
        envConfig: envConfig as Record<string, string>,
        deployedBy: deployedBy ?? null,
      })
      .returning();

    await tx
      .update(serversTable)
      .set({ status: "occupied", currentDeploymentId: dep.id })
      .where(eq(serversTable.id, targetServerId));

    await appendLog(tx, dep.id, "info", `Deployment created on slot #${targetServerId} by ${deployedBy ?? "anonymous"}`);

    return { kind: "ok", dep };
  });

  if (result.kind === "err") {
    res.status(result.status).json(result.body);
    return;
  }
  // Fire-and-forget: clone, install, spawn. The runner streams real logs
  // into deployment_logs and updates status to failed/stopped on exit.
  void startBot(result.dep.id);
  res.status(201).json(await enrichDeployment(result.dep));
});

router.get("/deployments/recent", async (_req, res) => {
  const deps = await db.select().from(deploymentsTable).orderBy(desc(deploymentsTable.createdAt)).limit(10);
  const result = await Promise.all(deps.map(enrichDeployment));
  res.json(result);
});

router.get("/deployments/capacity", async (_req, res) => {
  res.json(getCapacityInfo());
});

router.get("/deployments/summary", async (_req, res) => {
  const rows = await db
    .select({ status: deploymentsTable.status, count: sql<number>`count(*)::int` })
    .from(deploymentsTable)
    .groupBy(deploymentsTable.status);
  const map = new Map(rows.map((r) => [r.status, r.count]));
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  res.json({
    running: map.get("running") ?? 0,
    stopped: map.get("stopped") ?? 0,
    pending: map.get("pending") ?? 0,
    failed: map.get("failed") ?? 0,
    total,
  });
});

router.get("/deployments/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [dep] = await db.select().from(deploymentsTable).where(eq(deploymentsTable.id, id));
  if (!dep) { res.status(404).json({ error: "Deployment not found" }); return; }
  res.json(await enrichDeployment(dep));
});

router.delete("/deployments/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [dep] = await db.select().from(deploymentsTable).where(eq(deploymentsTable.id, id));
  if (!dep) { res.status(404).json({ error: "Deployment not found" }); return; }
  // Stop the running process (if any) and wipe its working dir before removing rows.
  await stopBot(id, { wipeDir: true });
  // Cascade-delete logs first so we don't leave orphans (no FK constraint)
  await db.delete(deploymentLogsTable).where(eq(deploymentLogsTable.deploymentId, id));
  await db.delete(deploymentsTable).where(eq(deploymentsTable.id, id));
  await db.update(serversTable)
    .set({ status: "available", currentDeploymentId: null })
    .where(and(eq(serversTable.id, dep.serverId), eq(serversTable.currentDeploymentId, id)));
  res.json({ success: true, message: "Deployment deleted" });
});

router.post("/deployments/:id/restart", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  type RestartOk = { kind: "ok"; dep: typeof deploymentsTable.$inferSelect };
  type RestartErr = { kind: "err"; status: number; body: Record<string, unknown> };
  const result: RestartOk | RestartErr = await db.transaction(async (tx) => {
    const [dep] = await tx.select().from(deploymentsTable).where(eq(deploymentsTable.id, id));
    if (!dep) return { kind: "err", status: 404, body: { error: "Deployment not found" } };
    const sid = (dep.envConfig as Record<string, string>)?.SESSION_ID?.trim();
    if (sid && dep.status !== "running") {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${sessionLockKey(sid)})`);
      const conflict = await findSessionConflict(tx, sid, id);
      if (conflict) {
        return {
          kind: "err",
          status: 409,
          body: { error: `Cannot restart: SESSION_ID is already running on deployment #${conflict.id}.` },
        };
      }
    }
    const [updated] = await tx
      .update(deploymentsTable)
      .set({ status: "running", updatedAt: new Date() })
      .where(eq(deploymentsTable.id, id))
      .returning();
    await appendLog(tx, id, "info", `Deployment restarted (previous status: ${dep.status})`);
    return { kind: "ok", dep: updated };
  });
  if (result.kind === "err") {
    res.status(result.status).json(result.body);
    return;
  }
  // Make sure any leftover process is gone, then spawn a fresh one.
  await stopBot(id);
  void startBot(id);
  res.json(await enrichDeployment(result.dep));
});

router.post("/deployments/:id/stop", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [dep] = await db.select().from(deploymentsTable).where(eq(deploymentsTable.id, id));
  if (!dep) { res.status(404).json({ error: "Deployment not found" }); return; }
  await appendLog(db, id, "warn", "Stop requested by user");
  await stopBot(id);
  // The runner's exit handler will set status to "stopped"; for the immediate
  // response also flip the row so the UI reflects the action right away.
  const [updated] = await db.update(deploymentsTable)
    .set({ status: "stopped", updatedAt: new Date() })
    .where(eq(deploymentsTable.id, id))
    .returning();
  res.json(await enrichDeployment(updated));
});

router.get("/deployments/:id/logs", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [dep] = await db.select().from(deploymentsTable).where(eq(deploymentsTable.id, id));
  if (!dep) { res.status(404).json({ error: "Deployment not found" }); return; }
  const rows = await db
    .select()
    .from(deploymentLogsTable)
    .where(eq(deploymentLogsTable.deploymentId, id))
    .orderBy(deploymentLogsTable.createdAt, deploymentLogsTable.id);
  const logs = rows.map((r) => ({
    timestamp: r.createdAt.toISOString(),
    level: r.level,
    message: r.message,
  }));
  res.json({ deploymentId: id, logs });
});

export default router;
