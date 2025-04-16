import type { FastifyInstance } from "fastify";
import type {
  LibraryInfo,
  LibraryVersion,
} from "../../tools/ListLibrariesTool";

const VersionBadge = ({ version }: { version: LibraryVersion }) => (
  <span
    class={`inline-flex items-center px-2 py-1 mr-2 text-xs font-medium rounded-full ${
      version.indexed
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
 */
export function registerLibrariesRoutes(server: FastifyInstance) {
  server.get("/api/libraries", async () => {
    // Placeholder data - replace with actual library fetching logic
    const libraries: LibraryInfo[] = [
      {
        name: "React",
        versions: [
          { version: "18.0.0", indexed: true },
          { version: "17.0.2", indexed: false },
        ],
      },
      {
        name: "TypeScript",
        versions: [
          { version: "5.0.0", indexed: true },
          { version: "4.9.5", indexed: true },
        ],
      },
    ];

    return <LibraryList libraries={libraries} />;
  });
}
