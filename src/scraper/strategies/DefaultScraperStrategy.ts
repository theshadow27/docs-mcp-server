import { logger } from "../../utils/logger";
import type {
  ScrapeOptions,
  ProgressCallback,
  ScrapingProgress,
  ScraperStrategy,
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
    // Add starting URL to the tracking set
    this.visited.add(normalizeUrl(options.url, this.urlNormalizerOptions));

    while (queue.length > 0 && this.pageCount < options.maxPages) {
      const current = queue.shift();
      if (!current) continue;

      const { url, depth } = current;
      const normalizedUrl = normalizeUrl(url, this.urlNormalizerOptions);

      // Since we track at queueing time, this check is mostly
      // for safety in case of URL normalization differences
      if (!this.visited.has(normalizedUrl)) {
        // This shouldn't happen if our normalization is consistent,
        // but let's add it to visited to be safe
        this.visited.add(normalizedUrl);
      }

      this.pageCount++;

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
            },
          },
        });

        // Queue child pages if we haven't reached max depth
        if (depth < options.maxDepth) {
          for (const link of result.links) {
            const targetUrl = new URL(link);
            const normalizedLink = normalizeUrl(
              link,
              this.urlNormalizerOptions
            );

            // Skip if already visited or queued (now combined in this.visited)
            if (
              this.visited.has(normalizedLink) ||
              (options.subpagesOnly && !this.isSubpage(baseUrl, targetUrl)) ||
              (this.shouldFollowLinkFn &&
                !this.shouldFollowLinkFn(baseUrl, targetUrl))
            ) {
              continue;
            }

            // Add to queue and track immediately in visited set
            queue.push({ url: link, depth: depth + 1 });
            this.visited.add(normalizedLink);
          }
        }
      } catch (error) {
        logger.error(`Failed to scrape page ${url}: ${error}`);
      }
    }
  }
}
