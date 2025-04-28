import type { PropsWithChildren } from "@kitajs/html";

/**
 * Props for the Layout component.
 */
interface LayoutProps extends PropsWithChildren {
  title: string;
}

/**
 * Base HTML layout component for all pages.
 * Includes common head elements, header, and scripts.
 * @param props - Component props including title and children.
 */
const Layout = ({ title, children }: LayoutProps) => (
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title safe>{title}</title>
      {/* Flowbite CSS */}
      <link
        href="https://cdn.jsdelivr.net/npm/flowbite@3.1.2/dist/flowbite.min.css"
        rel="stylesheet"
      />
      <link
        href="https://cdn.jsdelivr.net/npm/flowbite-typography@1.0.5/dist/typography.min.css"
        rel="stylesheet"
      />
      {/* Tailwind CSS */}
      <script src="https://cdn.tailwindcss.com" />
      {/* Add style for htmx-indicator behavior (needed globally) */}
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

        <main>{children}</main>
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
      <script src="https://cdn.jsdelivr.net/npm/flowbite-typography@1.0.5/src/index.min.js"></script>
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

export default Layout;
