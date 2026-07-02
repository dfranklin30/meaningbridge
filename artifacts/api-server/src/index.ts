import app from "./app";
import { logger } from "./lib/logger";
import { isPhiKeyConfigured } from "./lib/phi";

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

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  if (isPhiKeyConfigured()) {
    logger.info("PHI encryption key configured and valid");
  } else {
    logger.warn(
      "PHI_ENCRYPTION_KEY is missing or not exactly 32 bytes; professional/PHI endpoints will fail until it is provisioned correctly",
    );
  }
});
