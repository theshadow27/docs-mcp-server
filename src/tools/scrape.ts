import path from "node:path";
import { homedir } from "node:os";
import { DocumentProcessingPipeline } from "../pipeline/DocumentProcessingPipeline";
import type { VectorStoreManager } from "../store";
import type { ProgressResponse, ScrapingProgress } from "../types";
import { logger } from "../utils/logger";

export interface ScrapeToolOptions {
  storeManager: VectorStoreManager;
  library: string;
  version: string;
  url: string;
  onProgress?: (response: ProgressResponse) => void;
  options?: {
    maxPages?: number;
    maxDepth?: number;
  };
}

export interface ScrapeResult {
  pagesScraped: number;
}

export const scrape = async (
  options: ScrapeToolOptions
): Promise<ScrapeResult> => {
  const {
    storeManager,
    library,
    version,
    url,
    onProgress,
    options: scraperOptions,
  } = options;

  // Initialize the store
  await storeManager.initialize();

  // Remove any existing documents for this library/version
  await storeManager.removeAllDocuments(library, version);
  logger.info(`💾 Using clean store for ${library}@${version}`);

  const pipeline = new DocumentProcessingPipeline(
    storeManager,
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
    onProgress: async (progress: ScrapingProgress) => {
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
    subpagesOnly: true,
  });

  // Return final statistics
  return {
    pagesScraped: currentPage,
  };
};
