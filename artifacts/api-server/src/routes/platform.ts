import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, platformConfigTable, serversTable, deploymentsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { applyBotConfig, getAdminPassword, isAdminPasswordDefault } from "../lib/platform-init";
import { AppJsonFetchError } from "../lib/github";
import { requireAdmin } from "../middlewares/admin";
import { clearRepoCache, getCapacityInfo } from "../lib/runner";
import { z } from "zod/v4";

const router = Router();

router.get("/platform/config", async (_req, res) => {
  const [cfg] = await db.select().from(platformConfigTable).where(eq(platformConfigTable.id, 1));
  if (!cfg) {
    res.status(503).json({ error: "Platform not initialized. Admin must configure a bot repo." });
    return;
  }
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(serversTable);
  const [{ occupied }] = await db
    .select({ occupied: sql<number>`count(*)::int` })
    .from(serversTable)
    .where(eq(serversTable.status, "occupied"));
  res.json({
    botRepoUrl: cfg.botRepoUrl,
    botRepoOwner: cfg.botRepoOwner,
    botRepoName: cfg.botRepoName,
    botName: cfg.botName,
    botDescription: cfg.botDescription,
    botLogo: cfg.botLogo,
    botAppJson: cfg.botAppJson,
    platformSourceUrl: process.env.PLATFORM_SOURCE_URL || null,
    slotCount: cfg.slotCount,
    totalSlots: total,
    occupiedSlots: occupied,
    availableSlots: Math.max(0, cfg.slotCount - occupied),
    updatedAt: cfg.updatedAt,
    adminPasswordIsDefault: isAdminPasswordDefault(),
    capacity: getCapacityInfo(),
  });
});

router.post("/platform/login", async (req, res) => {
  const parsed = z.object({ password: z.string() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "password required" });
    return;
  }
  if (parsed.data.password !== getAdminPassword()) {
    res.status(401).json({ error: "Invalid admin password" });
    return;
  }
  res.json({ success: true, message: "Authenticated" });
});

const updateBody = z.object({
  botRepoUrl: z.string().url().optional(),
  slotCount: z.number().int().min(1).max(500).optional(),
});

router.put("/platform/config", requireAdmin, async (req, res) => {
  const parsed = updateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body. Expected { botRepoUrl?, slotCount? }" });
    return;
  }
  const [current] = await db.select().from(platformConfigTable).where(eq(platformConfigTable.id, 1));
  const repoUrl = parsed.data.botRepoUrl ?? current?.botRepoUrl;
  const slotCount = parsed.data.slotCount ?? current?.slotCount ?? 30;
  if (!repoUrl) {
    res.status(400).json({ error: "botRepoUrl required for first-time setup" });
    return;
  }
  // Block shrinking below currently-occupied slots
  const occupiedRows = await db
    .select({ slot: serversTable.slotNumber })
    .from(serversTable)
    .where(eq(serversTable.status, "occupied"));
  const maxOccupied = occupiedRows.reduce((m, r) => Math.max(m, r.slot), 0);
  if (slotCount < maxOccupied) {
    res.status(400).json({
      error: `Cannot shrink to ${slotCount} slots: slot ${maxOccupied} is currently in use. Stop those deployments first.`,
    });
    return;
  }
  try {
    const repoChanged = !!current && current.botRepoUrl !== repoUrl;
    const result = await applyBotConfig(repoUrl, slotCount);
    if (repoChanged) {
      // Different bot — wipe cached clones so next deploy fetches the new repo.
      await clearRepoCache();
    }
    res.json({
      success: true,
      message: `Bot configured: ${result.meta.name}`,
      botName: result.meta.name,
      slotCount,
    });
  } catch (e) {
    if (e instanceof AppJsonFetchError) {
      res.status(e.statusCode === 404 ? 400 : e.statusCode).json({ error: e.message });
      return;
    }
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get("/platform/active-sessions", async (_req, res) => {
  // Returns hashes/last-4 of active SESSION_IDs so the UI can warn about reuse without leaking secrets.
  const active = await db
    .select({ envConfig: deploymentsTable.envConfig, status: deploymentsTable.status })
    .from(deploymentsTable);
  const fingerprints = active
    .filter((d) => ["pending", "running", "restarting"].includes(d.status))
    .map((d) => {
      const sid = (d.envConfig as Record<string, string>)?.SESSION_ID ?? "";
      return sid ? sid.slice(-6) : null;
    })
    .filter((x): x is string => !!x);
  res.json({ count: fingerprints.length, fingerprints });
});

export default router;
