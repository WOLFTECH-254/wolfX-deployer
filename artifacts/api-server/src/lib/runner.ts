import { spawn, type ChildProcess } from "child_process";
import { mkdir, rm, readFile, stat } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import os from "os";
import { eq, and, inArray, sql } from "drizzle-orm";
import {
  db,
  deploymentsTable,
  serversTable,
  appsTable,
  deploymentLogsTable,
  platformConfigTable,
} from "@workspace/db";
import { logger } from "./logger";

const ROOT = process.env.WABOT_RUNTIME_DIR || path.join(os.tmpdir(), "wabotdeploy");
const CACHE_DIR = path.join(ROOT, "cache");
const DEPLOY_DIR = path.join(ROOT, "deployments");
const MAX_CONCURRENT = Math.max(1, Number(process.env.MAX_CONCURRENT_BOTS ?? 6) || 6);
const LOG_FLUSH_MS = 500;
const LOG_LINE_CAP = 4096;
const PER_DEPLOY_LOG_CAP = 10_000;

interface RunningBot {
  proc: ChildProcess;
  deploymentId: number;
  startedAt: number;
  buffer: Array<{ level: "info" | "warn" | "error"; message: string }>;
  flushTimer: NodeJS.Timeout | null;
}

const RUNNING = new Map<number, RunningBot>();

export function runtimePaths() {
  return { ROOT, CACHE_DIR, DEPLOY_DIR, MAX_CONCURRENT };
}

export function runningCount(): number {
  return RUNNING.size;
}

export function isRunning(deploymentId: number): boolean {
  return RUNNING.has(deploymentId);
}

async function appendLog(
  deploymentId: number,
  level: "info" | "warn" | "error",
  message: string,
): Promise<void> {
  const trimmed = message.length > LOG_LINE_CAP ? message.slice(0, LOG_LINE_CAP) + "…[truncated]" : message;
  await db.insert(deploymentLogsTable).values({ deploymentId, level, message: trimmed });
}

function scheduleFlush(bot: RunningBot) {
  if (bot.flushTimer) return;
  bot.flushTimer = setTimeout(() => {
    bot.flushTimer = null;
    void flushBuffer(bot);
  }, LOG_FLUSH_MS);
}

async function flushBuffer(bot: RunningBot) {
  if (bot.buffer.length === 0) return;
  const batch = bot.buffer.splice(0, bot.buffer.length).map((e) => ({
    deploymentId: bot.deploymentId,
    level: e.level,
    message: e.message,
  }));
  try {
    await db.insert(deploymentLogsTable).values(batch);
    await trimLogs(bot.deploymentId);
  } catch (err) {
    logger.error({ err, deploymentId: bot.deploymentId }, "Failed to flush bot logs");
  }
}

async function trimLogs(deploymentId: number) {
  // Keep only the most recent PER_DEPLOY_LOG_CAP rows for this deployment.
  await db.execute(sql`
    DELETE FROM deployment_logs
    WHERE deployment_id = ${deploymentId}
      AND id NOT IN (
        SELECT id FROM deployment_logs
        WHERE deployment_id = ${deploymentId}
        ORDER BY id DESC
        LIMIT ${PER_DEPLOY_LOG_CAP}
      )
  `);
}

function bufferLine(bot: RunningBot, level: "info" | "warn" | "error", line: string) {
  if (!line.trim()) return;
  const truncated = line.length > LOG_LINE_CAP ? line.slice(0, LOG_LINE_CAP) + "…[truncated]" : line;
  bot.buffer.push({ level, message: truncated });
  if (bot.buffer.length >= 50) {
    void flushBuffer(bot);
  } else {
    scheduleFlush(bot);
  }
}

async function exec(cmd: string, args: string[], cwd: string, deploymentId: number): Promise<number> {
  await appendLog(deploymentId, "info", `$ ${cmd} ${args.join(" ")}`);
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { cwd, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    const onData = (level: "info" | "error") => (chunk: Buffer) => {
      const lines = chunk.toString("utf8").split(/\r?\n/);
      for (const line of lines) {
        if (line.trim()) {
          const msg = line.length > LOG_LINE_CAP ? line.slice(0, LOG_LINE_CAP) + "…[truncated]" : line;
          void appendLog(deploymentId, level, msg);
        }
      }
    };
    proc.stdout.on("data", onData("info"));
    proc.stderr.on("data", onData("error"));
    proc.on("error", reject);
    proc.on("exit", (code) => resolve(code ?? -1));
  });
}

