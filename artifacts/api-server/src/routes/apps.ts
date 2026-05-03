import { Router } from "express";
import { eq, sql } from "drizzle-orm";
import { db, appsTable, deploymentsTable } from "@workspace/db";
import { CreateAppBody } from "@workspace/api-zod";

const router = Router();

function parseGithubUrl(repoUrl: string): { owner: string; repo: string } | null {
  try {
    const url = new URL(repoUrl);
    if (url.hostname !== "github.com") return null;
    const parts = url.pathname.replace(/^\//, "").replace(/\.git$/, "").split("/");
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1] };
  } catch {
    return null;
  }
}

router.get("/apps", async (req, res) => {
  const apps = await db.select().from(appsTable).orderBy(sql`${appsTable.createdAt} desc`);
  const deploymentCounts = await db
    .select({ appId: deploymentsTable.appId, count: sql<number>`count(*)::int` })
    .from(deploymentsTable)
    .groupBy(deploymentsTable.appId);

  const countMap = new Map(deploymentCounts.map((d) => [d.appId, d.count]));
  const result = apps.map((app) => ({
    ...app,
    deploymentCount: countMap.get(app.id) ?? 0,
  }));
  res.json(result);
});

router.post("/apps", async (req, res) => {
  const parsed = CreateAppBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { repoUrl } = parsed.data;
  const parts = parseGithubUrl(repoUrl);
  if (!parts) {
    res.status(400).json({ error: "Invalid GitHub repository URL" });
    return;
  }

  const rawUrl = `https://raw.githubusercontent.com/${parts.owner}/${parts.repo}/HEAD/app.json`;
  let appJson: Record<string, unknown>;
  try {
    const response = await fetch(rawUrl);
    if (!response.ok) {
      res.status(400).json({ error: "Could not find app.json in the repository" });
      return;
    }
    appJson = await response.json() as Record<string, unknown>;
  } catch {
    res.status(400).json({ error: "Failed to fetch app.json from the repository" });
    return;
  }

  const name = (appJson.name as string) || `${parts.owner}/${parts.repo}`;
  const description = (appJson.description as string) || null;

  try {
    const [app] = await db.insert(appsTable).values({
      name,
      description,
      repoUrl,
      repoOwner: parts.owner,
      repoName: parts.repo,
      appJson,
    }).returning();

    res.status(201).json({ ...app, deploymentCount: 0 });
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === "23505") {
      res.status(400).json({ error: "This repository is already registered" });
    } else {
      throw err;
    }
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
