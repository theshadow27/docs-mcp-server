#!/usr/bin/env node
import "dotenv/config";
import { logger } from "./utils/logger";
import { startWebServer } from "./web/web";

startWebServer().catch((error) => {
  logger.error(`❌ Fatal Error: ${error}`);
  process.exit(1);
});
