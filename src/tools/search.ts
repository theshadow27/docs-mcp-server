import type { VectorStoreService } from "../store/VectorStoreService.js";
import type { SearchResult } from "../types/index.js";
import { logger } from "../utils/logger";

export interface SearchToolOptions {
  library: string;
  version: string;
  query: string;
  limit: number;
  storeService: VectorStoreService;
}

export interface SearchToolResult {
  results: SearchResult[];
}

export const search = async (
  options: SearchToolOptions
): Promise<SearchToolResult> => {
  const { library, version, query, limit, storeService } = options;

  logger.info(`🔍 Searching ${library}@${version} for: ${query}`);

  try {
    const exists = await storeService.exists(library, version);
    if (!exists) {
      throw new Error(`No documentation found for ${library}@${version}`);
    }

    const results = await storeService.searchStore(
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
