import "dotenv/config";
import { logger } from "../utils/logger";
import { initializeServices } from "./services";
import { startHttpServer } from "./startHttpServer";
import { startStdioServer } from "./startStdioServer";
import { initializeTools } from "./tools";

export async function startServer(protocol: "stdio" | "http", port?: number) {
  try {
    // Initialize shared services
    await initializeServices();

    // Initialize and get shared tools
    const tools = await initializeTools();

    if (protocol === "stdio") {
      await startStdioServer(tools);
    } else if (protocol === "http") {
      if (port === undefined) {
        logger.error("HTTP protocol requires a port.");
        process.exit(1);
      }
      await startHttpServer(tools, port);
    } else {
      // This case should be caught by src/server.ts, but handle defensively
      logger.error(`Unknown protocol: ${protocol}`);
      process.exit(1);
    }
  } catch (error) {
    logger.error(`❌ Fatal Error: ${error}`);
    // No need to call shutdownServices here, as initializeServices handles cleanup on error
    process.exit(1);
  }
}
