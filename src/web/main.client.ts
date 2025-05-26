// Import the main CSS file which includes Tailwind and Flowbite styles
import "./styles/main.css";

// Import HTMX to make it globally available
import "htmx.org";

// Import and start AlpineJS
import Alpine from "alpinejs";

// Ensure Alpine global store for confirmation actions is initialized before Alpine components render
Alpine.store("confirmingAction", {
  type: null,
  id: null,
  timeoutId: null,
  isDeleting: false,
});

Alpine.start();

// Import Flowbite JavaScript and initialization function
import { initFlowbite } from "flowbite";

declare global {
  interface Window {
    htmx: typeof import("htmx.org");
    Alpine: typeof import("alpinejs");
  }
}

// Initialize Flowbite components
initFlowbite();

// Add a global event listener for 'job-list-refresh' that uses HTMX to reload the job list
document.addEventListener("job-list-refresh", () => {
  if (window.htmx) {
    window.htmx.ajax("GET", "/api/jobs", "#job-list");
  } else {
    window.location.reload();
  }
});

// Add a global event listener for 'version-list-refresh' that reloads the version list container using HTMX
document.addEventListener("version-list-refresh", (event: Event) => {
  const customEvent = event as CustomEvent<{ library: string }>;
  const library = customEvent.detail?.library;
  if (window.htmx && library) {
    window.htmx.ajax(
      "GET",
      `/api/libraries/${encodeURIComponent(library)}/versions`,
      "#version-list",
    );
  } else {
    window.location.reload();
  }
});

// Listen for htmx swaps after a version delete and dispatch version-list-refresh with payload
// Assumes version row IDs are in the format row-<library>-<version>
document.body.addEventListener("htmx:afterSwap", (event) => {
  const detail = (event as CustomEvent).detail;
  if (
    detail?.xhr?.status === 204 &&
    detail?.requestConfig?.verb === "delete" &&
    (event.target as HTMLElement)?.id?.startsWith("row-")
  ) {
    // Extract library name from the row id: row-<library>-<version>
    const rowId = (event.target as HTMLElement).id;
    const match = rowId.match(/^row-([^\-]+)-/);
    const library = match ? match[1] : null;
    if (library) {
      document.dispatchEvent(
        new CustomEvent("version-list-refresh", { detail: { library } }),
      );
    } else {
      window.location.reload();
    }
  }
});
