import { randomUUID } from "node:crypto";
import * as http from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { LogLevel, logger, setLogLevel } from "../utils/logger";
import { createMcpServerInstance } from "./serverFactory";
import { shutdownServices } from "./services";
import type { McpServerTools } from "./tools";

/**
 * Starts the MCP server using the Streamable HTTP and SSE transports.
 * @param tools The shared tool instances.
 * @param port The port to listen on.
 */
export async function startHttpServer(
  tools: McpServerTools,
  port: number,
): Promise<void> {
  setLogLevel(LogLevel.INFO);

  const sharedServer = createMcpServerInstance(tools);
  const sseTransports: Record<string, SSEServerTransport> = {};

  const httpServer = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", `http://${req.headers.host}`);

      if (req.method === "GET" && url.pathname === "/sse") {
        // Handle SSE connection
        const transport = new SSEServerTransport("/messages", res);
        sseTransports[transport.sessionId] = transport;

        res.on("close", () => {
          delete sseTransports[transport.sessionId];
          transport.close();
        });

        await sharedServer.connect(transport);
      } else if (req.method === "POST" && url.pathname === "/messages") {
        // Handle SSE messages
        const sessionId = url.searchParams.get("sessionId");
        const transport = sessionId ? sseTransports[sessionId] : undefined;

        if (transport) {
          let body = "";
          for await (const chunk of req) {
            body += chunk;
          }
          const parsedBody = JSON.parse(body);
          await transport.handlePostMessage(req, res, parsedBody);
        } else {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "No transport found for sessionId" }));
        }
      } else {
        // Handle Streamable HTTP (default)
        let body = "";
        for await (const chunk of req) {
          body += chunk;
        }
        const parsedBody = JSON.parse(body);

        const requestTransport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
        });

        res.on("close", () => {
          requestTransport.close();
        });

        await sharedServer.connect(requestTransport);
        await requestTransport.handleRequest(req, res, parsedBody);
      }
    } catch (error) {
      logger.error(`Error handling HTTP request: ${error}`);
      // Send an error response
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  });

  httpServer.listen(port, () => {
    logger.info(`Documentation MCP server running on http://0.0.0.0:${port}`);
  });

  // Handle cleanup for HTTP server
  process.on("SIGINT", async () => {
    logger.info("Shutting down HTTP server...");
    await shutdownServices(); // Shutdown shared services
    sharedServer.close(); // Close the shared MCP server instance
    httpServer.close(() => {
      logger.info("HTTP server closed.");
      process.exit(0);
    });
  });
}
