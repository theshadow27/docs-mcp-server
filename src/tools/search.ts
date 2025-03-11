import type { VectorStoreManager } from "../store/VectorStoreManager.js";
import type { SearchResult } from "../types/index.js";
import { logger } from "../utils/logger";

export interface SearchOptions {
  library: string;
  version: string;
  query: string;
  limit: number;
  store: VectorStoreManager;
}

export interface SearchToolResult {
  results: SearchResult[];
}

export const search = async (
  options: SearchOptions
): Promise<SearchToolResult> => {
  const { library, version, query, limit, store } = options;

  logger.info(`🔍 Searching ${library}@${version} for: ${query}`);

  try {
    // Load the vector store for this library/version
    const vectorStore = await store.loadStore(library, version);
    if (!vectorStore) {
      throw new Error(`No documentation found for ${library}@${version}`);
    }

    const results = await store.searchStore(vectorStore, query, limit);
    logger.info(`✅ Found ${results.length} matching results`);
    return { results };
  } catch (error) {
    logger.error(
      `❌ Search failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
    throw error;
  }
};
