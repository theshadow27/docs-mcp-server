/**
 * Default configuration values for the scraping pipeline and server
 */

/** Maximum number of pages to scrape in a single job */
export const DEFAULT_MAX_PAGES = 1000;

/** Maximum navigation depth when crawling links */
export const DEFAULT_MAX_DEPTH = 3;

/** Maximum number of concurrent page requests */
export const DEFAULT_MAX_CONCURRENCY = 3;

/** Default protocol for the MCP server */
export const DEFAULT_PROTOCOL = "stdio";

/** Default port for the HTTP protocol */
export const DEFAULT_HTTP_PORT = 8000;
