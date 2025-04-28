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
      <link
        href="https://cdn.jsdelivr.net/npm/flowbite-typography@1.0.5/dist/typography.min.css"
        rel="stylesheet"
      />
      {/* Tailwind CSS */}
      <script src="https://cdn.tailwindcss.com" />
    </head>
    <body class="bg-gray-50 dark:bg-gray-900">
      <div class="container mx-auto px-4 py-4">
        <header class="mb-4">
          <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
            MCP Documentation Server
          </h1>
        </header>

        <main>
          {/* Job Queue Section */}
          <section class="mb-4 p-4 bg-white rounded-lg shadow dark:bg-gray-800 border border-gray-300 dark:border-gray-600">
            <h2 class="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
              Job Queue
            </h2>
            {/* Container for the job list, loaded via HTMX */}
            <div id="jobQueue" hx-get="/api/jobs" hx-trigger="load, every 1s">
              {/* Initial loading state */}
              <div class="animate-pulse">
                <div class="h-4 bg-gray-200 rounded-full dark:bg-gray-700 w-48 mb-4" />
                <div class="h-4 bg-gray-200 rounded-full dark:bg-gray-700 w-full mb-2.5" />
                <div class="h-4 bg-gray-200 rounded-full dark:bg-gray-700 w-full mb-2.5" />
              </div>
            </div>
          </section>
          {/* Add New Job Section */}
          <section class="mb-8">
            {/* Container for the add job form, loaded via HTMX */}
            <div id="addJobForm" hx-get="/api/jobs/new" hx-trigger="load">
              {/* Initial loading state (optional, could just be empty) */}
              <div class="p-6 bg-white rounded-lg shadow dark:bg-gray-800 animate-pulse">
                <div class="h-6 bg-gray-200 rounded-full dark:bg-gray-700 w-1/3 mb-4" />
                <div class="h-4 bg-gray-200 rounded-full dark:bg-gray-700 w-full mb-2.5" />
                <div class="h-4 bg-gray-200 rounded-full dark:bg-gray-700 w-full mb-2.5" />
              </div>
            </div>
          </section>
          {/* Indexed Documentation Section */}
          <div>
            {" "}
            {/* Use a simple div instead of section with card styling */}
            <h2 class="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
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
          </div>{" "}
          {/* Close the simple div */}
        </main>
      </div>

      {/* HTMX */}
      <script src="https://unpkg.com/htmx.org@2.0.4" />
      {/* AlpineJS (defer recommended) */}
      <script
        defer
        src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"
      ></script>
      {/* Flowbite JavaScript */}
      <script src="https://cdn.jsdelivr.net/npm/flowbite@3.1.2/dist/flowbite.min.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/flowbite-typography@1.0.5/src/index.min.js"></script>
      {/* Global Flowbite Initializer */}
      <script>
        {`
          // Initial load initialization
          initFlowbite();
        `}
      </script>
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
