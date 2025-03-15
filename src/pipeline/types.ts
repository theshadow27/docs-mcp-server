import type {
  ScrapedDocument,
  ScraperOptions,
  ScraperProgress,
} from "../scraper/types";

/**
 * Interface for document processing pipeline implementations
 */
export interface DocumentPipeline {
  process(options: ScraperOptions): Promise<void>;
  setCallbacks(callbacks: DocumentPipelineCallbacks): void;
  stop(): Promise<void>;
}

/**
 * Callbacks for pipeline progress and error handling
 */
export interface DocumentPipelineCallbacks {
  onProgress?: (progress: ScraperProgress) => Promise<void>;
  onError?: (error: Error, document?: ScrapedDocument) => Promise<void>;
}
