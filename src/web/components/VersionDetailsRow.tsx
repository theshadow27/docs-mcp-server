import type { LibraryVersionDetails } from "../../store/types";
import VersionBadge from "./VersionBadge"; // Adjusted import path
import LoadingSpinner from "./LoadingSpinner"; // Import spinner

/**
 * Props for the VersionDetailsRow component.
 */
interface VersionDetailsRowProps {
  version: LibraryVersionDetails;
  libraryName: string;
  showDelete?: boolean; // Optional prop to control delete button visibility
}

/**
 * Renders details for a single library version in a row format.
 * Includes version, stats, and an optional delete button.
 * @param props - Component props including version, libraryName, and showDelete flag.
 */
const VersionDetailsRow = ({
  version,
  libraryName,
  showDelete = true, // Default to true
}: VersionDetailsRowProps) => {
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

  // Define state-specific button classes for Alpine toggling
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

      {/* Stats Group */}
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

      {/* Conditionally render the delete button */}
      {showDelete && (
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
          {/* Default State: Trash Icon */}
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

          {/* Deleting State: Spinner Icon */}
          <span x-show="isDeleting">
            <LoadingSpinner />
            <span class="sr-only">Loading...</span>
          </span>
        </button>
      )}
    </div>
  );
};

export default VersionDetailsRow;
