import type { Document } from "../../types";
import { logger } from "../../utils/logger";
import type { UrlNormalizerOptions } from "../../utils/url";
import { HttpFetcher } from "../fetcher";
import type { ScraperOptions } from "../types";
import { BaseScraperStrategy, type QueueItem } from "./BaseScraperStrategy";

export interface WebScraperStrategyOptions {
  urlNormalizerOptions?: UrlNormalizerOptions;
  shouldFollowLink?: (baseUrl: URL, targetUrl: URL) => boolean;
}

export class WebScraperStrategy extends BaseScraperStrategy {
  private readonly httpFetcher = new HttpFetcher();
  private readonly shouldFollowLinkFn?: (baseUrl: URL, targetUrl: URL) => boolean;

  constructor(options: WebScraperStrategyOptions = {}) {
    super({ urlNormalizerOptions: options.urlNormalizerOptions });
    this.shouldFollowLinkFn = options.shouldFollowLink;
  }

  canHandle(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
    } catch {
      return false;
    }
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

  protected async processItem(
    item: QueueItem,
    options: ScraperOptions,
  ): Promise<{ document?: Document; links?: string[] }> {
    const { url } = item;

    try {
      const rawContent = await this.httpFetcher.fetch(url);
      const processor = this.getProcessor(rawContent.mimeType);
      const result = await processor.process(rawContent);

      // Filter out links
      const baseUrl = new URL(options.url);
      const links = result.links.filter((link) => {
        try {
          const targetUrl = new URL(link, baseUrl);
          // Always ensure the target is on the same origin
          if (targetUrl.origin !== baseUrl.origin) {
            return false;
          }
          // Apply subpagesOnly and custom filter logic
          return (
            (!options.subpagesOnly || this.isSubpage(baseUrl, targetUrl)) &&
            (!this.shouldFollowLinkFn || this.shouldFollowLinkFn(baseUrl, targetUrl))
          );
        } catch {
          return false;
        }
      });

      return {
        document: {
          content: result.content,
          metadata: {
            url: result.source,
            title: result.title,
            library: options.library,
            version: options.version,
          },
        } satisfies Document,
        links,
      };
    } catch (error) {
      logger.error(`Failed to scrape page ${url}: ${error}`);
      throw error;
    }
  }
}
