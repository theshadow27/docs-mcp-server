import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type {
  LibraryInfo,
  ListLibrariesTool,
} from "../../tools/ListLibrariesTool";
import { SearchTool } from "../../tools/SearchTool";
import semver from "semver";
import VersionBadge from "../components/VersionBadge";
import { unified } from "unified"; // Import unified
import remarkParse from "remark-parse"; // Import unified plugins
import remarkGfm from "remark-gfm";
import remarkHtml from "remark-html";
import { StoreSearchResult, LibraryVersionDetails } from "../../store/types";

/**
 * Renders details for a single library version in a row format.
 * Reused from libraries.tsx for the detail card.
 * @param version - The library version details.
 * @param libraryName - The name of the library.
 */
const VersionDetailsRow = ({
  version,
  libraryName,
}: {
  version: LibraryVersionDetails;
  libraryName: string;
}) => {
  // Format the indexed date nicely, handle null case
  const indexedDate = version.indexedAt
    ? new Date(version.indexedAt).toLocaleDateString()
    : "N/A";
  // Display 'Unversioned' if version string is empty
  const versionLabel = version.version || "Unversioned";
  const versionParam = version.version || "unversioned"; // Use consistent param for URL

  // Generate unique IDs for the row, ensuring it's a valid CSS selector
  // Replace periods and other potentially invalid characters with hyphens
  const sanitizedVersionParam = versionParam.replace(/[^a-zA-Z0-9-_]/g, "-");
  const rowId = `row-${libraryName}-${sanitizedVersionParam}`;

  // Define state-specific button classes for Alpine toggling (simplified)
  // Assuming Flowbite/Tailwind provides utility classes or component styles
  // These might need adjustment based on actual Flowbite setup
  const defaultStateClasses =
    "text-red-700 border border-red-700 hover:bg-red-700 hover:text-white focus:ring-4 focus:outline-none focus:ring-red-300 dark:border-red-500 dark:text-red-500 dark:hover:text-white dark:focus:ring-red-800 dark:hover:bg-red-500";
  const confirmingStateClasses =
    "bg-red-600 text-white border-red-600 focus:ring-4 focus:outline-none focus:ring-300 dark:bg-red-700 dark:border-red-700 dark:focus:ring-red-800";

  return (
    // Use flexbox for layout, add border between rows
    <div
      id={rowId}
      class="flex justify-between items-center py-1 border-b border-gray-200 dark:border-gray-600 last:border-b-0"
    >
      {/* Version Label */}
      <span
        class="text-sm text-gray-900 dark:text-white w-1/4 truncate"
        title={versionLabel}
      >
        {version.version ? (
          <VersionBadge version={version.version} />
        ) : (
          <span>Unversioned</span>
        )}
      </span>

      {/* Stats Group - Removed documentCount, renamed uniqueUrlCount */}
      <div class="flex space-x-2 text-sm text-gray-600 dark:text-gray-400 w-3/4 justify-end items-center">
        <span title="Number of unique pages indexed">
          Pages:{" "}
          <span class="font-semibold" safe>
            {version.uniqueUrlCount.toLocaleString()}
          </span>
        </span>
        <span title="Number of indexed snippets">
          Snippets:{" "}
          <span class="font-semibold" safe>
            {version.documentCount.toLocaleString()}
          </span>
        </span>
        <span title="Date last indexed">
          Last Update:{" "}
          <span class="font-semibold" safe>
            {indexedDate}
          </span>
        </span>
      </div>
      {/* Use Flowbite Button structure with reduced margin/padding */}
      {/* Remove button is not needed on the detail page */}
    </div>
  );
};

/**
 * Renders a card for a single library, listing its versions with details.
 * Reused from libraries.tsx for the detail card.
 * @param library - The library information.
 */
const LibraryDetailCard = ({ library }: { library: LibraryInfo }) => (
  // Use Flowbite Card structure with updated padding and border, and white background
  <div class="block px-4 py-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-300 dark:border-gray-600 mb-4">
    <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-1">
      <span safe>{library.name}</span>
    </h3>
    {/* Container for version rows */}
    <div class="mt-1">
      {library.versions.length > 0 ? (
        library.versions
          // Sort versions: unversioned first, then newest semver first.
          .sort((a, b) => {
            // Explicitly place unversioned first
            if (!a.version) return -1;
            if (!b.version) return 1;
            // Then sort by semver, newest first
            return semver.compare(
              semver.coerce(b.version)?.version ?? "0.0.0",
              semver.coerce(a.version)?.version ?? "0.0.0"
            );
          })
          .map((version) => (
            <VersionDetailsRow libraryName={library.name} version={version} />
          )) // Pass libraryName
      ) : (
        // Display message if no versions are indexed
        <p class="text-sm text-gray-500 dark:text-gray-400 italic">
          No versions indexed.
        </p>
      )}
    </div>
  </div>
);

