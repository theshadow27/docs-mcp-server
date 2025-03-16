import createDOMPurify, { type WindowLike } from "dompurify";
import { Window } from "happy-dom";
import scrapeIt from "scrape-it";
import TurndownService from "turndown";
import { ScraperError } from "../utils/errors";
import { logger } from "../utils/logger";
import { validateUrl } from "../utils/url";
import type { ScrapedPage } from "./types";

export type RetryOptions = {
  maxRetries?: number;
  baseDelay?: number;
};

function validateRetryOptions(options?: RetryOptions) {
  if (
    options?.maxRetries !== undefined &&
    (!Number.isInteger(options.maxRetries) || options.maxRetries <= 0)
  ) {
    throw new Error("maxRetries must be a positive integer");
  }
  if (
    options?.baseDelay !== undefined &&
    (typeof options.baseDelay !== "number" || options.baseDelay <= 0)
  ) {
    throw new Error("baseDelay must be a positive number");
  }
}

export type HtmlScraperOptions = {
  contentSelector?: string;
  linksSelector?: string;
  removeSelectors?: string[];
};

/**
 * Default selectors to remove from HTML content before conversion to markdown.
 * These target non-content elements like navigation, ads, scripts, etc.
 */
const defaultSelectorsToRemove = [
  "nav",
  "footer",
  "script",
  "style",
  "noscript",
  "svg",
  "link",
  "meta",
  "iframe",
  "header",
  "button",
  "input",
  "textarea",
  "select",
  "form",
  ".ads",
  ".advertisement",
  ".banner",
  ".cookie-banner",
  ".cookie-consent",
  ".hidden",
  ".hide",
  ".modal",
  ".nav-bar",
  ".overlay",
  ".popup",
  ".promo",
  ".mw-editsection",
  ".side-bar",
  ".social-share",
  ".sticky",
  "#ads",
  "#banner",
  "#cookieBanner",
  "#modal",
  "#nav",
  "#overlay",
  "#popup",
  "#sidebar",
  "#socialMediaBox",
  "#stickyHeader",
  "#ad-container",
  ".ad-container",
  ".login-form",
  ".signup-form",
  ".tooltip",
  ".dropdown-menu",
  ".alert",
  ".breadcrumb",
  ".pagination",
  '[role="alert"]',
  '[role="banner"]',
  '[role="dialog"]',
  '[role="alertdialog"]',
  '[role="region"][aria-label*="skip" i]',
  '[aria-modal="true"]',
  ".noprint",
  "figure",
  "sup",
];

/**
 * Handles HTML content extraction and conversion to markdown with retry capabilities.
 * Implements robust scraping with configurable selectors, sanitization, and automatic
 * retries for resilient web scraping. Uses Turndown for HTML-to-markdown conversion
 * with customized rules for code blocks and tables.
 */
export class HtmlScraper {
  private turndownService: TurndownService;
  private readonly contentSelector: string;
  private readonly linksSelector: string;
  private readonly selectorsToRemove: string[];
  private readonly MAX_RETRIES = 6;
  private readonly BASE_DELAY = 1000; // 1 second

  constructor(options?: HtmlScraperOptions) {
    this.contentSelector =
      options?.contentSelector ||
      "article, .content, .documentation, main, [role='main'], body";
    this.linksSelector = options?.linksSelector || "a[href]";
    this.selectorsToRemove = options?.removeSelectors ?? defaultSelectorsToRemove;

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
      filter: ["pre"],
      replacement: (content, node) => {
        const element = node as HTMLElement;
        // First look for an ancestor with both 'highlight' and 'highlight-source-*' classes
        const highlightElement = element.closest(
          '.highlight[class*="highlight-source-"]',
        );

        const language =
          highlightElement?.className.match(/highlight-source-(\w+)/)?.[1] ||
          element.getAttribute("class")?.replace("language-", "") ||
          "";

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

  /**
   * Performs single attempt at scraping page content and converting to markdown.
   * Handles HTML sanitization and URL normalization
   */
  public async scrapePage(url: string): Promise<ScrapedPage> {
    validateUrl(url);

    const { data } = await scrapeIt<{
      title: string;
      content: string;
      links: Array<{ url: string }>;
    }>(url, {
      title: "title",
      content: {
        selector: this.contentSelector,
        how: "html",
        trim: true,
      },
      links: {
        listItem: this.linksSelector,
        data: {
          url: {
            attr: "href",
          },
        },
      },
    });

    // Sanitize HTML content
    const window = new Window();
    const purify = createDOMPurify(window as unknown as WindowLike);
    const purifiedContent = purify.sanitize(data.content, {
      WHOLE_DOCUMENT: true,
      RETURN_DOM: true,
    });

    // Remove unwanted elements using selectorsToRemove
    if (purifiedContent instanceof window.HTMLElement) {
      for (const selector of this.selectorsToRemove) {
        const elements = purifiedContent.querySelectorAll(selector);
        for (const el of elements) {
          el.remove();
        }
      }
    }

    // Convert back to string
    const cleanedContent =
      purifiedContent instanceof window.HTMLElement
        ? purifiedContent.innerHTML
        : purifiedContent.textContent;

    const markdown = this.turndownService.turndown(cleanedContent || "").trim();
    if (!markdown) {
      throw new ScraperError(`No valid content found at ${url}`, false);
    }

    return {
      content: markdown,
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

  /**
   * Implements exponential backoff retry logic for resilient scraping.
   * Retries on 4xx errors with configurable attempts and delays
   */
  public async scrapePageWithRetry(
    url: string,
    options?: RetryOptions,
  ): Promise<ScrapedPage> {
    validateRetryOptions(options);
    const maxRetries = options?.maxRetries ?? this.MAX_RETRIES;
    const baseDelay = options?.baseDelay ?? this.BASE_DELAY;

    try {
      return await this.scrapePage(url);
    } catch (error: unknown) {
      const responseError = error as {
        response?: { status: number };
        message?: string;
      };
      const status = responseError?.response?.status;
      const message = responseError?.message || "Unknown error";

      // Only retry on 4xx errors
      if (status !== undefined && status >= 400 && status < 500) {
        for (let attempt = 1; attempt < maxRetries; attempt++) {
          logger.warn(
            `⚠️ Retry ${attempt}/${maxRetries - 1} for ${url} (Status: ${status})`,
          );
          try {
            await this.delay(baseDelay * 2 ** attempt);
            return await this.scrapePage(url);
          } catch (retryError: unknown) {
            // On last attempt, throw the error
            if (attempt === maxRetries - 1) {
              throw new ScraperError(
                `Failed to scrape ${url} after ${maxRetries} retries`,
                true,
                retryError instanceof Error ? retryError : undefined,
              );
            }
            // Otherwise continue to next retry
            const retryStatus = (retryError as { response?: { status: number } })
              ?.response?.status;
            logger.warn(
              `⚠️ Attempt ${attempt} failed (Status: ${retryStatus || "unknown"})`,
            );
          }
        }
      }

      // For non-4xx errors or if we somehow exit the retry loop, throw immediately
      throw new ScraperError(
        `Failed to scrape ${url}: ${message}`,
        false,
        error instanceof Error ? error : undefined,
      );
    }
  }
}
