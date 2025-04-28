import type { FastifyInstance } from "fastify";
import semver from "semver"; // Import semver
import type {
  LibraryInfo,
  ListLibrariesTool,
} from "../../tools/ListLibrariesTool";
import type { LibraryVersionDetails } from "../../store/types";
import { RemoveTool } from "../../tools";
import VersionBadge from "../components/VersionBadge";

/**
 * Renders details for a single library version in a row format.
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
    "bg-red-600 text-white border-red-600 focus:ring-4 focus:outline-none focus:ring-red-300 dark:bg-red-700 dark:border-red-700 dark:focus:ring-red-800";

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
      <button
        type="button"
        class="ml-2 font-medium rounded-lg text-sm p-1 text-center inline-flex items-center transition-colors duration-150 ease-in-out"
        title="Remove this version"
        x-data="{ confirming: false, isDeleting: false, timeoutId: null }" // Minimal state in x-data
        x-bind:class={`confirming ? "${confirmingStateClasses}" : "${defaultStateClasses}"`} // Toggle between state classes
        x-bind:disabled="isDeleting"
        x-on:click="
          if (confirming) {
            clearTimeout(timeoutId);
            timeoutId = null;
            isDeleting = true; // Set deleting state directly
            htmx.trigger($el, 'confirmedDelete'); // Trigger HTMX
          } else {
            confirming = true;
            timeoutId = setTimeout(() => { confirming = false; timeoutId = null; }, 3000);
          }
        "
        hx-delete={`/api/libraries/${libraryName}/versions/${versionParam}`}
        hx-target={`#${rowId}`}
        hx-swap="outerHTML"
        hx-trigger="confirmedDelete" // Use custom trigger from Alpine
      >
        {/* Default State: Trash Icon - Embed SVG directly */}
        <span x-show="!confirming && !isDeleting">
          <svg
            class="w-4 h-4"
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 18 20"
          >
            <path
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M1 5h16M7 8v8m4-8v8M7 1h4a1 1 0 0 1 1 1v3H6V2a1 1 0 0 1 1-1ZM3 5h12v13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5Z"
            />
          </svg>
          <span class="sr-only">Remove version</span>
        </span>

        {/* Confirming State: Text */}
        <span x-show="confirming && !isDeleting">Confirm?</span>

        {/* Deleting State: Spinner Icon - Embed SVG directly */}
        <span x-show="isDeleting">
          <svg
            class="animate-spin h-4 w-4 text-white"
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
          <span class="sr-only">Loading...</span>
        </span>
      </button>
    </div>
  );
};

/**
 * Renders a card for a single library, listing its versions with details.
 * @param library - The library information.
 */
const LibraryItem = ({ library }: { library: LibraryInfo }) => (
  // Use Flowbite Card structure with updated padding and border, and white background
  <div class="block px-4 py-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-300 dark:border-gray-600">
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

const LibraryList = ({ libraries }: { libraries: LibraryInfo[] }) => {
  // The trashIconSvg and related logic are now defined within VersionDetailsRow using AlpineJS

  return (
    <>
      <div class="space-y-2">
        {libraries.map((library) => (
          <LibraryItem library={library} />
        ))}
      </div>
      {/* The script block has been removed */}
    </>
  );
};

/**
 * Registers the API routes for library management.
 * @param server - The Fastify instance.
 * @param listLibrariesTool - The tool instance for listing libraries.
 * @param removeTool - The tool instance for removing library versions.
 */
export function registerLibrariesRoutes(
  server: FastifyInstance,
  listLibrariesTool: ListLibrariesTool,
  removeTool: RemoveTool // Accept RemoveTool
) {
  server.get("/api/libraries", async (_request, reply) => {
    // Add reply
    try {
      const result = await listLibrariesTool.execute();
      // Set content type to HTML for JSX rendering
      reply.type("text/html; charset=utf-8");
      // Render the component directly
      return <LibraryList libraries={result.libraries} />;
    } catch (error) {
      server.log.error(error, "Failed to list libraries");
      reply.status(500).send("Internal Server Error"); // Handle errors
    }
  });

  // Add DELETE route for removing versions
  server.delete<{ Params: { libraryName: string; versionParam: string } }>(
    "/api/libraries/:libraryName/versions/:versionParam",
    async (request, reply) => {
      const { libraryName, versionParam } = request.params;
      const version = versionParam === "unversioned" ? undefined : versionParam;
      try {
        await removeTool.execute({ library: libraryName, version });
        reply.status(204).send(); // No Content on success
      } catch (error: any) {
        server.log.error(
          error,
          `Failed to remove ${libraryName}@${versionParam}`
        );
        // Check for specific errors if needed, e.g., NotFoundError
        reply
          .status(500)
          .send({ message: error.message || "Failed to remove version." });
      }
    }
  );
}
