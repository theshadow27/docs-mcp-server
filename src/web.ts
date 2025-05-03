#!/usr/bin/env node
import "dotenv/config";
import { program } from "commander";
import type { FastifyInstance } from "fastify";
import { DEFAULT_WEB_PORT } from "./utils/config";
import { logger } from "./utils/logger";
import { startWebServer, stopWebServer } from "./web/web";

program
  .option(
    "--port <number>",
    "Port to listen on for the web interface",
    `${DEFAULT_WEB_PORT}`,
  )
  .parse(process.argv);

const options = program.opts();

let currentServer: FastifyInstance | null = null;

async function main() {
  try {
    // Prioritize environment variable, then CLI arg, then default
    const port = process.env.WEB_PORT
      ? Number.parseInt(process.env.WEB_PORT, 10)
      : Number.parseInt(options.port, 10);

    currentServer = await startWebServer(port);
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
