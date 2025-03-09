import { DocumentationScraperDispatcher } from "../scraper/index.js";
import type { VectorStoreManager } from "../store/index.js";
import type {
  ScraperConfig,
  ScrapingProgress,
  ProgressResponse,
} from "../types/index.js";
import { Document } from "@langchain/core/documents";

export interface ScrapeOptions {
  url: string;
  library: string;
  version: string;
  maxPages: number;
  maxDepth: number;
  subpagesOnly?: boolean;
  store: VectorStoreManager;
  onProgress?: (progress: ScrapingProgress) => ProgressResponse | undefined;
}

export interface ScrapeResult {
  pagesScraped: number;
  documentsIndexed: number;
}

export const scrape = async (options: ScrapeOptions): Promise<ScrapeResult> => {
  const {
    url,
    library,
    version,
    maxPages,
    maxDepth,
    store,
    onProgress,
    subpagesOnly,
  } = options;

  const scraper = new DocumentationScraperDispatcher({
    onProgress,
  });

  const config: ScraperConfig = {
    url,
    library,
    version,
    maxPages,
    maxDepth,
    subpagesOnly,
  };

  const results = await scraper.scrape(config);

  let totalDocuments = 0;

  // Convert each result to a Document and add it to the store
  for (const result of results) {
    const doc = new Document({
      pageContent: result.content,
      metadata: {
        url: result.metadata.url,
        title: result.metadata.title,
        library,
        version,
      },
    });

    await store.addDocument(library, version, doc);
    totalDocuments++;
  }

  return {
    pagesScraped: results.length,
    documentsIndexed: totalDocuments,
  };
};
