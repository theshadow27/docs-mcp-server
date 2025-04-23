import type { FastifyInstance } from "fastify";
import type {
  LibraryInfo,
  ListLibrariesTool,
} from "../../tools/ListLibrariesTool";
import { LibraryVersionDetails } from "../../store/types";

const VersionBadge = ({ version }: { version: LibraryVersionDetails }) => (
  <span
    class={`inline-flex items-center px-2 py-1 mr-2 text-xs font-medium rounded-full ${
      version.documentCount > 0
        ? "text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-800"
        : "text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-800"
    }`}
  >
    <span safe>{version.version}</span>
  </span>
);

const LibraryItem = ({ library }: { library: LibraryInfo }) => (
  <div class="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
    <h3 class="text-lg font-medium text-gray-900 dark:text-white">
      <span safe>{library.name}</span>
    </h3>
    <div class="mt-2">
      {library.versions.map((version) => (
        <VersionBadge version={version} />
      ))}
    </div>
  </div>
);

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
  listLibrariesTool: ListLibrariesTool // Add the tool parameter
) {
  server.get("/api/libraries", async () => {
    // Fetch actual library data using the tool
    const result = await listLibrariesTool.execute();
    return <LibraryList libraries={result.libraries} />;
  });
}
