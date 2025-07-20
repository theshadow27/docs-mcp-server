import type { Document, ProgressCallback } from "../../types";
import { logger } from "../../utils/logger";
import { GitHubMarkdownFetcher } from "../fetcher";
import type { RawContent } from "../fetcher/types";
import { MarkdownPipeline } from "../pipelines/MarkdownPipeline";
import type { ProcessedContent } from "../pipelines/types";
import type { ScraperOptions, ScraperProgress } from "../types";
import { BaseScraperStrategy, type QueueItem } from "./BaseScraperStrategy";

/**
 * Strategy for fetching and processing GitHub repositories by directly accessing markdown files.
 * This bypasses HTML rendering and fetches raw markdown content from the repository.
 */
export class GitHubMarkdownStrategy extends BaseScraperStrategy {
  private readonly markdownFetcher = new GitHubMarkdownFetcher();
  private readonly markdownPipeline = new MarkdownPipeline();

  canHandle(url: string): boolean {
    return this.markdownFetcher.canFetch(url);
  }

  /**
   * For GitHub markdown mode, we fetch all markdown files at once,
   * so we only process the initial URL and don't follow links.
   */
  protected override async processItem(
    item: QueueItem,
    options: ScraperOptions,
    _progressCallback?: ProgressCallback<ScraperProgress>,
    signal?: AbortSignal,
  ): Promise<{ document?: Document; links?: string[] }> {
    const { url } = item;

    // Only process the root URL, skip any other URLs
    if (url !== options.url) {
      return { document: undefined, links: [] };
    }

    try {
      logger.info(`Fetching markdown files from GitHub repository: ${url}`);

      // Fetch all markdown content from the repository
      const fetchOptions = {
        signal,
        headers: options.headers,
      };

      const rawContent: RawContent = await this.markdownFetcher.fetch(url, fetchOptions);

      // Process through markdown pipeline
      const processed: ProcessedContent = await this.markdownPipeline.process(
        rawContent,
        options,
        this.markdownFetcher,
      );

      // Log any processing errors
      for (const err of processed.errors) {
        logger.warn(`Processing error for ${url}: ${err.message}`);
      }

      // Check if content processing resulted in usable content
      if (!processed.textContent || !processed.textContent.trim()) {
        logger.warn(`No processable content found for ${url} after pipeline execution.`);
        return { document: undefined, links: [] };
      }

      return {
        document: {
          content: processed.textContent,
          metadata: {
            url,
            title:
              typeof processed.metadata.title === "string"
                ? processed.metadata.title
                : `${options.library} Documentation`,
            library: options.library,
            version: options.version,
            source: "github-markdown",
            ...processed.metadata,
          },
        } satisfies Document,
        links: [], // Don't follow any links in GitHub markdown mode
      };
    } catch (error) {
      logger.error(`Failed processing GitHub repository ${url}: ${error}`);
      throw error;
    }
  }

  /**
   * Override to close the markdown pipeline after scraping.
   */
  override async scrape(
    options: ScraperOptions,
    progressCallback: ProgressCallback<ScraperProgress>,
    signal?: AbortSignal,
  ): Promise<void> {
    try {
      await super.scrape(options, progressCallback, signal);
    } finally {
      await this.markdownPipeline.close();
    }
  }
}
