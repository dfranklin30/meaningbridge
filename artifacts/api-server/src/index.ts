import { createServer } from "http";
import app from "./app";
import { logger } from "./lib/logger";
import { isPhiKeyConfigured } from "./lib/phi";
import { startOutreachScheduler } from "./lib/scheduler";
import { backfillCapabilities } from "./lib/backfillCapabilities";
import { initCommunityRealtime } from "./lib/communityRealtime";

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

// Wrap the Express app in an explicit HTTP server so Socket.IO (community chat)
// can share the same port. The realtime layer mounts under /api/socket.io so the
// shared reverse proxy routes the WebSocket handshake to this service.
const httpServer = createServer(app);
initCommunityRealtime(httpServer);

httpServer.listen(port, (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  void backfillCapabilities();

  startOutreachScheduler();

  if (isPhiKeyConfigured()) {
    logger.info("PHI encryption key configured and valid");
  } else {
    logger.warn(
      "PHI_ENCRYPTION_KEY is not set; professional/PHI endpoints will fail until it is provisioned",
    );
  }
});
