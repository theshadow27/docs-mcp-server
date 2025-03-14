import type { VectorStoreService } from "../store";
import type { StoreSearchResult } from "../store/types";
import { VersionNotFoundError } from "./errors";
import { logger } from "../utils/logger";

export interface SearchToolOptions {
  library: string;
  version: string;
  query: string;
  limit: number;
  exactMatch?: boolean;
}

export interface SearchToolResult {
  results: StoreSearchResult[];
  error?: {
    message: string;
    availableVersions: Array<{ version: string; indexed: boolean }>;
  };
}

/**
 * Tool for searching indexed documentation.
 * Supports exact version matches and version range patterns.
 * Returns available versions when requested version is not found.
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
      const bestVersion = exactMatch
        ? version
        : await this.storeService.findBestVersion(library, version);

      const results = await this.storeService.searchStore(
        library,
        bestVersion,
        query,
        limit
      );
      logger.info(`✅ Found ${results.length} matching results`);

      return { results };
    } catch (error) {
      if (error instanceof VersionNotFoundError) {
        logger.info(`ℹ️ Version not found: ${error.message}`);
        return {
          results: [],
          error: {
            message: error.message,
            availableVersions: error.availableVersions,
          },
        };
      }

      logger.error(
        `❌ Search failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      throw error;
    }
  }
}
