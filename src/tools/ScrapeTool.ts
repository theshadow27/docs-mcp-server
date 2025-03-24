import { DocumentProcessingPipeline } from "../pipeline/DocumentProcessingPipeline";
import type { ScraperProgress } from "../scraper/types";
import type { DocumentManagementService } from "../store/DocumentManagementService";
import type { ProgressResponse } from "../types";
import { logger } from "../utils/logger";
import * as semver from "semver";

export interface ScrapeToolOptions {
  library: string;
  version: string;
  url: string;
  onProgress?: (response: ProgressResponse) => void;
  options?: {
    maxPages?: number;
    maxDepth?: number;
    maxConcurrency?: number;
    ignoreErrors?: boolean;
  };
}

export interface ScrapeResult {
  pagesScraped: number;
}

/**
 * Tool for scraping and indexing documentation from a URL.
 * Handles initialization of document processing pipeline and progress reporting.
 */
export class ScrapeTool {
  private docService: DocumentManagementService;

  constructor(docService: DocumentManagementService) {
    this.docService = docService;
  }

  async execute(options: ScrapeToolOptions): Promise<ScrapeResult> {
    const { library, version, url, onProgress, options: scraperOptions } = options;

    // Initialize the store
    await this.docService.initialize();

    // Remove any existing documents for this library/version
    const normalizedVersion = semver.valid(semver.coerce(version));
    if (!normalizedVersion) {
      throw new Error(`Invalid version: ${version}`);
    }

    await this.docService.removeAllDocuments(library, normalizedVersion);
    logger.info(`💾 Using clean store for ${library}@${normalizedVersion}`);

    const pipeline = new DocumentProcessingPipeline(
      this.docService,
      library,
      normalizedVersion,
    );
    let pagesScraped = 0;

    const reportProgress = (text: string) => {
      if (onProgress) {
        onProgress({
          content: [{ type: "text", text }],
        });
      }
    };

    pipeline.setCallbacks({
      onProgress: async (progress: ScraperProgress) => {
        reportProgress(
          `🌐 Indexed page ${progress.pagesScraped}/${progress.maxPages}: ${progress.currentUrl}`,
        );
        if (progress.pagesScraped > pagesScraped) {
          pagesScraped = progress.pagesScraped;
        }
      },
      onError: async (error, doc) => {
        reportProgress(
          `❌ Error processing ${doc?.metadata.title ?? "document"}: ${error.message}`,
        );
      },
    });

    // Start processing with config
    await pipeline.process({
      url: url,
      library: library,
      version: normalizedVersion,
      subpagesOnly: true,
      maxPages: scraperOptions?.maxPages ?? 100,
      maxDepth: scraperOptions?.maxDepth ?? 3,
      maxConcurrency: scraperOptions?.maxConcurrency ?? 3,
      ignoreErrors: scraperOptions?.ignoreErrors ?? true,
    });

    // Return final statistics
    return {
      pagesScraped,
    };
  }
}
