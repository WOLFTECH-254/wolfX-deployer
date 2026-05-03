import { eq, gt, and, lte, isNull } from "drizzle-orm";
import { db, platformConfigTable, serversTable, appsTable } from "@workspace/db";
import { parseGithubRepoUrl, fetchAppJsonFromGithub } from "./github";
import { logger } from "./logger";

const DEFAULT_REPO = "https://github.com/WOLFTECH-254/silentwolf";
const DEFAULT_SLOTS = 30;

interface BotMeta {
  name: string;
  description: string | null;
  logo: string | null;
}

function extractBotMeta(appJson: Record<string, unknown>, fallbackName: string): BotMeta {
  return {
    name: typeof appJson.name === "string" ? appJson.name : fallbackName,
    description: typeof appJson.description === "string" ? appJson.description : null,
    logo: typeof appJson.logo === "string" ? appJson.logo : null,
  };
}

export async function syncSlotCount(slotCount: number) {
  const existing = await db.select().from(serversTable);
  const have = new Set(existing.map((s) => s.slotNumber));
  const inserts: Array<{ slotNumber: number; label: string }> = [];
  for (let n = 1; n <= slotCount; n++) {
    if (!have.has(n)) inserts.push({ slotNumber: n, label: `Slot ${n}` });
  }
  if (inserts.length > 0) {
    await db.insert(serversTable).values(inserts);
  }
  // Mark extras (slot_number > slotCount) as maintenance instead of deleting (preserve deployment history).
  // Only flip *unoccupied* slots so we never silently boot a running session.
  await db
    .update(serversTable)
    .set({ status: "maintenance" })
    .where(and(gt(serversTable.slotNumber, slotCount), isNull(serversTable.currentDeploymentId)));
  // Restore in-range maintenance slots back to "available" when slot count grows again.
  await db
    .update(serversTable)
    .set({ status: "available" })
    .where(
      and(
        lte(serversTable.slotNumber, slotCount),
        eq(serversTable.status, "maintenance"),
        isNull(serversTable.currentDeploymentId),
      ),
    );
}

export async function applyBotConfig(repoUrl: string, slotCount: number) {
  const repo = parseGithubRepoUrl(repoUrl);
  if (!repo) throw new Error(`Invalid GitHub URL: ${repoUrl}`);

  const { data: appJson } = await fetchAppJsonFromGithub(repo);
  const meta = extractBotMeta(appJson, repo.name);

  // Upsert into apps table so existing deployments continue working
  const [existingApp] = await db.select().from(appsTable).where(eq(appsTable.repoUrl, repo.url));
  let appId: number;
  if (existingApp) {
    const [updated] = await db
      .update(appsTable)
      .set({
        name: meta.name,
        description: meta.description,
        repoOwner: repo.owner,
        repoName: repo.name,
        appJson,
        updatedAt: new Date(),
      })
      .where(eq(appsTable.id, existingApp.id))
      .returning();
    appId = updated.id;
  } else {
    const [created] = await db
      .insert(appsTable)
      .values({
        name: meta.name,
        description: meta.description,
        repoUrl: repo.url,
        repoOwner: repo.owner,
        repoName: repo.name,
        appJson,
      })
      .returning();
    appId = created.id;
  }

  const [existingCfg] = await db.select().from(platformConfigTable).where(eq(platformConfigTable.id, 1));
  if (existingCfg) {
    await db
      .update(platformConfigTable)
      .set({
        botRepoUrl: repo.url,
        botRepoOwner: repo.owner,
        botRepoName: repo.name,
        botName: meta.name,
        botDescription: meta.description,
        botLogo: meta.logo,
        botAppJson: appJson,
        slotCount,
        updatedAt: new Date(),
      })
      .where(eq(platformConfigTable.id, 1));
  } else {
    await db.insert(platformConfigTable).values({
      id: 1,
      botRepoUrl: repo.url,
      botRepoOwner: repo.owner,
      botRepoName: repo.name,
      botName: meta.name,
      botDescription: meta.description,
      botLogo: meta.logo,
      botAppJson: appJson,
      slotCount,
    });
  }

  await syncSlotCount(slotCount);
  return { appId, repo, meta, slotCount };
}

export async function initPlatformConfig() {
  const [existing] = await db.select().from(platformConfigTable).where(eq(platformConfigTable.id, 1));
  if (existing) {
    logger.info(
      { bot: existing.botName, slots: existing.slotCount },
      "Platform config already initialized",
    );
    // Still sync slots in case env override changed
    await syncSlotCount(existing.slotCount);
    return;
  }
  const repoUrl = process.env.BOT_REPO_URL ?? DEFAULT_REPO;
  const slotCount = Number(process.env.SLOT_COUNT ?? DEFAULT_SLOTS) || DEFAULT_SLOTS;
  logger.info({ repoUrl, slotCount }, "Initializing platform config");
  try {
    const result = await applyBotConfig(repoUrl, slotCount);
    logger.info(
      { bot: result.meta.name, repo: result.repo.url, slots: slotCount },
      "Platform initialized",
    );
  } catch (e) {
    logger.error(
      { err: (e as Error).message, repoUrl },
      "Failed to initialize platform config from configured bot repo. Admin must set it via /admin.",
    );
  }
}

export function getAdminPassword(): string {
  const env = process.env.ADMIN_PASSWORD?.trim();
  if (env) return env;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "ADMIN_PASSWORD must be set in production. Refusing to use the default 'admin' password.",
    );
  }
  return "admin";
}

export function isAdminPasswordDefault(): boolean {
  return !process.env.ADMIN_PASSWORD?.trim();
}