/**
 * Renders the search form card.
 * @param library - The library information to populate versions.
 */
const LibrarySearchCard = ({ library }: { library: LibraryInfo }) => {
  // Sort versions for the dropdown: unversioned first, then newest semver first.
  const sortedVersions = library.versions.sort((a, b) => {
    if (!a.version) return -1;
    if (!b.version) return 1;
    return semver.compare(
      semver.coerce(b.version)?.version ?? "0.0.0",
      semver.coerce(a.version)?.version ?? "0.0.0"
    );
  });

  return (
    <div class="block px-4 py-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-300 dark:border-gray-600 mb-4">
      <h2 class="text-xl font-semibold mb-2 text-gray-900 dark:text-white" safe>
        Search {library.name} Documentation
      </h2>
      <form
        hx-get={`/api/libraries/${encodeURIComponent(library.name)}/search`}
        hx-target="#searchResultsContainer .search-results"
        hx-swap="innerHTML"
        hx-indicator="#searchResultsContainer"
        class="flex space-x-2"
      >
        <select
          name="version"
          class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
        >
          <option value="">Latest</option> {/* Default to latest */}
          {sortedVersions.map((version) => (
            <option value={version.version || "unversioned"} safe>
              {version.version || "Unversioned"}
            </option>
          ))}
        </select>
        <input
          type="text"
          name="query"
          placeholder="Search query..."
          required
          class="flex-grow bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
        />
        <button
          type="submit"
          class="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800 relative"
        >
          <span class="search-text">Search</span>
          {/* Spinner for HTMX loading - shown via htmx-indicator class on parent */}
          <span class="spinner absolute inset-0 flex items-center justify-center">
            <svg
              class="animate-spin h-5 w-5 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          </span>
        </button>
      </form>
      {/* Add style for htmx-indicator behavior on button */}
      <style>
        {`
          form .htmx-indicator .spinner { display: flex; }
          form .htmx-indicator .search-text { display: none; }
          form .spinner { display: none; }
        `}
      </style>
    </div>
  );
};

/**
 * Renders a skeleton placeholder for a search result item.
 */
const SearchResultSkeletonItem = () => (
  <div class="block px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg shadow-sm mb-2 animate-pulse">
    <div class="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4 mb-2"></div>
    <div class="h-4 bg-gray-300 dark:bg-gray-600 rounded w-full mb-2"></div>
    <div class="h-4 bg-gray-300 dark:bg-gray-600 rounded w-5/6"></div>
  </div>
);

/**
 * Renders a single search result item.
 * @param result - The search result.
 */
const SearchResultItem = async ({ result }: { result: StoreSearchResult }) => {
  // Use unified pipeline to convert markdown to HTML
  const processor = unified().use(remarkParse).use(remarkGfm).use(remarkHtml);
  const file = await processor.process(result.content);
  const rawHtml = String(file);
  // NOTE: DOMPurify sanitization removed by user

  return (
    <div class="block px-4 py-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-300 dark:border-gray-600 mb-2">
      <div class="text-sm text-gray-600 dark:text-gray-400 mb-1">
        <a
          href={result.url}
          target="_blank"
          rel="noopener noreferrer"
          class="hover:underline"
          safe
        >
          {result.url}
        </a>
      </div>
      {/* Render the raw HTML content */}
      <div class="prose dark:prose-invert max-w-none">{rawHtml as "safe"}</div>
    </div>
  );
};

/**
 * Renders the list of search results.
 * @param results - The array of search results.
 */
const SearchResultList = ({ results }: { results: StoreSearchResult[] }) => {
  if (results.length === 0) {
    return (
      <p class="text-gray-500 dark:text-gray-400 italic">No results found.</p>
    );
  }
  return (
    <div class="space-y-2">
      {results.map((result) => (
        <SearchResultItem result={result} />
      ))}
    </div>
  );
};

/**
 * Main page layout component for library details.
 * @param libraryInfo - The information for the library being displayed.
 */
