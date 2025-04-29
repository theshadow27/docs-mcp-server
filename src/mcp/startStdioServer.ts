import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { LogLevel, logger, setLogLevel } from "../utils/logger";
import { createMcpServerInstance } from "./mcpServer";
import { shutdownServices } from "./services";
import type { McpServerTools } from "./tools";

/**
 * Starts the MCP server using the Stdio transport.
 * @param tools The shared tool instances.
 */
export async function startStdioServer(tools: McpServerTools): Promise<void> {
  setLogLevel(LogLevel.ERROR);

  // Create a server instance using the factory and shared tools
  const server = createMcpServerInstance(tools);

  // Start server with Stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("Documentation MCP server running on stdio");

  // Remove all existing SIGINT listeners
  process.removeAllListeners("SIGINT");

  // Handle cleanup
  process.on("SIGINT", async () => {
    logger.info("Shutting down Stdio server...");
    await shutdownServices(); // Shutdown shared services
    await server.close();
    logger.info("Stdio server closed.");
    process.exit(0);
  });
}
