import type { Document, ProgressCallback } from "../../types";
import { logger } from "../../utils/logger";
import type { UrlNormalizerOptions } from "../../utils/url";
import { hasSameDomain, hasSameHostname, isSubpath } from "../../utils/url";
import { HttpFetcher } from "../fetcher";
import type { ScraperOptions, ScraperProgress } from "../types";
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

  /**
   * Determines if a target URL should be followed based on the scope setting.
   */
  private isInScope(
    baseUrl: URL,
    targetUrl: URL,
    scope: "subpages" | "hostname" | "domain",
  ): boolean {
    try {
      // First check if the URLs are on the same domain or hostname
      if (scope === "domain") {
        return hasSameDomain(baseUrl, targetUrl);
      }
      if (scope === "hostname") {
        return hasSameHostname(baseUrl, targetUrl);
      }
      // 'subpages' (default)
      return hasSameHostname(baseUrl, targetUrl) && isSubpath(baseUrl, targetUrl);
    } catch {
      return false;
    }
  }

  protected async processItem(
    item: QueueItem,
    options: ScraperOptions,
    _progressCallback?: ProgressCallback<ScraperProgress>, // Base class passes it, but not used here
    signal?: AbortSignal, // Add signal
  ): Promise<{ document?: Document; links?: string[] }> {
    const { url } = item;

    try {
      // Define fetch options, passing both signal and followRedirects
      const fetchOptions = {
        signal,
        followRedirects: options.followRedirects,
      };

      // Pass options to fetcher
      const rawContent = await this.httpFetcher.fetch(url, fetchOptions);
      const processor = this.getProcessor(rawContent.mimeType);
      const result = await processor.process(rawContent);

      // Filter out links
      const baseUrl = new URL(options.url);
      const links = result.links.filter((link) => {
        try {
          const targetUrl = new URL(link, baseUrl);

          // Determine scope - use 'subpages' as default
          const scope = options.scope || "subpages";

          // Apply scope and custom filter logic
          return (
            this.isInScope(baseUrl, targetUrl, scope) &&
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
