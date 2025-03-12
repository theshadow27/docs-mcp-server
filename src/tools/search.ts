import type { VectorStoreManager } from "../store/VectorStoreManager.js";
import type { SearchResult } from "../types/index.js";
import { logger } from "../utils/logger";

export interface SearchToolOptions {
  library: string;
  version: string;
  query: string;
  limit: number;
  storeManager: VectorStoreManager;
}

export interface SearchToolResult {
  results: SearchResult[];
}

export const search = async (
  options: SearchToolOptions
): Promise<SearchToolResult> => {
  const { library, version, query, limit, storeManager } = options;

  logger.info(`🔍 Searching ${library}@${version} for: ${query}`);

  try {
    const exists = await storeManager.exists(library, version);
    if (!exists) {
      throw new Error(`No documentation found for ${library}@${version}`);
    }

    const results = await storeManager.searchStore(
      library,
      version,
      query,
      limit
    );
    logger.info(`✅ Found ${results.length} matching results`);

    return { results };
  } catch (error) {
    logger.error(
      `❌ Search failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
    throw error;
  }
};
