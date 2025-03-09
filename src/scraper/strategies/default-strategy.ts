import TurndownService from "turndown";
import scrapeIt from "scrape-it";
import { ScraperError } from "../../utils/errors";
import { validateUrl } from "../../utils/url";
import type {
  ScraperConfig,
  PageResult,
  ScrapingProgressCallback,
  ScraperStrategy,
  DocContent,
} from "../../types";
import { normalizeUrl, type UrlNormalizerOptions } from "../../utils/url";

export class DefaultScraperStrategy implements ScraperStrategy {
  private visited = new Set<string>();
  private pageCount = 0;
  private turndownService: TurndownService;
  private readonly MAX_RETRIES = 6;
  private readonly BASE_DELAY = 1000; // 1 second
  private readonly defaultSelectors = {
    content: "article, .content, .documentation, main, [role='main'], body",
    links: "a[href]",
    ignore: [] as string[],
  };
  private currentConfig: ScraperConfig | null = null;
  private onProgress?: ScrapingProgressCallback;
  private urlNormalizerOptions: UrlNormalizerOptions;

  constructor(options?: {
    onProgress?: ScrapingProgressCallback;
    urlNormalizerOptions?: UrlNormalizerOptions;
  }) {
    this.onProgress = options?.onProgress;
    // Default URL normalizer options
    this.urlNormalizerOptions = {
      ignoreCase: true,
      removeHash: true,
      removeTrailingSlash: true,
      removeQuery: false,
      ...options?.urlNormalizerOptions,
    };

    this.turndownService = new TurndownService({
      headingStyle: "atx",
      hr: "---",
      bulletListMarker: "-",
      codeBlockStyle: "fenced",
      emDelimiter: "_",
      strongDelimiter: "**",
      linkStyle: "referenced",
      linkReferenceStyle: "full",
    });

    // Preserve code blocks and syntax
    this.turndownService.addRule("pre", {
      filter: ["pre", "code"],
      replacement: (content, node) => {
        const language =
          (node as HTMLElement)
            .getAttribute("class")
            ?.replace("language-", "") || "";
        return `\n\`\`\`${language}\n${content}\n\`\`\`\n`;
      },
    });

    // Better table handling
    this.turndownService.addRule("table", {
      filter: ["table"],
      replacement: (content) => {
        const cleanedContent = content.replace(/\n+/g, "\n");
        return `\n\n${cleanedContent}\n\n`;
      },
    });
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private reportProgress(currentUrl: string, depth: number) {
    if (this.onProgress && this.currentConfig) {
      this.onProgress({
        pagesScraped: this.pageCount,
        maxPages: this.currentConfig.maxPages,
        currentUrl,
        depth,
        maxDepth: this.currentConfig.maxDepth,
      });
    }
  }

  private async scrapePageContent(url: string): Promise<PageResult> {
    validateUrl(url);

    const { data } = await scrapeIt<{
      title: string;
      content: string;
      links: Array<{ url: string }>;
    }>(url, {
      title: "title",
      content: {
        selector: this.defaultSelectors.content,
        how: "html",
        trim: true,
      },
      links: {
        listItem: this.defaultSelectors.links,
        data: {
          url: {
            attr: "href",
          },
        },
      },
    });

    return {
      content:
        this.turndownService.turndown(data.content).trim() ||
        "No content available",
      title: data.title,
      url: url,
      links: data.links
        .map((l) => {
          try {
            return new URL(l.url, url).href;
          } catch {
            return ""; // Invalid URL
          }
        })
        .filter(Boolean),
    };
  }

  private async scrapePageContentWithRetry(
    url: string,
    config: ScraperConfig
  ): Promise<PageResult> {
    try {
      return await this.scrapePageContent(url);
    } catch (error: unknown) {
      const responseError = error as {
        response?: { status: number };
        message?: string;
      };
      const status = responseError?.response?.status;
      const message = responseError?.message || "Unknown error";

      // Only retry on 4xx errors
      if (status !== undefined && status >= 400 && status < 500) {
        for (let attempt = 1; attempt < this.MAX_RETRIES; attempt++) {
          try {
            await this.delay(this.BASE_DELAY * 2 ** attempt);
            return await this.scrapePageContent(url);
          } catch (retryError: unknown) {
            // On last attempt, throw the error
            if (attempt === this.MAX_RETRIES - 1) {
              throw new ScraperError(
                `Failed to scrape ${url} after ${this.MAX_RETRIES} retries`,
                true,
                retryError,
                status
              );
            }
            // Otherwise continue to next retry
          }
        }
      }

      // For non-4xx errors or if we somehow exit the retry loop, throw immediately
      throw new ScraperError(
        `Failed to scrape ${url}: ${message}`,
        false,
        error,
        status
      );
    }
  }

  private isSubpage(baseUrl: string, targetUrl: string): boolean {
    try {
      const base = new URL(baseUrl);
      const target = new URL(targetUrl);
      const basePath = base.origin + base.pathname;
      const targetPath = target.origin + target.pathname;
      return targetPath.startsWith(basePath);
    } catch {
      return false;
    }
  }

  private shouldFollowLinkFn?: (
    baseUrl: URL,
    targetUrl: URL,
    depth: number
  ) => boolean;

  private async scrapePage(
    url: string,
    config: ScraperConfig,
    depth: number
  ): Promise<PageResult[]> {
    const normalizedUrl = normalizeUrl(url, this.urlNormalizerOptions);
    if (
      this.visited.has(normalizedUrl) ||
      this.pageCount >= config.maxPages ||
      depth > config.maxDepth ||
      (config.subpagesOnly !== false &&
        !this.shouldFollowPage(config.url, url, depth))
    ) {
      return [];
    }

    this.visited.add(normalizedUrl);
    this.pageCount++;
    this.reportProgress(normalizedUrl, depth);

    const result = await this.scrapePageContentWithRetry(url, config);
    const results = [result];

    if (depth < config.maxDepth) {
      for (const link of result.links) {
        const pageResults = await this.scrapePage(link, config, depth + 1);
        results.push(...pageResults);
      }
    }

    return results;
  }

  private shouldFollowPage(
    baseUrl: string,
    targetUrl: string,
    depth: number
  ): boolean {
    try {
      if (this.shouldFollowLinkFn) {
        return this.shouldFollowLinkFn(
          new URL(baseUrl),
          new URL(targetUrl),
          depth
        );
      }
      return this.isSubpage(baseUrl, targetUrl);
    } catch {
      return false;
    }
  }

  async scrape(
    config: ScraperConfig,
    progressCallback?: ScrapingProgressCallback,
    shouldFollowLink?: (baseUrl: URL, targetUrl: URL, depth: number) => boolean
  ): Promise<DocContent[]> {
    this.visited.clear();
    this.pageCount = 0;
    this.currentConfig = config;
    this.onProgress = progressCallback;
    this.shouldFollowLinkFn = shouldFollowLink;

    const results = await this.scrapePage(config.url, config, 0);
    return results.map((result) => ({
      content: result.content,
      metadata: {
        url: result.url,
        title: result.title,
        library: config.library,
        version: config.version,
      },
    }));
  }
}
