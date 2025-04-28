import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ScrapeTool } from "../../../tools/ScrapeTool"; // Adjusted import path
import { ScrapeMode } from "../../../scraper/types"; // Adjusted import path
import { logger } from "../../../utils/logger"; // Adjusted import path

// --- Scrape Form Content Component (The actual form fields) ---
const ScrapeFormContent = () => (
  <div class="mt-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-300 dark:border-gray-600">
    <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">
      Queue New Scrape Job
    </h3>
    <form
      hx-post="/api/jobs/scrape"
      hx-target="#job-response"
      hx-swap="innerHTML"
      class="space-y-2"
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
          class="mt-0.5 block w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
          class="mt-0.5 block w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
          class="mt-0.5 block w-full max-w-sm px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
      </div>

      {/* Consider using Flowbite Accordion here */}
      <details class="bg-gray-50 dark:bg-gray-700 p-2 rounded-md">
        <summary class="cursor-pointer text-sm font-medium text-gray-600 dark:text-gray-400">
          Advanced Options
        </summary>
        <div class="mt-2 space-y-2">
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
              class="mt-0.5 block w-full max-w-sm px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
              class="mt-0.5 block w-full max-w-sm px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
              class="mt-0.5 block w-full max-w-sm pl-2 pr-10 py-1 text-base border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
              class="mt-0.5 block w-full max-w-sm pl-2 pr-10 py-1 text-base border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
              class="ml-1 block text-sm text-gray-900 dark:text-gray-300"
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
              class="ml-1 block text-sm text-gray-900 dark:text-gray-300"
            >
              Ignore Errors During Scraping
            </label>
          </div>
        </div>
      </details>

      <div>
        <button
          type="submit"
          class="w-full flex justify-center py-1.5 px-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Queue Job
        </button>
      </div>
    </form>
    {/* Target div for HTMX response */}
    <div id="job-response" class="mt-2 text-sm"></div>
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
          // Return JSX for validation error using Flowbite Alert
          return (
            <div
              class="flex items-center p-4 mb-4 text-sm text-red-800 border border-red-300 rounded-lg bg-red-50 dark:bg-gray-800 dark:text-red-400 dark:border-red-800"
              role="alert"
            >
              <svg
                class="flex-shrink-0 inline w-4 h-4 me-3"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5ZM9.5 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM12 15H8a1 1 0 0 1 0-2h1v-3h-1a1 1 0 0 1 0-2h2a1 1 0 0 1 1 1v4h1a1 1 0 0 1 0 2Z" />
              </svg>
              <span class="sr-only">Info</span>
              <div>
                <span class="font-medium">Validation Error:</span> URL and
                Library Name are required.
              </div>
            </div>
          );
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
          // Success: Return JSX Fragment with message and OOB swap using Flowbite Alert
          return (
            <>
              {/* Main target response */}
              <div
                class="flex items-center p-4 mb-4 text-sm text-green-800 border border-green-300 rounded-lg bg-green-50 dark:bg-gray-800 dark:text-green-400 dark:border-green-800"
                role="alert"
              >
                <svg
                  class="flex-shrink-0 inline w-4 h-4 me-3"
                  aria-hidden="true"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5Zm9.5 9.5A9.5 9.5 0 0 1 10 19a9.46 9.46 0 0 1-1.671-.14c-.165-.05-.3-.19-.42-.335l-.165-.165c-.19-.2-.3-.425-.3-.655A4.2 4.2 0 0 1 4.5 10a4.25 4.25 0 0 1 7.462-2.882l1.217 1.217a3.175 3.175 0 0 0 4.5.01l.106-.106a.934.934 0 0 0 .1-.36ZM10 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" />
                </svg>
                <span class="sr-only">Info</span>
                <div>
                  <span class="font-medium">Success:</span> Job queued
                  successfully! ID: <span safe>{result.jobId}</span>
                </div>
              </div>
              {/* OOB target response - contains only the inner form content */}
              <div id="scrape-form-container" hx-swap-oob="innerHTML">
                <ScrapeFormContent />
              </div>
            </>
          );
        }

        // This case shouldn't happen with waitForCompletion: false, but handle defensively
        // Return JSX for unexpected success using Flowbite Alert
        return (
          <div
            class="flex items-center p-4 mb-4 text-sm text-yellow-800 border border-yellow-300 rounded-lg bg-yellow-50 dark:bg-gray-800 dark:text-yellow-300 dark:border-yellow-800"
            role="alert"
          >
            <svg
              class="flex-shrink-0 inline w-4 h-4 me-3"
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5ZM9.5 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM12 15H8a1 1 0 0 1 0-2h1v-3h-1a1 1 0 0 1 0-2h2a1 1 0 0 1 1 1v4h1a1 1 0 0 1 0 2Z" />
            </svg>
            <span class="sr-only">Info</span>
            <div>
              <span class="font-medium">Warning:</span> Job finished
              unexpectedly quickly.
            </div>
          </div>
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        logger.error(`Scrape job submission failed: ${error}`);
        reply.status(500); // Keep status code for errors
        // Return JSX for server error using Flowbite Alert
        return (
          <div
            class="flex items-center p-4 mb-4 text-sm text-red-800 border border-red-300 rounded-lg bg-red-50 dark:bg-gray-800 dark:text-red-400 dark:border-red-800"
            role="alert"
          >
            <svg
              class="flex-shrink-0 inline w-4 h-4 me-3"
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5ZM9.5 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM12 15H8a1 1 0 0 1 0-2h1v-3h-1a1 1 0 0 1 0-2h2a1 1 0 0 1 1 1v4h1a1 1 0 0 1 0 2Z" />
            </svg>
            <span class="sr-only">Info</span>
            <div>
              <span class="font-medium">Error:</span> Failed to queue job:{" "}
              <span>{errorMessage}</span>
            </div>
          </div>
        );
      }
    }
  );
}
