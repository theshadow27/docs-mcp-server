import path from "node:path";
import { homedir } from "node:os";
import { DocumentProcessingPipeline } from "../pipeline/DocumentProcessingPipeline";
import { VectorStoreManager } from "../store";
import type {
  FetchDocsParams,
  ProgressResponse,
  ScrapingProgress,
} from "../types";
import { logger } from "../utils/logger";

const DEFAULT_DOCS_DIR = path.join(homedir(), ".docs-mcp-server");

interface ScrapeResult {
  pagesScraped: number;
}

export const scrape = async (
  params: FetchDocsParams,
  onProgress?: (response: ProgressResponse) => void
): Promise<ScrapeResult> => {
  const storeManager = new VectorStoreManager(DEFAULT_DOCS_DIR);

  // Create or load vector store
  const vectorStore =
    (await storeManager.loadStore(params.library, params.version)) ??
    (await storeManager.createStore(params.library, params.version));

  // Remove any existing documents
  await storeManager.removeAllDocuments(vectorStore);
  logger.info(`💾 Using clean store for ${params.library}@${params.version}`);

  const pipeline = new DocumentProcessingPipeline(storeManager, vectorStore);
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
    url: params.url,
    library: params.library,
    version: params.version,
    maxPages: params.options?.maxPages ?? 100,
    maxDepth: params.options?.maxDepth ?? 3,
    subpagesOnly: true,
  });

  // Return final statistics
  return {
    pagesScraped: currentPage,
  };
};
