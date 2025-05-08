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
export const DEFAULT_HTTP_PORT = 6280;

/** Default port for the Web UI */
export const DEFAULT_WEB_PORT = 6281;

/**
 * Maximum number of retries for HTTP fetcher requests.
 */
export const FETCHER_MAX_RETRIES = 6;

/**
 * Base delay in milliseconds for HTTP fetcher retry backoff.
 */
export const FETCHER_BASE_DELAY = 1000;

/**
 * Default chunk size settings for splitters
 */
export const SPLITTER_MIN_CHUNK_SIZE = 500;
export const SPLITTER_PREFERRED_CHUNK_SIZE = 1500;
export const SPLITTER_MAX_CHUNK_SIZE = 5000;

/**
 * Maximum number of documents to process in a single batch for embeddings.
 */
export const EMBEDDING_BATCH_SIZE = 300;