const LibraryDetailPage = ({ libraryInfo }: { libraryInfo: LibraryInfo }) => (
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title safe>MCP Documentation Server - {libraryInfo.name}</title>
      {/* Flowbite CSS */}
      <link
        href="https://cdn.jsdelivr.net/npm/flowbite@3.1.2/dist/flowbite.min.css"
        rel="stylesheet"
      />
      {/* Tailwind CSS */}
      <script src="https://cdn.tailwindcss.com" />
      {/* Add style for htmx-indicator behavior */}
      <style>
        {`
          .htmx-indicator {
            display: none;
          }
          .htmx-request .htmx-indicator {
            display: block;
          }
          .htmx-request.htmx-indicator {
            display: block;
          }
          /* Default: Hide skeleton, show results container */
          #searchResultsContainer .search-skeleton { display: none; }
          #searchResultsContainer .search-results { display: block; } /* Or as needed */

          /* Request in progress: Show skeleton, hide results */
          #searchResultsContainer.htmx-request .search-skeleton { display: block; } /* Or flex etc. */
          #searchResultsContainer.htmx-request .search-results { display: none; }

          /* Keep button spinner logic */
          form .htmx-indicator .spinner { display: flex; }
          form .htmx-indicator .search-text { display: none; }
          form .spinner { display: none; }
        `}
      </style>
    </head>
    <body class="bg-gray-50 dark:bg-gray-900">
      <div class="container mx-auto px-4 py-4">
        <header class="mb-4">
          <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
            MCP Documentation Server
          </h1>
        </header>

        <main>
          {/* Library Detail Card */}
          <LibraryDetailCard library={libraryInfo} />

          {/* Library Search Card */}
          <LibrarySearchCard library={libraryInfo} />

          {/* Search Results Container */}
          <div id="searchResultsContainer">
            {/* Skeleton loader - Initially present */}
            <div class="search-skeleton space-y-2">
              {" "}
              {/* Renamed class, removed hx-preserve */}
              <SearchResultSkeletonItem />
              <SearchResultSkeletonItem />
              <SearchResultSkeletonItem />
            </div>
            {/* Search results will be loaded here via HTMX */}
            <div class="search-results">
              {/* Initially empty, HTMX will swap content here */}
            </div>
          </div>
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
 * Registers the route for displaying library details.
 * @param server - The Fastify instance.
 * @param listLibrariesTool - The tool instance for listing libraries.
 * @param searchTool - The tool instance for searching documentation.
 */
export function registerLibraryDetailRoutes(
  server: FastifyInstance,
  listLibrariesTool: ListLibrariesTool,
  searchTool: SearchTool
) {
  // Route for the library detail page
  server.get(
    "/libraries/:libraryName",
    async (
      request: FastifyRequest<{ Params: { libraryName: string } }>,
      reply: FastifyReply
    ) => {
      const { libraryName } = request.params;
      try {
        // Fetch all libraries and find the requested one
        const result = await listLibrariesTool.execute();
        const libraryInfo = result.libraries.find(
          (lib) => lib.name === libraryName
        );

        if (!libraryInfo) {
          reply.status(404).send("Library not found");
          return;
        }

        reply.type("text/html; charset=utf-8");
        return (
          "<!DOCTYPE html>" + <LibraryDetailPage libraryInfo={libraryInfo} />
        );
      } catch (error) {
        server.log.error(
          error,
          `Failed to load library details for ${libraryName}`
        );
        reply.status(500).send("Internal Server Error");
      }
    }
  );

  // API route for searching a specific library
  server.get(
    "/api/libraries/:libraryName/search",
    async (
      request: FastifyRequest<{
        Params: { libraryName: string };
        Querystring: { query: string; version?: string };
      }>,
      reply: FastifyReply
    ) => {
      const { libraryName } = request.params;
      const { query, version } = request.query;

      if (!query) {
        reply.status(400).send("Search query is required.");
        return;
      }

      // Map "unversioned" string to undefined for the tool
      const versionParam = version === "unversioned" ? undefined : version;

      try {
        const searchResult = await searchTool.execute({
          library: libraryName,
          query,
          version: versionParam,
          limit: 10, // Limit search results
        });

        // Return only the results list or error message
        reply.type("text/html; charset=utf-8");
        if (searchResult.error) {
          return (
            <p class="text-red-500 dark:text-red-400 italic">
              Error: {searchResult.error.message}
            </p>
          );
        } else {
          return <SearchResultList results={searchResult.results} />;
        }
      } catch (error) {
        server.log.error(error, `Failed to search library ${libraryName}`);
        // Return error message on catch
        reply.type("text/html; charset=utf-8");
        return (
          <p class="text-red-500 dark:text-red-400 italic">
            An unexpected error occurred during the search.
          </p>
        );
      }
    }
  );
}
