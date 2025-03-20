import { URL } from "node:url";
import type { Document, ProgressCallback } from "../../types";
import { logger } from "../../utils/logger";
import { type UrlNormalizerOptions, normalizeUrl } from "../../utils/url";
import { type ContentProcessor, HtmlProcessor, MarkdownProcessor } from "../processor";
import type { ScraperOptions, ScraperProgress, ScraperStrategy } from "../types";

export type QueueItem = {
  value: string;
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
              `🌐 Scraping page ${this.pageCount}/${options.maxPages} (depth ${item.depth}/${options.maxDepth}): ${item.value}`,
            );
            try {
              await progressCallback({
                pagesScraped: this.pageCount,
                maxPages: options.maxPages,
                currentUrl: item.value,
                depth: item.depth,
                maxDepth: options.maxDepth,
                document: result.document,
              });
            } catch (error) {
              if (options.ignoreErrors) {
                logger.error(`Error in progress callback for ${item.value}: ${error}`);
              } else {
                throw error;
              }
            }
          }

          const nextItems = result.links || [];
          return nextItems
            .map((value) => {
              try {
                // For URLs, normalize and check if visited
                const targetUrl = new URL(value, baseUrl);
                const normalizedValue = normalizeUrl(
                  targetUrl.href,
                  this.options.urlNormalizerOptions,
                );

                if (!this.visited.has(normalizedValue)) {
                  this.visited.add(normalizedValue);
                  return {
                    value: targetUrl.href,
                    depth: item.depth + 1,
                  };
                }
              } catch (error) {
                // Invalid URL or path
                logger.warn(`❌ Invalid URL: ${value}`);
              }
              return null;
            })
            .filter((item): item is QueueItem => item !== null);
        } catch (error) {
          if (options.ignoreErrors) {
            logger.error(`❌ Failed to process ${item.value}: ${error}`);
            return [];
          }
          throw error;
        }
      }),
    );
    return results.flat();
  }

  async scrape(
    options: ScraperOptions,
    progressCallback: ProgressCallback<ScraperProgress>,
  ): Promise<void> {
    this.visited.clear();
    this.pageCount = 0;

    const baseUrl = new URL(options.url);
    const queue = [{ value: options.url, depth: 0 }];

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
