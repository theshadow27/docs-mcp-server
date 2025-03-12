import type { VectorStoreService } from "../store/VectorStoreService.js";
import type { SearchResult } from "../types/index.js";
import { logger } from "../utils/logger";

export interface SearchToolOptions {
  library: string;
  version: string;
  query: string;
  limit: number;
  exactMatch?: boolean;
  storeService: VectorStoreService;
}

export interface SearchToolResult {
  results: SearchResult[];
}

export const search = async (
  options: SearchToolOptions
): Promise<SearchToolResult> => {
  const {
    library,
    version,
    query,
    limit,
    exactMatch = false,
    storeService,
  } = options;

  logger.info(
    `🔍 Searching ${library}@${version} for: ${query}${exactMatch ? " (exact match)" : ""}`
  );

  try {
    // If not exact match, find best matching version
    const bestVersion = exactMatch
      ? version
      : await storeService.findBestVersion(library, version);
    if (!bestVersion) {
      throw new Error(`No documentation found for ${library}@${version}`);
    }

    const results = await storeService.searchStore(
      library,
      bestVersion,
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
