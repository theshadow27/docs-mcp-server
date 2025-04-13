import type { ContentFetcher, FileFetcher, HttpFetcher } from "../scraper/fetcher";
import type { HtmlProcessor } from "../scraper/processor";
import { ScraperError } from "../utils/errors";
import { logger } from "../utils/logger";
import { ToolError } from "./errors";

export interface FetchUrlToolOptions {
  /**
   * The URL to fetch and convert to markdown.
   * Must be a valid HTTP/HTTPS URL or file:// URL.
   */
  url: string;

  /**
   * Whether to follow HTTP redirects.
   * @default true
   */
  followRedirects?: boolean;
}

/**
 * Tool for fetching a single URL and converting its content to Markdown.
 * Unlike scrape_docs, this tool only processes one page without crawling
 * or storing the content.
 *
 * Supports both HTTP/HTTPS URLs and local file URLs (file://).
 */
export class FetchUrlTool {
  /**
   * Collection of fetchers that will be tried in order for a given URL.
   */
  private readonly fetchers: ContentFetcher[];

  constructor(
    httpFetcher: HttpFetcher,
    fileFetcher: FileFetcher,
    private readonly processor: HtmlProcessor,
  ) {
    this.fetchers = [httpFetcher, fileFetcher];
  }

  /**
   * Fetches content from a URL and converts it to Markdown.
   * Supports both HTTP/HTTPS URLs and local file URLs (file://).
   * @returns The processed Markdown content
   * @throws {ToolError} If fetching or processing fails
   */
  async execute(options: FetchUrlToolOptions): Promise<string> {
    const { url } = options;

    // Check all fetchers first (helpful for testing and future extensions)
    const canFetchResults = this.fetchers.map((f) => f.canFetch(url));

    // Find an appropriate fetcher for this URL
    const fetcherIndex = canFetchResults.findIndex((result) => result === true);
    if (fetcherIndex === -1) {
      throw new ToolError(
        `Invalid URL: ${url}. Must be an HTTP/HTTPS URL or a file:// URL.`,
        this.constructor.name,
      );
    }

    const fetcher = this.fetchers[fetcherIndex];

    try {
      // Fetch the content
      logger.info(`📡 Fetching ${url}...`);
      const rawContent = await fetcher.fetch(url, {
        followRedirects: options.followRedirects ?? true,
        maxRetries: 3,
      });

      // Process the HTML to Markdown
      logger.info("🔄 Converting to Markdown...");
      const processed = await this.processor.process(rawContent);

      logger.info(`✅ Successfully converted ${url} to Markdown`);
      return processed.content;
    } catch (error) {
      if (error instanceof ScraperError) {
        throw new ToolError(
          `Failed to fetch or process URL: ${error.message}`,
          this.constructor.name,
        );
      }
      throw new ToolError(
        `Failed to fetch or process URL: ${error instanceof Error ? error.message : String(error)}`,
        this.constructor.name,
      );
    }
  }
}
