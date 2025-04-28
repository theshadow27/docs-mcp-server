#!/usr/bin/env node
import "dotenv/config";
import { program } from "commander";
import { startServer, stopServer } from "./mcp/index.js";
import { DEFAULT_HTTP_PORT, DEFAULT_PROTOCOL } from "./utils/config.js";
import { logger } from "./utils/logger"; // Import logger for HMR hook

program
  .option("--protocol <type>", "Protocol to use (stdio or http)", DEFAULT_PROTOCOL)
  .option(
    "--port <number>",
    "Port to listen on for http protocol",
    `${DEFAULT_HTTP_PORT}`,
  )
  .parse(process.argv);

const options = program.opts();

async function main() {
  const protocol = options.protocol;
  const port = Number.parseInt(options.port, 10);

  if (protocol !== "stdio" && protocol !== "http") {
    console.error('Invalid protocol specified. Use "stdio" or "http".');
    process.exit(1);
  }

  if (protocol === "http" && Number.isNaN(port)) {
    console.error("Port must be a number when using http protocol.");
    process.exit(1);
  }

  try {
    await startServer(protocol, protocol === "http" ? port : undefined);
  } catch (error) {
    console.error(`Server failed to start: ${error}`);
    process.exit(1);
  }
}

// Handle HMR using Vite's API
if (import.meta.hot) {
  import.meta.hot.on("vite:beforeFullReload", async () => {
    logger.info("🔥 Hot reload detected. Shutting down existing MCP server...");
    try {
      await stopServer();
      logger.info("✅ MCP server shut down for hot reload.");
    } catch (error) {
      logger.error(`❌ Error stopping MCP server during HMR: ${error}`);
      // Decide if we should exit or try to continue
    }
  });
}

// Start the application
main();
