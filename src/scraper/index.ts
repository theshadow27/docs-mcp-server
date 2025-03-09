import TurndownService from "turndown";
import scrapeIt from "scrape-it";
import type {
  ScraperConfig,
  PageResult,
  ScrapingProgressCallback,
} from "../types";
import { normalizeUrl, type UrlNormalizerOptions } from "../utils/url";

export class DocumentationScraper {
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

  public async scrapeWithRetry(
    url: string,
    config: ScraperConfig
  ): Promise<PageResult> {
    // Don't normalize URLs here at all
    try {
      new URL(url); // Just validate URL
    } catch {
      throw new Error(`Invalid URL: ${url}`);
    }

    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      try {
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
                // Keep original URL structure when resolving relative paths
                return new URL(l.url, url).href;
              } catch {
                return ""; // Invalid URL
              }
            })
            .filter(Boolean),
        };
      } catch (error: unknown) {
        // Handle 4xx errors specially
        const responseError = error as { response?: { status: number } };
        const status = responseError?.response?.status;
        if (status && status >= 400 && status < 500) {
          console.warn(`Warning: ${url} returned ${status}`);
          return {
            content: "Page not accessible",
            title: `Error ${status}`,
            url: url,
            links: [],
          };
        }

        if (attempt === this.MAX_RETRIES - 1) throw error;
        const delay = this.BASE_DELAY * 2 ** attempt;
        await this.delay(delay);
      }
    }

    throw new Error(`Failed to scrape ${url} after maximum retries`);
  }

  async scrape(config: ScraperConfig): Promise<PageResult[]> {
    this.visited.clear();
    this.pageCount = 0;
    this.currentConfig = config;
    // Pass original URL to scrapePage
    return this.scrapePage(config.url, config, 0);
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
      (config.subpagesOnly !== false && !this.isSubpage(config.url, url))
    ) {
      return [];
    }

    this.visited.add(normalizedUrl);
    this.pageCount++;
    this.reportProgress(normalizedUrl, depth);

    // Pass original URL to scrapeWithRetry
    const result = await this.scrapeWithRetry(url, config);
    const results = [result];

    if (depth < config.maxDepth) {
      for (const link of result.links) {
        const pageResults = await this.scrapePage(link, config, depth + 1);
        results.push(...pageResults);
      }
    }

    return results;
  }
}
