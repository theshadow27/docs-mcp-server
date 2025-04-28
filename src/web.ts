#!/usr/bin/env node
import "dotenv/config";
import type { FastifyInstance } from "fastify";
import { logger } from "./utils/logger";
import { startWebServer, stopWebServer } from "./web/web";

let currentServer: FastifyInstance | null = null;

async function main() {
  try {
    currentServer = await startWebServer();
  } catch (error) {
    logger.error(`❌ Fatal Error during startup: ${error}`);
    process.exit(1);
  }
}

// Handle HMR using Vite's API
if (import.meta.hot) {
  import.meta.hot.on("vite:beforeFullReload", async () => {
    if (currentServer) {
      logger.info("🔥 Hot reload detected. Shutting down existing web server...");
      try {
        await stopWebServer(currentServer);
      } catch (error) {
        logger.error(`❌ Error stopping server during HMR: ${error}`);
        // Decide if we should exit or try to continue
      } finally {
        currentServer = null; // Ensure reference is cleared
      }
    }
  });
}

// Start the application
main();
