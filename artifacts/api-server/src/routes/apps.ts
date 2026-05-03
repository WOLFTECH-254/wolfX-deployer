import { Router } from "express";
import { eq, sql } from "drizzle-orm";
import { db, appsTable, deploymentsTable } from "@workspace/db";
import { CreateAppBody } from "@workspace/api-zod";
import { parseGithubRepoUrl, fetchAppJsonFromGithub, AppJsonFetchError } from "../lib/github";

const router = Router();

router.get("/apps", async (_req, res) => {
  const apps = await db.select().from(appsTable).orderBy(sql`${appsTable.createdAt} desc`);
  const deploymentCounts = await db
    .select({ appId: deploymentsTable.appId, count: sql<number>`count(*)::int` })
    .from(deploymentsTable)
    .groupBy(deploymentsTable.appId);
  const countMap = new Map(deploymentCounts.map((d) => [d.appId, d.count]));
  res.json(apps.map((app) => ({ ...app, deploymentCount: countMap.get(app.id) ?? 0 })));
});

router.post("/apps", async (req, res) => {
  const parsed = CreateAppBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const repo = parseGithubRepoUrl(parsed.data.repoUrl);
  if (!repo) {
    res.status(400).json({ error: "That doesn't look like a GitHub URL. Use https://github.com/owner/repo." });
    return;
  }
  try {
    const { data: appJson } = await fetchAppJsonFromGithub(repo);
    const name = (appJson.name as string) || `${repo.owner}/${repo.name}`;
    const description = (appJson.description as string) || null;
    const [app] = await db.insert(appsTable).values({
      name,
      description,
      repoUrl: repo.url,
      repoOwner: repo.owner,
      repoName: repo.name,
      appJson,
    }).returning();
    res.status(201).json({ ...app, deploymentCount: 0 });
  } catch (err: unknown) {
    if (err instanceof AppJsonFetchError) {
      res.status(err.statusCode === 404 ? 400 : err.statusCode).json({ error: err.message });
      return;
    }
    const e = err as { code?: string };
    if (e.code === "23505") {
      res.status(400).json({ error: "This repository is already registered" });
      return;
    }
    throw err;
  }
});

router.get("/apps/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [app] = await db.select().from(appsTable).where(eq(appsTable.id, id));
  if (!app) { res.status(404).json({ error: "App not found" }); return; }
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(deploymentsTable)
    .where(eq(deploymentsTable.appId, id));
  res.json({ ...app, deploymentCount: count ?? 0 });
});

router.delete("/apps/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [app] = await db.select().from(appsTable).where(eq(appsTable.id, id));
  if (!app) { res.status(404).json({ error: "App not found" }); return; }
  await db.delete(appsTable).where(eq(appsTable.id, id));
  res.json({ success: true, message: "App deleted" });
});

export default router;
