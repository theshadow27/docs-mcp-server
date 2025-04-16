import path from "node:path";
import { fileURLToPath } from "node:url";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { logger } from "../utils/logger";
import { registerIndexRoute } from "./routes/index";
import { registerJobsRoutes } from "./routes/jobs";
import { registerLibrariesRoutes } from "./routes/libraries";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Initializes and starts the Fastify web server.
 * Serves static files and API routes on port 3000.
 */
export async function startWebServer() {
  const server = Fastify({
    logger: false, // Use our own logger instead
  });

  // Register static file serving
  await server.register(fastifyStatic, {
    // Path relative to the dist/web.js file after build
    root: path.join(__dirname, "..", "public"),
    prefix: "/",
    index: false, // Disable automatic index.html serving
  });

  // Register routes
  registerIndexRoute(server); // Register the root route first
  registerJobsRoutes(server);
  registerLibrariesRoutes(server);

  try {
    const address = await server.listen({ port: 3000, host: "0.0.0.0" });
    logger.info(`🚀 Web server listening at ${address}`);
  } catch (error) {
    logger.error(`❌ Failed to start web server: ${error}`);
    throw error;
  }
}
