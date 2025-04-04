import createDOMPurify, { type WindowLike } from "dompurify";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";
import { ScraperError } from "../../utils/errors";
import type { RawContent } from "../fetcher/types";
import type { ContentProcessor, ProcessedContent } from "./types";

export interface HtmlProcessOptions {
  /** CSS selectors to exclude from processing */
  excludeSelectors?: string[];
  /** Whether to extract links from content */
  extractLinks?: boolean;
}

/**
 * Processes HTML content, sanitizes it, and converts it to markdown.
 */
export class HtmlProcessor implements ContentProcessor {
  private turndownService: TurndownService;
  private options: HtmlProcessOptions;
  private selectorsToRemove = [
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

  constructor(options?: HtmlProcessOptions) {
    this.turndownService = new TurndownService({
      headingStyle: "atx",
      hr: "---",
      bulletListMarker: "-",
      codeBlockStyle: "fenced",
      emDelimiter: "_",
      strongDelimiter: "**",
      linkStyle: "inlined",
    });

    // Preserve code blocks and syntax
    this.turndownService.addRule("pre", {
      filter: ["pre"],
      replacement: (content, node) => {
        const element = node as unknown as HTMLElement;
        let language = element.getAttribute("data-language") || "";
        if (!language) {
          // Find the closest ancestor with a highlight or language class
          const highlightElement = element.closest(
            '[class*="highlight-source-"], [class*="highlight-"], [class*="language-"]',
          );

          if (highlightElement) {
            const className = highlightElement.className;
            const match = className.match(
              /(?:highlight-source-|highlight-|language-)(\w+)/,
            );
            if (match) {
              language = match[1];
            }
          }
        }

        // use `node.textContent` to avoid escaping
        return `\n\`\`\`${language}\n${node.textContent}\n\`\`\`\n`;
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

    this.options = options || {};
  }

  canProcess(content: RawContent): boolean {
    return content.mimeType.startsWith("text/html");
  }

  async process(content: RawContent): Promise<ProcessedContent> {
    if (!this.canProcess(content)) {
      throw new ScraperError(
        `HtmlProcessor cannot process content of type ${content.mimeType}`,
        false,
      );
    }

    const htmlContent =
      typeof content.content === "string"
        ? content.content
        : content.content.toString((content.encoding as BufferEncoding) || "utf-8");

    // Find title
    const titleMatch = htmlContent.match(/<title>([^<]+)<\/title>/i);
    const title = titleMatch?.[1] || "Untitled";

    const window = new JSDOM(content.content, { url: content.source }).window;

    const purify = createDOMPurify(window as unknown as WindowLike);
    const purifiedContent = purify.sanitize(htmlContent, {
      WHOLE_DOCUMENT: true,
      RETURN_DOM: true,
    }) as unknown as HTMLElement;

    // Note that we extract links before removing elements, so
    // we don't miss links in the navigation or footer
    const linkElements = purifiedContent.querySelectorAll("a[href]");

    // Filter extracted links if requested
    let links: string[] = [];
    if (this.options.extractLinks !== false) {
      links = Array.from(linkElements)
        .map((el) => el.getAttribute("href"))
        .filter((href): href is string => href !== null)
        .map((href) => {
          try {
            return new URL(href, content.source).href;
          } catch {
            return null; // Invalid URL
          }
        })
        .filter((url): url is string => url !== null);
    }

    // Remove unwanted elements using selectorsToRemove
    const selectorsToRemove = [
      ...(this.options.excludeSelectors || []),
      ...this.selectorsToRemove,
    ];

    for (const selector of selectorsToRemove) {
      const elements = purifiedContent.querySelectorAll(selector);
      for (const el of elements) {
        el.remove();
      }
    }

    // Convert back to string
    const cleanedContent = purifiedContent.innerHTML;

    const markdown = this.turndownService.turndown(cleanedContent || "").trim();
    if (!markdown) {
      throw new ScraperError("No valid content found", false);
    }

    return {
      content: markdown,
      title,
      source: content.source,
      links,
      metadata: {},
    };
  }
}
