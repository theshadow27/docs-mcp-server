import type { DocumentMetadata } from "../types";

/**
 * Search result combining content with metadata and relevance score
 */
export interface StoreSearchResult {
	content: string;
	score: number;
	metadata: DocumentMetadata;
}

/**
 * Version information for a library
 */
export interface LibraryVersion {
	version: string;
	indexed: boolean;
}
