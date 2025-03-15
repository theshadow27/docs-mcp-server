/**
 * Common configuration options for content splitters
 */
export interface ContentSplitterOptions {
  /** Maximum characters per chunk */
  maxChunkSize: number;
}

/**
 * Represents a chunk of content with optional metadata
 */
export interface ContentChunk {
  /** The actual content */
  content: string;
  /** Content-specific metadata (e.g., language for code, headers for tables) */
  metadata?: {
    language?: string; // For code blocks
    headers?: string[]; // For table headers
    [key: string]: unknown; // For other metadata
  };
}

/**
 * Core interface for content splitters
 */
export interface ContentSplitter {
  /** Split content into chunks respecting size constraints */
  split(
    content: string,
    metadata?: ContentChunk["metadata"]
  ): Promise<ContentChunk[]>;
}
