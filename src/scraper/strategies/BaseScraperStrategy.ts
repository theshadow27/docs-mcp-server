import { URL } from "node:url";
import type { Document, ProgressCallback } from "../../types";
import { logger } from "../../utils/logger";
import { type UrlNormalizerOptions, normalizeUrl } from "../../utils/url";
import { type ContentProcessor, HtmlProcessor, MarkdownProcessor } from "../processor";
import type { ScraperOptions, ScraperProgress, ScraperStrategy } from "../types";

export type QueueItem = {
  url: string;
  depth: number;
};

export interface BaseScraperStrategyOptions {
  urlNormalizerOptions?: UrlNormalizerOptions;
}

export abstract class BaseScraperStrategy implements ScraperStrategy {
  protected visited = new Set<string>();
  protected pageCount = 0;

  abstract canHandle(url: string): boolean;

  protected options: BaseScraperStrategyOptions;

  constructor(options: BaseScraperStrategyOptions = {}) {
    this.options = options;
  }

  /**
   * Process a single item from the queue.
   *
   * @returns A list of URLs to add to the queue
   */
  protected abstract processItem(
    item: QueueItem,
    options: ScraperOptions,
    progressCallback?: ProgressCallback<ScraperProgress>,
  ): Promise<{
    document?: Document;
    links?: string[];
  }>;

  protected getProcessor(mimeType: string): ContentProcessor {
    if (mimeType.startsWith("text/html")) {
      return new HtmlProcessor();
    }
    return new MarkdownProcessor();
  }

  protected async processBatch(
    batch: QueueItem[],
    baseUrl: URL,
    options: ScraperOptions,
    progressCallback: ProgressCallback<ScraperProgress>,
  ): Promise<QueueItem[]> {
    const results = await Promise.all(
      batch.map(async (item) => {
        if (item.depth > options.maxDepth) {
          return [];
        }

        try {
          const result = await this.processItem(item, options);

          if (result.document) {
            this.pageCount++;
            logger.info(
              `🌐 Scraping page ${this.pageCount}/${options.maxPages} (depth ${item.depth}/${options.maxDepth}): ${item.url}`,
            );
            await progressCallback({
              pagesScraped: this.pageCount,
              maxPages: options.maxPages,
              currentUrl: item.url,
              depth: item.depth,
              maxDepth: options.maxDepth,
              document: result.document,
            });
          }

          const nextItems = result.links || [];
          return nextItems
            .map((value) => {
              try {
                const targetUrl = new URL(value, baseUrl);
                return {
                  url: targetUrl.href,
                  depth: item.depth + 1,
                } satisfies QueueItem;
              } catch (error) {
                // Invalid URL or path
                logger.warn(`❌ Invalid URL: ${value}`);
              }
              return null;
            })
            .filter((item) => item !== null);
        } catch (error) {
          if (options.ignoreErrors) {
            logger.error(`❌ Failed to process ${item.url}: ${error}`);
            return [];
          }
          throw error;
        }
      }),
    );

    // After all concurrent processing is done, deduplicate the results
    const allLinks = results.flat();
    const uniqueLinks: QueueItem[] = [];

    // Now perform deduplication once, after all parallel processing is complete
    for (const item of allLinks) {
      const normalizedUrl = normalizeUrl(item.url, this.options.urlNormalizerOptions);
      if (!this.visited.has(normalizedUrl)) {
        this.visited.add(normalizedUrl);
        uniqueLinks.push(item);
      }
    }

    return uniqueLinks;
  }

  async scrape(
    options: ScraperOptions,
    progressCallback: ProgressCallback<ScraperProgress>,
  ): Promise<void> {
    this.visited.clear();
    this.pageCount = 0;

    const baseUrl = new URL(options.url);
    const queue = [{ url: options.url, depth: 0 } satisfies QueueItem];

    // Track values we've seen (either queued or visited)
    this.visited.add(normalizeUrl(options.url, this.options.urlNormalizerOptions));

    while (queue.length > 0 && this.pageCount < options.maxPages) {
      const remainingPages = options.maxPages - this.pageCount;
      if (remainingPages <= 0) {
        break;
      }

      const batchSize = Math.min(
        options.maxConcurrency ?? 3,
        remainingPages,
        queue.length,
      );

      const batch = queue.splice(0, batchSize);
      const newUrls = await this.processBatch(batch, baseUrl, options, progressCallback);

      queue.push(...newUrls);
    }
  }
}
