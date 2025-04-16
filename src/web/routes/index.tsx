import type { FastifyInstance } from "fastify";

/**
 * Main page layout component.
 */
const IndexPage = () => (
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>MCP Documentation Server</title>
      {/* Flowbite CSS */}
      <link
        href="https://cdn.jsdelivr.net/npm/flowbite@3.1.2/dist/flowbite.min.css"
        rel="stylesheet"
      />
      {/* Tailwind CSS */}
      <script src="https://cdn.tailwindcss.com" />
    </head>
    <body class="bg-gray-50 dark:bg-gray-900">
      <div class="container mx-auto px-4 py-8">
        <header class="mb-8">
          <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
            MCP Documentation Server
          </h1>
        </header>

        <main>
          {/* Job Queue Section */}
          <section class="mb-8 p-6 bg-white rounded-lg shadow dark:bg-gray-800">
            <h2 class="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
              Job Queue
            </h2>
            <div id="jobQueue" hx-get="/api/jobs" hx-trigger="load, every 5s">
              <div class="animate-pulse">
                <div class="h-4 bg-gray-200 rounded-full dark:bg-gray-700 w-48 mb-4" />
                <div class="h-4 bg-gray-200 rounded-full dark:bg-gray-700 w-full mb-2.5" />
                <div class="h-4 bg-gray-200 rounded-full dark:bg-gray-700 w-full mb-2.5" />
              </div>
            </div>
          </section>

          {/* Indexed Documentation Section */}
          <section class="p-6 bg-white rounded-lg shadow dark:bg-gray-800">
            <h2 class="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
              Indexed Documentation
            </h2>
            <div
              id="indexedDocs"
              hx-get="/api/libraries"
              hx-trigger="load, every 10s"
            >
              <div class="animate-pulse">
                <div class="h-4 bg-gray-200 rounded-full dark:bg-gray-700 w-48 mb-4" />
                <div class="h-4 bg-gray-200 rounded-full dark:bg-gray-700 w-full mb-2.5" />
                <div class="h-4 bg-gray-200 rounded-full dark:bg-gray-700 w-full mb-2.5" />
              </div>
            </div>
          </section>
        </main>
      </div>

      {/* HTMX */}
      <script src="https://unpkg.com/htmx.org@2.0.4" />
      {/* Flowbite JavaScript */}
      <script src="https://cdn.jsdelivr.net/npm/flowbite@3.1.2/dist/flowbite.min.js" />
    </body>
  </html>
);

/**
 * Registers the root route that serves the main HTML page.
 * @param server - The Fastify instance.
 */
export function registerIndexRoute(server: FastifyInstance) {
  server.get("/", async (_, reply) => {
    reply.type("text/html");
    return "<!DOCTYPE html>" + <IndexPage />;
  });
}