async function ensureRepo(repoUrl: string, repoOwner: string, repoName: string, deploymentId: number): Promise<string> {
  await mkdir(CACHE_DIR, { recursive: true });
  const cachePath = path.join(CACHE_DIR, `${repoOwner}-${repoName}`);
  if (!existsSync(cachePath)) {
    await appendLog(deploymentId, "info", `Cloning ${repoUrl} into shared cache (first deployment of this bot)`);
    const code = await exec("git", ["clone", "--depth=1", repoUrl, cachePath], CACHE_DIR, deploymentId);
    if (code !== 0) throw new Error(`git clone failed with code ${code}`);
  } else {
    await appendLog(deploymentId, "info", "Updating shared repo cache (git pull)");
    const code = await exec("git", ["-C", cachePath, "pull", "--ff-only"], cachePath, deploymentId);
    if (code !== 0) {
      await appendLog(deploymentId, "warn", "git pull failed; using existing cache snapshot");
    }
  }
  return cachePath;
}

async function provisionDeploymentDir(deploymentId: number, cachePath: string): Promise<string> {
  const dir = path.join(DEPLOY_DIR, String(deploymentId));
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  // Hardlink-copy from the cache so each deployment has its own writable cwd
  // (Baileys and similar libs write auth state into cwd) without paying the
  // disk cost of a full copy. node_modules is included after npm ci runs in
  // the cache.
  const code = await exec("cp", ["-aL", `${cachePath}/.`, dir], cachePath, deploymentId);
  if (code !== 0) throw new Error(`cp failed with code ${code}`);
  return dir;
}

async function ensureInstalled(cachePath: string, deploymentId: number) {
  const nm = path.join(cachePath, "node_modules");
  if (existsSync(nm)) {
    const st = await stat(nm);
    if (st.isDirectory()) return;
  }
  await appendLog(deploymentId, "info", "Installing dependencies in shared cache (npm install). This can take a minute on first run.");
  const cmd = existsSync(path.join(cachePath, "package-lock.json")) ? "ci" : "install";
  const code = await exec("npm", [cmd, "--no-audit", "--no-fund", "--loglevel=error"], cachePath, deploymentId);
  if (code !== 0) throw new Error(`npm ${cmd} failed with code ${code}`);
}

async function detectStartCommand(cwd: string): Promise<{ cmd: string; args: string[] }> {
  // Heroku-style Procfile takes precedence
  const procfilePath = path.join(cwd, "Procfile");
  if (existsSync(procfilePath)) {
    const text = await readFile(procfilePath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^(?:worker|web|bot)\s*:\s*(.+)$/);
      if (m) {
        const parts = m[1].trim().split(/\s+/);
        return { cmd: parts[0], args: parts.slice(1) };
      }
    }
  }
  // package.json scripts.start
  const pkgPath = path.join(cwd, "package.json");
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(await readFile(pkgPath, "utf8")) as { scripts?: Record<string, string>; main?: string };
    if (pkg.scripts?.start) return { cmd: "npm", args: ["start", "--silent"] };
    if (pkg.main) return { cmd: "node", args: [pkg.main] };
  }
  // Last resort
  return { cmd: "node", args: ["index.js"] };
}

