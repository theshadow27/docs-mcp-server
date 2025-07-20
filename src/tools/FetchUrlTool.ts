import type {
  ContentFetcher,
  FileFetcher,
  HttpFetcher,
  RawContent,
} from "../scraper/fetcher";
import { HtmlPipeline } from "../scraper/pipelines/HtmlPipeline";
import { MarkdownPipeline } from "../scraper/pipelines/MarkdownPipeline";
import { ScrapeMode } from "../scraper/types";
import { ScraperError } from "../utils/errors";
import { logger } from "../utils/logger";
import { isPlaywrightAvailable } from "../utils/playwrightCheck";
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

  /**
   * Determines the HTML processing strategy.
   * - 'fetch': Use a simple DOM parser (faster, less JS support).
   * - 'playwright': Use a headless browser (slower, full JS support).
   * - 'auto': Automatically select the best strategy (currently defaults to 'playwright').
   * @default ScrapeMode.Auto
   */
  scrapeMode?: ScrapeMode;

  /**
   * Custom HTTP headers to send with the request (e.g., for authentication).
   * Keys are header names, values are header values.
   */
  headers?: Record<string, string>;
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

  /**
   * Cached result of Playwright availability check to avoid repeated checks
   */
  private static playwrightAvailable: boolean | null = null;

  constructor(httpFetcher: HttpFetcher, fileFetcher: FileFetcher) {
    this.fetchers = [httpFetcher, fileFetcher];
  }

  /**
   * Fetches content from a URL and converts it to Markdown.
   * Supports both HTTP/HTTPS URLs and local file URLs (file://).
   * @returns The processed Markdown content
   * @throws {ToolError} If fetching or processing fails
   */
  async execute(options: FetchUrlToolOptions): Promise<string> {
    let { url, scrapeMode = ScrapeMode.Auto, headers } = options;

    // If scrapeMode is Auto, check Playwright availability
    if (scrapeMode === ScrapeMode.Auto) {
      // Check cache first
      if (FetchUrlTool.playwrightAvailable === null) {
        FetchUrlTool.playwrightAvailable = await isPlaywrightAvailable(3000);
      }

      // If Playwright is not available, fall back to fetch mode
      if (!FetchUrlTool.playwrightAvailable) {
        logger.info("🔄 Playwright not available, using fetch mode instead");
        scrapeMode = ScrapeMode.Fetch;
      }
    }

    const canFetchResults = this.fetchers.map((f) => f.canFetch(url));
    const fetcherIndex = canFetchResults.findIndex((result) => result === true);
    if (fetcherIndex === -1) {
      throw new ToolError(
        `Invalid URL: ${url}. Must be an HTTP/HTTPS URL or a file:// URL.`,
        this.constructor.name,
      );
    }

    const fetcher = this.fetchers[fetcherIndex];
    const htmlPipeline = new HtmlPipeline();
    const markdownPipeline = new MarkdownPipeline();
    const pipelines = [htmlPipeline, markdownPipeline];

    try {
      logger.info(`📡 Fetching ${url}...`);
      const rawContent: RawContent = await fetcher.fetch(url, {
        followRedirects: options.followRedirects ?? true,
        maxRetries: 3,
        headers, // propagate custom headers
      });

      logger.info("🔄 Processing content...");

      let processed: Awaited<ReturnType<(typeof htmlPipeline)["process"]>> | undefined;
      for (const pipeline of pipelines) {
        if (pipeline.canProcess(rawContent)) {
          processed = await pipeline.process(
            rawContent,
            {
              url,
              library: "",
              version: "",
              maxDepth: 0,
              maxPages: 1,
              maxConcurrency: 1,
              scope: "subpages",
              followRedirects: options.followRedirects ?? true,
              excludeSelectors: undefined,
              ignoreErrors: false,
              scrapeMode,
              headers, // propagate custom headers
            },
            fetcher,
          );
          break;
        }
      }

      if (!processed) {
        logger.warn(
          `⚠️  Unsupported content type "${rawContent.mimeType}" for ${url}. Returning raw content.`,
        );
        const contentString =
          typeof rawContent.content === "string"
            ? rawContent.content
            : Buffer.from(rawContent.content).toString("utf-8");
        return contentString;
      }

      for (const err of processed.errors) {
        logger.warn(`⚠️  Processing error for ${url}: ${err.message}`);
      }

      if (typeof processed.textContent !== "string" || !processed.textContent.trim()) {
        throw new ToolError(
          `Processing resulted in empty content for ${url}`,
          this.constructor.name,
        );
      }

      logger.info(`✅ Successfully processed ${url}`);
      return processed.textContent;
    } catch (error) {
      if (error instanceof ScraperError || error instanceof ToolError) {
        throw new ToolError(
          `Failed to fetch or process URL: ${error.message}`,
          this.constructor.name,
        );
      }
      throw new ToolError(
        `Failed to fetch or process URL: ${error instanceof Error ? error.message : String(error)}`,
        this.constructor.name,
      );
    } finally {
      await htmlPipeline.close();
      await markdownPipeline.close();
    }
  }
}
