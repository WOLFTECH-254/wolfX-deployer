import { Router } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, deploymentsTable, serversTable, appsTable } from "@workspace/db";
import { CreateDeploymentBody } from "@workspace/api-zod";

const router = Router();

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

function generateMockLogs(dep: typeof deploymentsTable.$inferSelect) {
  const entries = [];
  const base = new Date(dep.createdAt);
  entries.push({ timestamp: new Date(base.getTime() + 0).toISOString(), level: "info", message: "Pulling repository from GitHub..." });
  entries.push({ timestamp: new Date(base.getTime() + 1200).toISOString(), level: "info", message: "Repository cloned successfully" });
  entries.push({ timestamp: new Date(base.getTime() + 2400).toISOString(), level: "info", message: "Installing dependencies..." });
  entries.push({ timestamp: new Date(base.getTime() + 5000).toISOString(), level: "info", message: "Dependencies installed" });
  entries.push({ timestamp: new Date(base.getTime() + 5200).toISOString(), level: "info", message: "Starting bot process..." });
  if (dep.status === "running") {
    entries.push({ timestamp: new Date(base.getTime() + 6000).toISOString(), level: "info", message: "Bot connected to WhatsApp servers" });
    entries.push({ timestamp: new Date(base.getTime() + 6500).toISOString(), level: "info", message: "Listening for messages..." });
  } else if (dep.status === "failed") {
    entries.push({ timestamp: new Date(base.getTime() + 6000).toISOString(), level: "error", message: "Connection refused: check your credentials" });
    entries.push({ timestamp: new Date(base.getTime() + 6100).toISOString(), level: "error", message: "Bot process exited with code 1" });
  } else if (dep.status === "stopped") {
    entries.push({ timestamp: new Date(base.getTime() + 6000).toISOString(), level: "warn", message: "Received SIGTERM signal" });
    entries.push({ timestamp: new Date(base.getTime() + 6200).toISOString(), level: "info", message: "Bot stopped gracefully" });
  }
  return entries;
}

router.get("/deployments", async (req, res) => {
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

  const { appId, serverId, envConfig, deployedBy } = parsed.data;

  const [app] = await db.select().from(appsTable).where(eq(appsTable.id, appId));
  if (!app) { res.status(400).json({ error: "App not found" }); return; }

  let targetServerId = serverId ?? null;

  if (targetServerId) {
    const [server] = await db.select().from(serversTable).where(eq(serversTable.id, targetServerId));
    if (!server) { res.status(400).json({ error: "Server not found" }); return; }
    if (server.status !== "available") { res.status(400).json({ error: "Server slot is not available" }); return; }
  } else {
    const [freeServer] = await db
      .select()
      .from(serversTable)
      .where(eq(serversTable.status, "available"))
      .orderBy(serversTable.slotNumber)
      .limit(1);
    if (!freeServer) { res.status(400).json({ error: "No available server slots" }); return; }
    targetServerId = freeServer.id;
  }

  const [dep] = await db.insert(deploymentsTable).values({
    appId,
    serverId: targetServerId,
    status: "running",
    envConfig: envConfig as Record<string, string>,
    deployedBy: deployedBy ?? null,
  }).returning();

  await db.update(serversTable)
    .set({ status: "occupied", currentDeploymentId: dep.id })
    .where(eq(serversTable.id, targetServerId));

  res.status(201).json(await enrichDeployment(dep));
});

router.get("/deployments/recent", async (req, res) => {
  const deps = await db.select().from(deploymentsTable).orderBy(desc(deploymentsTable.createdAt)).limit(10);
  const result = await Promise.all(deps.map(enrichDeployment));
  res.json(result);
});

router.get("/deployments/summary", async (req, res) => {
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

  await db.delete(deploymentsTable).where(eq(deploymentsTable.id, id));
  await db.update(serversTable)
    .set({ status: "available", currentDeploymentId: null })
    .where(eq(serversTable.id, dep.serverId));

  res.json({ success: true, message: "Deployment deleted" });
});

router.post("/deployments/:id/restart", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [dep] = await db.select().from(deploymentsTable).where(eq(deploymentsTable.id, id));
  if (!dep) { res.status(404).json({ error: "Deployment not found" }); return; }

  const [updated] = await db.update(deploymentsTable)
    .set({ status: "running", updatedAt: new Date() })
    .where(eq(deploymentsTable.id, id))
    .returning();

  res.json(await enrichDeployment(updated));
});

router.post("/deployments/:id/stop", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [dep] = await db.select().from(deploymentsTable).where(eq(deploymentsTable.id, id));
  if (!dep) { res.status(404).json({ error: "Deployment not found" }); return; }

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

  res.json({ deploymentId: id, logs: generateMockLogs(dep) });
});

export default router;
