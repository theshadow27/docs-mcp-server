import "dotenv/config";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PipelineManager } from "../pipeline/PipelineManager";
import type { DocumentManagementService } from "../store/DocumentManagementService";
import { LogLevel, logger, setLogLevel } from "../utils/logger";
import { getDocService, getPipelineManager } from "./services";
import { startHttpServer } from "./startHttpServer";
import { startStdioServer } from "./startStdioServer";
import { type McpServerTools, initializeTools } from "./tools";

// Variables to hold server instances for cleanup
let runningServer: McpServer | null = null;
let runningPipelineManager: PipelineManager | null = null;
let runningDocService: DocumentManagementService | null = null;

export async function startServer(protocol: "stdio" | "http", port?: number) {
  try {
    // Shared services should already be initialized
    runningDocService = getDocService(); // Get instance after initialization
    runningPipelineManager = getPipelineManager(); // Get instance after initialization

    // Initialize and get shared tools
    const tools: McpServerTools = await initializeTools(); // initializeTools now gets services internally

    let serverInstance: McpServer;
    if (protocol === "stdio") {
      serverInstance = await startStdioServer(tools); // startStdioServer needs to return McpServer
    } else if (protocol === "http") {
      if (port === undefined) {
        logger.error("❌ HTTP protocol requires a port.");
        process.exit(1);
      }
      serverInstance = await startHttpServer(tools, port); // startHttpServer needs to return McpServer
    } else {
      // This case should be caught by src/server.ts, but handle defensively
      logger.error(`❌ Unknown protocol: ${protocol}`);
      process.exit(1);
    }

    // Capture the running server instance
    runningServer = serverInstance;
  } catch (error) {
    logger.error(`❌ Fatal Error during server startup: ${error}`);
    // Attempt cleanup even if startup failed partially
    await stopServer();
    process.exit(1);
  }
}

/**
 * Stops the MCP server instance gracefully.
 * Shared services (PipelineManager, DocumentManagementService) are shut down
 * separately by the caller (e.g., via shutdownServices() in src/index.ts).
 */
export async function stopServer() {
  logger.debug("Attempting to close MCP Server instance...");
  let hadError = false;
  try {
    if (runningServer) {
      logger.debug("Closing MCP Server instance (McpServer/McpHttpServer)...");
      await runningServer.close();
      logger.debug("MCP Server instance closed.");
    } else {
      logger.debug("MCP Server instance was not running or already null.");
    }
  } catch (e) {
    logger.error(`❌ Error closing MCP Server instance: ${e}`);
    hadError = true;
  }

  // Clear only the server reference; other services are managed by initializeServices/shutdownServices
  runningServer = null;
  // runningPipelineManager and runningDocService references in this module are just pointers
  // to the singletons in services.ts. Their lifecycle is managed there.
  // We can clear them here to be tidy, but their actual shutdown is separate.
  runningPipelineManager = null;
  runningDocService = null;

  if (hadError) {
    logger.warn("⚠️ MCP Server instance close operation completed with errors.");
  } else {
    logger.info("✅ MCP Server instance close operation complete.");
  }
}
