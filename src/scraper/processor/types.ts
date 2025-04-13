import type { RawContent } from "../fetcher/types";

export type { RawContent };

/**
 * Processed content in normalized form (markdown)
 * with extracted metadata and references
 */
export interface ProcessedContent {
  /** Content normalized to markdown format */
  content: string;
  /** Title extracted from content */
  title: string;
  /** Original source location */
  source: string;
  /** Links found in the content */
  links: string[];
  /** Additional metadata extracted during processing */
  metadata: Record<string, unknown>;
}

/**
 * Interface for processing raw content into normalized form
 */
export interface ContentProcessor {
  /**
   * Check if this processor can handle the given content type
   */
  canProcess(content: RawContent): boolean;

  /**
   * Process raw content into normalized form
   */
  process(content: RawContent): Promise<ProcessedContent>;

  /**
   * Optional hook for pre-processing content
   */
  preProcess?(content: RawContent): Promise<RawContent>;

  /**
   * Optional hook for post-processing content
   */
  postProcess?(content: ProcessedContent): Promise<ProcessedContent>;
}