export async function startBot(deploymentId: number): Promise<void> {
  if (RUNNING.has(deploymentId)) {
    await appendLog(deploymentId, "warn", "Start requested but bot is already running; ignoring");
    return;
  }
  if (RUNNING.size >= MAX_CONCURRENT) {
    await appendLog(deploymentId, "error",
      `Cannot start: platform is at MAX_CONCURRENT_BOTS (${MAX_CONCURRENT}). ` +
      `Stop another bot first or raise the limit.`);
    await db.update(deploymentsTable).set({ status: "failed", updatedAt: new Date() }).where(eq(deploymentsTable.id, deploymentId));
    return;
  }

  const [dep] = await db.select().from(deploymentsTable).where(eq(deploymentsTable.id, deploymentId));
  if (!dep) return;
  const [app] = await db.select().from(appsTable).where(eq(appsTable.id, dep.appId));
  if (!app) {
    await appendLog(deploymentId, "error", "App not found for deployment");
    return;
  }

  try {
    const cachePath = await ensureRepo(app.repoUrl, app.repoOwner, app.repoName, deploymentId);
    await ensureInstalled(cachePath, deploymentId);
    const dir = await provisionDeploymentDir(deploymentId, cachePath);
    const { cmd, args } = await detectStartCommand(dir);
    await appendLog(deploymentId, "info", `Spawning bot: ${cmd} ${args.join(" ")} (cwd=${dir})`);

    const childEnv: NodeJS.ProcessEnv = {
      ...process.env,
      ...(dep.envConfig as Record<string, string>),
    };
    delete childEnv.PORT; // bots are outbound clients; never let them grab our PORT
    delete childEnv.DATABASE_URL;
    delete childEnv.SESSION_SECRET;
    delete childEnv.ADMIN_PASSWORD;

    const proc = spawn(cmd, args, { cwd: dir, env: childEnv, stdio: ["ignore", "pipe", "pipe"], detached: false });
    const bot: RunningBot = {
      proc,
      deploymentId,
      startedAt: Date.now(),
      buffer: [],
      flushTimer: null,
    };
    RUNNING.set(deploymentId, bot);

    proc.stdout.on("data", (chunk: Buffer) => {
      for (const line of chunk.toString("utf8").split(/\r?\n/)) bufferLine(bot, "info", line);
    });
    proc.stderr.on("data", (chunk: Buffer) => {
      for (const line of chunk.toString("utf8").split(/\r?\n/)) bufferLine(bot, "error", line);
    });
    proc.on("exit", async (code, signal) => {
      RUNNING.delete(deploymentId);
      if (bot.flushTimer) { clearTimeout(bot.flushTimer); bot.flushTimer = null; }
      await flushBuffer(bot);
      const reason = signal ? `signal ${signal}` : `exit code ${code}`;
      const finalStatus = signal === "SIGTERM" || code === 0 ? "stopped" : "failed";
      await appendLog(deploymentId, finalStatus === "failed" ? "error" : "warn", `Bot process exited (${reason})`);
      await db.update(deploymentsTable)
        .set({ status: finalStatus, updatedAt: new Date() })
        .where(eq(deploymentsTable.id, deploymentId));
      logger.info({ deploymentId, code, signal }, "Bot exited");
    });
    proc.on("error", async (err) => {
      RUNNING.delete(deploymentId);
      await appendLog(deploymentId, "error", `Failed to spawn bot process: ${err.message}`);
      await db.update(deploymentsTable).set({ status: "failed", updatedAt: new Date() }).where(eq(deploymentsTable.id, deploymentId));
    });
    await appendLog(deploymentId, "info", `Bot started (pid ${proc.pid})`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await appendLog(deploymentId, "error", `Startup failed: ${msg}`);
    await db.update(deploymentsTable).set({ status: "failed", updatedAt: new Date() }).where(eq(deploymentsTable.id, deploymentId));
  }
}

export async function stopBot(deploymentId: number, opts: { wipeDir?: boolean } = {}): Promise<void> {
  const bot = RUNNING.get(deploymentId);
  if (bot) {
    await appendLog(deploymentId, "info", "Sending SIGTERM to bot process");
    try { bot.proc.kill("SIGTERM"); } catch { /* ignore */ }
    // Hard kill after 5s if it didn't exit
    setTimeout(() => {
      if (RUNNING.has(deploymentId)) {
        try { bot.proc.kill("SIGKILL"); } catch { /* ignore */ }
      }
    }, 5000);
  }
  if (opts.wipeDir) {
    const dir = path.join(DEPLOY_DIR, String(deploymentId));
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function reconcileOnStartup(): Promise<void> {
  // The API server has just (re)started, so any deployment row marked as
  // running/restarting/pending refers to a process that no longer exists.
  // Mark them failed and surface a log so users know to hit Restart.
  const stale = await db
    .select()
    .from(deploymentsTable)
    .where(inArray(deploymentsTable.status, ["running", "restarting", "pending"]));
  if (stale.length === 0) return;
  for (const dep of stale) {
    await appendLog(dep.id, "warn", "Platform restarted; bot process was lost. Hit Restart to relaunch.");
  }
  await db
    .update(deploymentsTable)
    .set({ status: "failed", updatedAt: new Date() })
    .where(inArray(deploymentsTable.status, ["running", "restarting", "pending"]));
  // Free up any slots that were marked occupied with no live process behind them.
  await db
    .update(serversTable)
    .set({ status: "available", currentDeploymentId: null })
    .where(
      and(
        eq(serversTable.status, "occupied"),
        // only auto-free slots whose linked deployment is now in a non-active state
        sql`current_deployment_id IN (SELECT id FROM deployments WHERE status IN ('failed','stopped'))`,
      ),
    );
  logger.warn({ count: stale.length }, "Reconciled stale deployments after restart");
}

export async function shutdownAll(): Promise<void> {
  logger.info({ count: RUNNING.size }, "Shutting down all bot processes");
  for (const [id, bot] of RUNNING) {
    try { bot.proc.kill("SIGTERM"); } catch { /* ignore */ }
    if (bot.flushTimer) { clearTimeout(bot.flushTimer); bot.flushTimer = null; }
    await flushBuffer(bot);
    await appendLog(id, "warn", "Platform shutting down; bot process terminated");
  }
  RUNNING.clear();
}

export async function clearRepoCache(): Promise<void> {
  // Called when admin changes the bot repo URL — wipe cached clones so the
  // new repo is fetched fresh on next deploy.
  await rm(CACHE_DIR, { recursive: true, force: true }).catch(() => undefined);
}

export function getCapacityInfo() {
  return {
    running: RUNNING.size,
    max: MAX_CONCURRENT,
    runningIds: Array.from(RUNNING.keys()),
  };
}
