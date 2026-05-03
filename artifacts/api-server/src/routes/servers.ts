import { Router } from "express";
import { eq, sql } from "drizzle-orm";
import { db, serversTable, deploymentsTable, appsTable } from "@workspace/db";

const router = Router();

async function getServerWithDeployment(server: typeof serversTable.$inferSelect) {
  if (!server.currentDeploymentId) return { ...server, currentDeployment: null };
  const [dep] = await db
    .select()
    .from(deploymentsTable)
    .where(eq(deploymentsTable.id, server.currentDeploymentId));
  if (!dep) return { ...server, currentDeployment: null };

  const [app] = await db.select().from(appsTable).where(eq(appsTable.id, dep.appId));
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(deploymentsTable)
    .where(eq(deploymentsTable.appId, dep.appId));

  return {
    ...server,
    currentDeployment: {
      ...dep,
      app: app ? { ...app, deploymentCount: count ?? 0 } : null,
      server: null,
    },
  };
}

router.get("/servers", async (req, res) => {
  const servers = await db.select().from(serversTable).orderBy(serversTable.slotNumber);
  const result = await Promise.all(servers.map(getServerWithDeployment));
  res.json(result);
});

router.get("/servers/stats", async (req, res) => {
  const servers = await db.select().from(serversTable);
  const total = servers.length;
  const available = servers.filter((s) => s.status === "available").length;
  const occupied = servers.filter((s) => s.status === "occupied").length;
  const maintenance = servers.filter((s) => s.status === "maintenance").length;
  res.json({ total, available, occupied, maintenance });
});

router.get("/servers/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [server] = await db.select().from(serversTable).where(eq(serversTable.id, id));
  if (!server) { res.status(404).json({ error: "Server not found" }); return; }

  res.json(await getServerWithDeployment(server));
});

export default router;
