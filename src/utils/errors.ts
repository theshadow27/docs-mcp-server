/**
 * Base error class for scraper-related errors
 */
export class ScraperError extends Error {
  constructor(
    message: string,
    public readonly isRetryable: boolean = false,
    public readonly cause?: unknown,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = "ScraperError";
    // Ensure the error's stack trace includes the cause if available
    if (cause instanceof Error) {
      this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
    }
  }
}

/**
 * Thrown when a URL is invalid or cannot be parsed
 */
export class InvalidUrlError extends ScraperError {
  constructor(url: string, cause?: unknown) {
    super(`Invalid URL: ${url}`, false, cause);
    this.name = "InvalidUrlError";
  }
}
