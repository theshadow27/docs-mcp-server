import type { VectorStoreService } from "../store/VectorStoreService.js";
import type { SearchResult } from "../types/index.js";
import { logger } from "../utils/logger";

export interface SearchToolOptions {
  library: string;
  version: string;
  query: string;
  limit: number;
  exactMatch?: boolean;
}

export interface SearchToolResult {
  results: SearchResult[];
}

/**
 * Tool for searching indexed documentation.
 * Supports exact version matches and version range patterns.
 */
export class SearchTool {
  private storeService: VectorStoreService;

  constructor(storeService: VectorStoreService) {
    this.storeService = storeService;
  }

  async execute(options: SearchToolOptions): Promise<SearchToolResult> {
    const { library, version, query, limit, exactMatch = false } = options;

    logger.info(
      `🔍 Searching ${library}@${version} for: ${query}${exactMatch ? " (exact match)" : ""}`
    );

    try {
      // If not exact match, find best matching version
      const bestVersion = exactMatch
        ? version
        : await this.storeService.findBestVersion(library, version);
      if (!bestVersion) {
        throw new Error(`No documentation found for ${library}@${version}`);
      }

      const results = await this.storeService.searchStore(
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
  }
}
