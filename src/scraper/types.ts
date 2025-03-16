import type { Document } from "../types";
import type { ProgressCallback } from "../types";

/**
 * Strategy interface for implementing different scraping behaviors
 */
export interface ScraperStrategy {
  scrape(
    options: ScraperOptions,
    progressCallback?: ProgressCallback<ScraperProgress>,
  ): Promise<void>;
}

/**
 * Options for configuring the scraping process
 */
export interface ScraperOptions {
  url: string;
  library: string;
  version: string;
  maxPages: number;
  maxDepth: number;
  subpagesOnly?: boolean;
  maxConcurrency?: number;
}

/**
 * Result of scraping a single page. Used internally by HtmlScraper.
 */
export interface ScrapedPage {
  content: string;
  title: string;
  url: string;
  /** URLs extracted from page links, used for recursive scraping */
  links: string[];
}

/**
 * Progress information during scraping
 */
export interface ScraperProgress {
  pagesScraped: number;
  maxPages: number;
  currentUrl: string;
  depth: number;
  maxDepth: number;
  document?: Document;
}
