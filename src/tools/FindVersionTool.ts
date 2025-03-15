import type { VectorStoreService } from "../store";
import { logger } from "../utils/logger";
import { VersionNotFoundError } from "./errors";

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

		try {
			return await this.storeService.findBestVersion(library, targetVersion);
		} catch (error) {
			if (error instanceof VersionNotFoundError) {
				logger.info(`ℹ️ Version not found: ${error.message}`);
				return null;
			}
			throw error;
		}
	}
}
