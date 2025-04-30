import "dotenv/config";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PipelineManager } from "../pipeline/PipelineManager";
import type { DocumentManagementService } from "../store/DocumentManagementService";
import { LogLevel, logger, setLogLevel } from "../utils/logger";
import { getDocService, getPipelineManager, initializeServices } from "./services"; // Import get functions
import { startHttpServer } from "./startHttpServer";
import { startStdioServer } from "./startStdioServer";
import { type McpServerTools, initializeTools } from "./tools";

// Variables to hold server instances for cleanup
let runningServer: McpServer | null = null;
let runningPipelineManager: PipelineManager | null = null;
let runningDocService: DocumentManagementService | null = null;

export async function startServer(protocol: "stdio" | "http", port?: number) {
  try {
    // Set the default log level for the server to ERROR
    setLogLevel(LogLevel.ERROR);

    // Initialize shared services
    await initializeServices();
    runningDocService = getDocService(); // Get instance after initialization
    runningPipelineManager = getPipelineManager(); // Get instance after initialization

    // Initialize and get shared tools
    const tools: McpServerTools = await initializeTools(); // initializeTools now gets services internally

    let serverInstance: McpServer;
    if (protocol === "stdio") {
      serverInstance = await startStdioServer(tools); // startStdioServer needs to return McpServer
    } else if (protocol === "http") {
      if (port === undefined) {
        logger.error("HTTP protocol requires a port.");
        process.exit(1);
      }
      serverInstance = await startHttpServer(tools, port); // startHttpServer needs to return McpServer
    } else {
      // This case should be caught by src/server.ts, but handle defensively
      logger.error(`Unknown protocol: ${protocol}`);
      process.exit(1);
    }

    // Capture the running server instance
    runningServer = serverInstance;

    // Handle graceful shutdown on SIGINT
    process.on("SIGINT", async () => {
      logger.info("Received SIGINT. Shutting down gracefully...");
      await stopServer();
      process.exit(0);
    });
  } catch (error) {
    logger.error(`❌ Fatal Error during server startup: ${error}`);
    // Attempt cleanup even if startup failed partially
    await stopServer();
    process.exit(1);
  }
}

/**
 * Stops the MCP server and related services gracefully.
 */
export async function stopServer() {
  logger.info("Shutting down MCP server and services...");
  let hadError = false;
  try {
    if (runningPipelineManager) {
      logger.debug("Stopping Pipeline Manager...");
      await runningPipelineManager.stop();
      logger.info("Pipeline Manager stopped.");
    }
  } catch (e) {
    logger.error(`Error stopping Pipeline Manager: ${e}`);
    hadError = true;
  }
  try {
    if (runningDocService) {
      logger.debug("Shutting down Document Service...");
      await runningDocService.shutdown();
      logger.info("Document Service shut down.");
    }
  } catch (e) {
    logger.error(`Error shutting down Document Service: ${e}`);
    hadError = true;
  }
  try {
    if (runningServer) {
      logger.debug("Closing MCP Server connection...");
      await runningServer.close();
      logger.info("MCP Server connection closed.");
    }
  } catch (e) {
    logger.error(`Error closing MCP Server: ${e}`);
    hadError = true;
  }

  // Clear references
  runningPipelineManager = null;
  runningDocService = null;
  runningServer = null;

  if (hadError) {
    logger.warn("Server shutdown completed with errors.");
  } else {
    logger.info("✅ Server shutdown complete.");
  }
}
