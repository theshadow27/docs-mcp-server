import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ScrapeTool } from "../../../tools/ScrapeTool"; // Adjusted import path
import { ScrapeMode } from "../../../scraper/types"; // Adjusted import path
import { logger } from "../../../utils/logger"; // Adjusted import path

// --- Scrape Form Content Component (The actual form fields) ---
const ScrapeFormContent = () => (
  <div class="mt-8 p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
    <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">
      Queue New Scrape Job
    </h3>
    <form
      hx-post="/api/jobs/scrape"
      hx-target="#job-response"
      hx-swap="innerHTML"
      class="space-y-4"
    >
      <div>
        <label
          for="url"
          class="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          URL
        </label>
        <input
          type="url"
          name="url"
          id="url"
          required
          class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
      </div>
      <div>
        <label
          for="library"
          class="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Library Name
        </label>
        <input
          type="text"
          name="library"
          id="library"
          required
          class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
      </div>
      <div>
        <label
          for="version"
          class="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Version (optional)
        </label>
        <input
          type="text"
          name="version"
          id="version"
          class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
      </div>

      <details class="bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
        <summary class="cursor-pointer text-sm font-medium text-gray-600 dark:text-gray-400">
          Advanced Options
        </summary>
        <div class="mt-4 space-y-4">
          <div>
            <label
              for="maxPages"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Max Pages
            </label>
            <input
              type="number"
              name="maxPages"
              id="maxPages"
              min="1"
              placeholder="1000"
              class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label
              for="maxDepth"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Max Depth
            </label>
            <input
              type="number"
              name="maxDepth"
              id="maxDepth"
              min="0"
              placeholder="3"
              class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label
              for="scope"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Scope
            </label>
            <select
              name="scope"
              id="scope"
              class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="subpages" selected>
                Subpages (Default)
              </option>
              <option value="hostname">Hostname</option>
              <option value="domain">Domain</option>
            </select>
          </div>
          <div>
            <label
              for="scrapeMode"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Scrape Mode
            </label>
            <select
              name="scrapeMode"
              id="scrapeMode"
              class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value={ScrapeMode.Auto} selected>
                Auto (Default)
              </option>
              <option value={ScrapeMode.Fetch}>Fetch</option>
              <option value={ScrapeMode.Playwright}>Playwright</option>
            </select>
          </div>
          <div class="flex items-center">
            <input
              id="followRedirects"
              name="followRedirects"
              type="checkbox"
              checked
              class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
            />
            <label
              for="followRedirects"
              class="ml-2 block text-sm text-gray-900 dark:text-gray-300"
            >
              Follow Redirects
            </label>
          </div>
          <div class="flex items-center">
            <input
              id="ignoreErrors"
              name="ignoreErrors"
              type="checkbox"
              checked
              class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
            />
            <label
              for="ignoreErrors"
              class="ml-2 block text-sm text-gray-900 dark:text-gray-300"
            >
              Ignore Errors During Scraping
            </label>
          </div>
        </div>
      </details>

      <div>
        <button
          type="submit"
          class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Queue Job
        </button>
      </div>
    </form>
    {/* Target div for HTMX response */}
    <div id="job-response" class="mt-4 text-sm"></div>
  </div>
);

// --- Scrape Form Wrapper Component (For initial load and OOB target) ---
const ScrapeForm = () => (
  <div id="scrape-form-container">
    <ScrapeFormContent />
  </div>
);

/**
 * Registers the API routes for creating new jobs.
 * @param server - The Fastify instance.
 * @param scrapeTool - The tool instance for scraping documents.
 */
export function registerNewJobRoutes(
  server: FastifyInstance,
  scrapeTool: ScrapeTool
) {
  // GET /api/jobs/new - Return the form component wrapped in its container
  server.get("/api/jobs/new", async () => {
    // Return the wrapper component which includes the container div
    return <ScrapeForm />;
  });

  // POST /api/jobs/scrape - Queue a new scrape job
  server.post(
    "/api/jobs/scrape",
    async (
      request: FastifyRequest<{
        Body: {
          url: string;
          library: string;
          version?: string;
          maxPages?: string;
          maxDepth?: string;
          scope?: "subpages" | "hostname" | "domain";
          scrapeMode?: ScrapeMode;
          followRedirects?: "on" | undefined; // Checkbox value is 'on' if checked
          ignoreErrors?: "on" | undefined;
        };
      }>,
      reply
    ) => {
      const body = request.body;
      reply.type("text/html"); // Set content type for all responses from this handler
      try {
        // Basic validation
        if (!body.url || !body.library) {
          reply.status(400);
          // Return JSX for validation error
          return <p class="text-red-500">URL and Library Name are required.</p>;
        }

        // Prepare options for ScrapeTool
        const scrapeOptions = {
          url: body.url,
          library: body.library,
          version: body.version || null, // Handle empty string as null
          waitForCompletion: false, // Don't wait in UI
          options: {
            maxPages: body.maxPages
              ? Number.parseInt(body.maxPages, 10)
              : undefined,
            maxDepth: body.maxDepth
              ? Number.parseInt(body.maxDepth, 10)
              : undefined,
            scope: body.scope,
            scrapeMode: body.scrapeMode,
            // Checkboxes send 'on' when checked, otherwise undefined
            followRedirects: body.followRedirects === "on",
            ignoreErrors: body.ignoreErrors === "on",
          },
        };

        // Execute the scrape tool
        const result = await scrapeTool.execute(scrapeOptions);

        if ("jobId" in result) {
          // Success: Return JSX Fragment with message and OOB swap
          return (
            <>
              {/* Main target response */}
              <p class="text-green-600">
                ✅ Job queued successfully! ID: <span safe>{result.jobId}</span>
              </p>
              {/* OOB target response - contains only the inner form content */}
              <div id="scrape-form-container" hx-swap-oob="innerHTML">
                <ScrapeFormContent />
              </div>
            </>
          );
        }

        // This case shouldn't happen with waitForCompletion: false, but handle defensively
        // Return JSX for unexpected success
        return (
          <p class="text-yellow-600">⚠️ Job finished unexpectedly quickly.</p>
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        logger.error(`Scrape job submission failed: ${error}`);
        reply.status(500); // Keep status code for errors
        // Return JSX for server error
        return (
          <p class="text-red-600">
            ❌ Failed to queue job: <span>{errorMessage}</span>
          </p>
        );
      }
    }
  );
}
