import { ScrapeMode } from "../../scraper/types"; // Adjusted import path

/**
 * Renders the form fields for queuing a new scrape job.
 * Includes basic fields (URL, Library, Version) and advanced options.
 */
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
      <details class="bg-gray-50 dark:bg-gray-900 p-2 rounded-md">
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

export default ScrapeFormContent;
