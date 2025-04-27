import type { FastifyInstance } from "fastify";
import semver from "semver"; // Import semver
import type {
  LibraryInfo,
  ListLibrariesTool,
} from "../../tools/ListLibrariesTool";
import type { LibraryVersionDetails } from "../../store/types";

/**
 * Renders details for a single library version in a row format.
 * @param version - The library version details.
 */
const VersionDetailsRow = ({ version }: { version: LibraryVersionDetails }) => {
  // Format the indexed date nicely, handle null case
  const indexedDate = version.indexedAt
    ? new Date(version.indexedAt).toLocaleDateString()
    : "N/A";
  // Display 'Unversioned' if version string is empty
  const versionLabel = version.version || "Unversioned";

  return (
    // Use flexbox for layout, add border between rows
    <div class="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-600 last:border-b-0">
      {/* Version Label */}
      <span
        class="font-medium text-sm text-gray-800 dark:text-gray-200 w-1/4 truncate"
        title={versionLabel}
        safe
      >
        {versionLabel}
      </span>

      {/* Stats Group - Removed documentCount, renamed uniqueUrlCount */}
      <div class="flex space-x-4 text-sm text-gray-600 dark:text-gray-400 w-3/4 justify-end items-center">
        {/* Removed Docs count */}
        <span title="Number of unique pages indexed">
          Pages:{" "}
          <span class="font-semibold" safe>
            {version.uniqueUrlCount}
          </span>
        </span>
        <span title="Date first indexed">
          Indexed:{" "}
          <span class="font-semibold" safe>
            {indexedDate}
          </span>
        </span>
      </div>
    </div>
  );
};

/**
 * Renders a card for a single library, listing its versions with details.
 * @param library - The library information.
 */
const LibraryItem = ({ library }: { library: LibraryInfo }) => (
  // Add some padding and shadow for better visual separation
  <div class="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg shadow-sm">
    <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
      <span safe>{library.name}</span>
    </h3>
    {/* Container for version rows */}
    <div class="mt-2 space-y-1">
      {library.versions.length > 0 ? (
        library.versions
          // Sort versions using semver, newest first. Treat empty/null as 0.0.0 for comparison.
          .sort((a, b) =>
            semver.compare(
              semver.coerce(b.version)?.version ?? "0.0.0",
              semver.coerce(a.version)?.version ?? "0.0.0"
            )
          )
          .map((version) => <VersionDetailsRow version={version} />) // Use VersionDetailsRow, ensure key uniqueness
      ) : (
        // Display message if no versions are indexed
        <p class="text-sm text-gray-500 dark:text-gray-400 italic">
          No versions indexed.
        </p>
      )}
    </div>
  </div>
);

// LibraryList component remains the same
const LibraryList = ({ libraries }: { libraries: LibraryInfo[] }) => (
  <div class="space-y-4">
    {libraries.map((library) => (
      <LibraryItem library={library} />
    ))}
  </div>
);

/**
 * Registers the API routes for library management.
 * @param server - The Fastify instance.
 * @param listLibrariesTool - The tool instance for listing libraries.
 */
export function registerLibrariesRoutes(
  server: FastifyInstance,
  listLibrariesTool: ListLibrariesTool
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
}
