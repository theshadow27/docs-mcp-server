// Import the main CSS file which includes Tailwind and Flowbite styles
import "./styles/main.css";

// Import HTMX to make it globally available
import "htmx.org";

// Import and start AlpineJS
import Alpine from "alpinejs";

// Initialize Alpine store for job button states
Alpine.store("jobStates", {});

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

// Listen for htmx swaps after a version delete and refresh the libraries list
document.body.addEventListener("htmx:afterSwap", (event) => {
  // Only act on DELETE swaps for version rows (outerHTML swap)
  const customEvent = event as CustomEvent;
  const detail = customEvent.detail;
  if (
    detail?.xhr?.status === 204 &&
    detail?.requestConfig?.verb === "delete" &&
    (event.target as HTMLElement)?.id?.startsWith("row-")
  ) {
    // Refresh the libraries list immediately
    if (window.htmx) {
      window.htmx.ajax("GET", "/api/libraries", "#indexedDocs");
    } else {
      window.location.reload();
    }
  }
});
