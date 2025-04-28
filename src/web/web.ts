import path from "node:path";
import formBody from "@fastify/formbody";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyInstance } from "fastify";
import { PipelineManager } from "../pipeline/PipelineManager";
import { DocumentManagementService } from "../store/DocumentManagementService";
import { SearchTool } from "../tools";
import { ListJobsTool } from "../tools/ListJobsTool";
import { ListLibrariesTool } from "../tools/ListLibrariesTool";
import { RemoveTool } from "../tools/RemoveTool";
import { ScrapeTool } from "../tools/ScrapeTool";
import { logger } from "../utils/logger";
import { getProjectRoot } from "../utils/paths";
import { registerIndexRoute } from "./routes/index";
import { registerJobListRoutes } from "./routes/jobs/list";
import { registerNewJobRoutes } from "./routes/jobs/new";
import { registerLibraryDetailRoutes } from "./routes/libraries/detail";
import { registerLibrariesRoutes } from "./routes/libraries/list";

/**
 * Initializes the Fastify web server instance.
 *
 * @returns The initialized Fastify server instance.
 */
export async function startWebServer(): Promise<FastifyInstance> {
  const server = Fastify({
    logger: false, // Use our own logger instead
  });

  // Register plugins
  await server.register(formBody); // Register formbody to parse form data

  // Instantiate services and tools
  const docService = new DocumentManagementService();
  await docService.initialize();
  const pipelineManager = new PipelineManager(docService);
  await pipelineManager.start(); // Start the manager to process jobs enqueued via web
  const listLibrariesTool = new ListLibrariesTool(docService);
  const listJobsTool = new ListJobsTool(pipelineManager);
  const scrapeTool = new ScrapeTool(docService, pipelineManager);
  const removeTool = new RemoveTool(docService);
  const searchTool = new SearchTool(docService);

  // Register static file serving
  await server.register(fastifyStatic, {
    // Use project root to construct absolute path to public directory
    root: path.join(getProjectRoot(), "public"),
    prefix: "/",
    index: false, // Disable automatic index.html serving
  });

  // Register routes
  registerIndexRoute(server); // Register the root route first
  registerJobListRoutes(server, listJobsTool);
  registerNewJobRoutes(server, scrapeTool);
  registerLibrariesRoutes(server, listLibrariesTool, removeTool);
  registerLibraryDetailRoutes(server, listLibrariesTool, searchTool);

  // Graceful shutdown
  server.addHook("onClose", async () => {
    logger.info("Shutting down document service...");
    await docService.shutdown();
    logger.info("Document service shut down.");
  });

  try {
    const address = await server.listen({ port: 3000, host: "0.0.0.0" });
    logger.info(`🚀 Web server listening at ${address}`);
    return server; // Return the server instance
  } catch (error) {
    logger.error(`❌ Failed to start web server: ${error}`);
    // Ensure server is closed if listen fails but initialization succeeded partially
    await server.close();
    throw error;
  }
}

/**
 * Stops the provided Fastify web server instance.
 *
 * @param server - The Fastify server instance to stop.
 */
export async function stopWebServer(server: FastifyInstance): Promise<void> {
  try {
    await server.close();
    logger.info("🛑 Web server stopped.");
  } catch (error) {
    logger.error(`❌ Failed to stop web server gracefully: ${error}`);
    // Rethrow or handle as needed, but ensure the process doesn't hang
    throw error;
  }
}
