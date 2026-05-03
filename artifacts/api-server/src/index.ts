import app from "./app";
import { logger } from "./lib/logger";
import { initPlatformConfig } from "./lib/platform-init";
import { reconcileOnStartup, shutdownAll } from "./lib/runner";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function main() {
  await initPlatformConfig();
  await reconcileOnStartup();
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });
}

let shuttingDown = false;
async function gracefulShutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Received shutdown signal");
  try {
    await shutdownAll();
  } finally {
    process.exit(0);
  }
}
process.on("SIGTERM", () => void gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => void gracefulShutdown("SIGINT"));

main().catch((err) => {
  logger.error({ err }, "Fatal startup error");
  process.exit(1);
});
