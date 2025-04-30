import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { LogLevel, logger, setLogLevel } from "../utils/logger";
import { createMcpServerInstance } from "./mcpServer";
import type { McpServerTools } from "./tools";

/**
 * Starts the MCP server using the Stdio transport.
 * @param tools The shared tool instances.
 * @returns The created McpServer instance.
 */
export async function startStdioServer(tools: McpServerTools): Promise<McpServer> {
  setLogLevel(LogLevel.ERROR);

  // Create a server instance using the factory and shared tools
  const server = createMcpServerInstance(tools);

  // Start server with Stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("Documentation MCP server running on stdio");

  // Return the server instance
  return server;
}
