import type { VectorStoreService } from "../store/VectorStoreService.js";
import { logger } from "../utils/logger";

export interface FindVersionToolOptions {
  library: string;
  targetVersion?: string;
}

/**
 * Tool for finding the best matching version of a library in the store.
 * Supports exact version matches and X-Range patterns (e.g., '5.x', '5.2.x').
 */
export class FindVersionTool {
  private storeService: VectorStoreService;

  constructor(storeService: VectorStoreService) {
    this.storeService = storeService;
  }

  async execute(options: FindVersionToolOptions): Promise<string | null> {
    const { library, targetVersion } = options;
    return this.storeService.findBestVersion(library, targetVersion);
  }
}
