import { logger } from "../../utils/logger";
import type {
  ScrapeOptions,
  ProgressCallback,
  ScrapingProgress,
  ScraperStrategy,
  ScraperMetadata,
} from "../../types";
import { normalizeUrl, type UrlNormalizerOptions } from "../../utils/url";
import { HtmlScraper } from "../HtmlScraper";

export type DefaultScraperStrategyOptions = {
  urlNormalizerOptions?: UrlNormalizerOptions;
  shouldFollowLink?: (baseUrl: URL, targetUrl: URL) => boolean;
  htmlScraper?: HtmlScraper;
};

export class DefaultScraperStrategy implements ScraperStrategy {
  private visited = new Set<string>();
  private pageCount = 0;
  private urlNormalizerOptions: UrlNormalizerOptions;
  private readonly htmlScraper: HtmlScraper;
  private shouldFollowLinkFn?: (baseUrl: URL, targetUrl: URL) => boolean;

  static canHandle(url: string): boolean {
    return true;
  }

  static create(): DefaultScraperStrategy {
    return new DefaultScraperStrategy({});
  }

  constructor(options?: DefaultScraperStrategyOptions) {
    this.shouldFollowLinkFn = options?.shouldFollowLink;

    // Default URL normalizer options
    this.urlNormalizerOptions = {
      ignoreCase: true,
      removeHash: true,
      removeTrailingSlash: true,
      removeQuery: false,
      ...options?.urlNormalizerOptions,
    };

    this.htmlScraper = options?.htmlScraper ?? new HtmlScraper();
  }

  private isSubpage(baseUrl: URL, targetUrl: URL): boolean {
    try {
      const basePath = baseUrl.origin + baseUrl.pathname;
      const targetPath = targetUrl.origin + targetUrl.pathname;
      return targetPath.startsWith(basePath);
    } catch {
      return false;
    }
  }

  private async processUrl(
    item: { url: string; depth: number },
    options: ScrapeOptions,
    progressCallback?: ProgressCallback<ScrapingProgress>
  ): Promise<string[]> {
    const { url, depth } = item;
    const normalizedUrl = normalizeUrl(url, this.urlNormalizerOptions);

    logger.info(
      `🌐 Scraping page ${this.pageCount}/${options.maxPages} (depth ${depth}/${options.maxDepth}): ${normalizedUrl}`
    );

    try {
      const result = await this.htmlScraper.scrapePageWithRetry(url);

      // Convert and emit the document immediately
      await progressCallback?.({
        pagesScraped: this.pageCount,
        maxPages: options.maxPages,
        currentUrl: normalizedUrl,
        depth,
        maxDepth: options.maxDepth,
        document: {
          content: result.content,
          metadata: {
            url: result.url,
            title: result.title,
            library: options.library,
            version: options.version,
          } satisfies ScraperMetadata,
        },
      });

      // Return links to be processed by the main loop
      return result.links;
    } catch (error) {
      logger.error(`Failed to scrape page ${url}: ${error}`);
      return [];
    }
  }

  private async processBatch(
    batch: Array<{ url: string; depth: number }>,
    baseUrl: URL,
    options: ScrapeOptions,
    progressCallback?: ProgressCallback<ScrapingProgress>
  ): Promise<Array<{ url: string; depth: number }>> {
    // Process all URLs in the batch concurrently
    const results = await Promise.all(
      batch.map(async (item) => {
        // Increment page count before processing each URL
        this.pageCount++;
        const links = await this.processUrl(item, options, progressCallback);

        if (item.depth < options.maxDepth) {
          return links
            .map((link) => {
              try {
                const targetUrl = new URL(link);
                const normalizedLink = normalizeUrl(
                  link,
                  this.urlNormalizerOptions
                );

                if (
                  !this.visited.has(normalizedLink) &&
                  (!options.subpagesOnly ||
                    this.isSubpage(baseUrl, targetUrl)) &&
                  (!this.shouldFollowLinkFn ||
                    this.shouldFollowLinkFn(baseUrl, targetUrl))
                ) {
                  this.visited.add(normalizedLink);
                  return { url: link, depth: item.depth + 1 };
                }
              } catch (error) {
                // Invalid URL
              }
              return null;
            })
            .filter(
              (item): item is { url: string; depth: number } => item !== null
            );
        }
        return [];
      })
    );

    // Flatten and return all new URLs to process
    return results.flat();
  }

  async scrape(
    options: ScrapeOptions,
    progressCallback?: ProgressCallback<ScrapingProgress>
  ): Promise<void> {
    this.visited.clear();
    this.pageCount = 0;

    const baseUrl = new URL(options.url);
    const queue: Array<{ url: string; depth: number }> = [
      { url: options.url, depth: 0 },
    ];

    // Track URLs we've seen (either queued or visited)
    this.visited.add(normalizeUrl(options.url, this.urlNormalizerOptions));

    while (queue.length > 0 && this.pageCount < options.maxPages) {
      // Take a batch of URLs to process
      const remainingPages = options.maxPages - this.pageCount;
      if (remainingPages <= 0) {
        break;
      }

      const batchSize = Math.min(
        options.maxConcurrency ?? 3,
        remainingPages,
        queue.length
      );
      const batch = queue.splice(0, batchSize);

      // Process the batch and get new URLs
      const newUrls = await this.processBatch(
        batch,
        baseUrl,
        options,
        progressCallback
      );

      // Add new URLs to the queue
      queue.push(...newUrls);
    }
  }
}
