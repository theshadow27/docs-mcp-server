import type { VectorStoreService } from "../store/VectorStoreService";
import { DocumentProcessingPipeline } from "../pipeline/DocumentProcessingPipeline";
import type { ProgressResponse } from "../types";
import type { ScraperProgress } from "../scraper/types";
import { logger } from "../utils/logger";

export interface ScrapeToolOptions {
  library: string;
  version: string;
  url: string;
  onProgress?: (response: ProgressResponse) => void;
  options?: {
    maxPages?: number;
    maxDepth?: number;
    maxConcurrency?: number;
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
  private storeService: VectorStoreService;

  constructor(storeService: VectorStoreService) {
    this.storeService = storeService;
  }

  async execute(options: ScrapeToolOptions): Promise<ScrapeResult> {
    const {
      library,
      version,
      url,
      onProgress,
      options: scraperOptions,
    } = options;

    // Initialize the store
    await this.storeService.initialize();

    // Remove any existing documents for this library/version
    await this.storeService.removeAllDocuments(library, version);
    logger.info(`💾 Using clean store for ${library}@${version}`);

    const pipeline = new DocumentProcessingPipeline(
      this.storeService,
      library,
      version
    );
    let currentPage = 0;

    const reportProgress = (text: string) => {
      if (onProgress) {
        onProgress({
          content: [{ type: "text", text }],
        });
      }
    };

    pipeline.setCallbacks({
      onProgress: async (progress: ScraperProgress) => {
        if (progress.pagesScraped > currentPage) {
          currentPage = progress.pagesScraped;
          reportProgress(
            `🌐 Indexed page ${currentPage}/${progress.maxPages}: ${progress.currentUrl}`
          );
        }
      },
      onError: async (error, doc) => {
        reportProgress(
          `❌ Error processing ${doc?.metadata.title ?? "document"}: ${error.message}`
        );
      },
    });

    // Start processing with config
    await pipeline.process({
      url: url,
      library: library,
      version: version,
      maxPages: scraperOptions?.maxPages ?? 100,
      maxDepth: scraperOptions?.maxDepth ?? 3,
      maxConcurrency: scraperOptions?.maxConcurrency ?? 3,
      subpagesOnly: true,
    });

    // Return final statistics
    return {
      pagesScraped: currentPage,
    };
  }
}
