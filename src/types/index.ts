/**
 * Metadata available during the scraping phase
 */
export interface ScraperMetadata {
  url: string;
  title: string;
  library: string;
  version: string;
}

export interface DocContent {
  content: string;
  metadata: ScraperMetadata;
}

export interface ScrapeOptions {
  url: string;
  library: string;
  version: string;
  maxPages: number;
  maxDepth: number;
  subpagesOnly?: boolean;
  maxConcurrency?: number;
}

export interface PageResult {
  content: string;
  title: string;
  url: string;
  /** URLs extracted from page links, used for recursive scraping */
  links: string[];
}

/**
 * Common metadata fields shared across document chunks
 */
export interface DocumentMetadata {
  url: string;
  title: string;
  library: string;
  version: string;
  hierarchy: string[];
  level: number;
  path: string[];
}

export interface SearchResult {
  content: string;
  score: number;
  metadata: DocumentMetadata;
}

export interface ScrapingProgress {
  pagesScraped: number;
  maxPages: number;
  currentUrl: string;
  depth: number;
  maxDepth: number;
  document?: DocContent;
}

export interface ProgressResponse {
  content: { type: string; text: string }[];
}

export type ProgressCallback<T> = (progress: T) => void | Promise<void>;

export interface DocumentPipelineCallbacks {
  onProgress?: (progress: ScrapingProgress) => Promise<void>;
  onError?: (error: Error, document?: DocContent) => Promise<void>;
}

export interface DocumentPipeline {
  process(options: ScrapeOptions): Promise<void>;
  setCallbacks(callbacks: DocumentPipelineCallbacks): void;
  stop(): Promise<void>;
}

export interface ScraperStrategy {
  scrape(
    options: ScrapeOptions,
    progressCallback?: ProgressCallback<ScrapingProgress>
  ): Promise<void>;
}

export interface VersionInfo {
  version: string;
  indexed: boolean;
}
