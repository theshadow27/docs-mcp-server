import type { VectorStoreManager } from "../store/index.js";
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
    const results = await store.search(library, version, query, limit);
    logger.info(`✅ Found ${results.length} matching results`);
    return { results };
  } catch (error) {
    logger.error(
      `❌ Search failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
    throw error;
  }
};
