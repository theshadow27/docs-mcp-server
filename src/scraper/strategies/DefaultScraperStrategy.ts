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

  private async scrapePage(
    url: string,
    options: ScrapeOptions,
    depth: number,
    progressCallback?: ProgressCallback<ScrapingProgress>
  ): Promise<void> {
    const normalizedUrl = normalizeUrl(url, this.urlNormalizerOptions);
    const baseUrl = new URL(options.url);
    const targetUrl = new URL(url);
    // First page always proceeds, subsequent pages need to pass shouldFollowLink
    if (depth === 0) {
      if (this.visited.has(normalizedUrl)) {
        return;
      }
    } else {
      if (
        this.visited.has(normalizedUrl) ||
        this.pageCount >= options.maxPages ||
        (options.maxDepth >= 0 && depth > options.maxDepth) ||
        (options.subpagesOnly && !this.isSubpage(baseUrl, targetUrl)) ||
        (this.shouldFollowLinkFn &&
          !this.shouldFollowLinkFn(baseUrl, targetUrl))
      ) {
        return;
      }
    }

    this.visited.add(normalizedUrl);
    this.pageCount++;

    logger.info(
      `🌐 Scraping page ${this.pageCount}/${options.maxPages} (depth ${depth}/${options.maxDepth}): ${normalizedUrl}`
    );

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

    // Process child pages sequentially
    if (depth < options.maxDepth) {
      for (const link of result.links) {
        await this.scrapePage(link, options, depth + 1, progressCallback);
      }
    }
  }

  async scrape(
    options: ScrapeOptions,
    progressCallback?: ProgressCallback<ScrapingProgress>
  ): Promise<void> {
    this.visited.clear();
    this.pageCount = 0;

    // Process pages - documents are emitted via progress callback
    await this.scrapePage(options.url, options, 0, progressCallback);
  }
}
