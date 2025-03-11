export interface DocContent {
  content: string;
  metadata: {
    url: string;
    title: string;
    library: string;
    version: string;
  };
}

export interface ScrapeOptions {
  url: string;
  library: string;
  version: string;
  maxPages: number;
  maxDepth: number;
  subpagesOnly?: boolean;
}

export interface PageResult {
  content: string;
  title: string;
  url: string;
  /** URLs extracted from page links, used for recursive scraping */
  links: string[];
}

export interface SearchResult {
  content: string;
  score: number;
  metadata: {
    url: string;
    title: string;
    library: string;
    version: string;
  };
}

export class NoLocalDocsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NoLocalDocsError";
  }
}

export class StoreNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoreNotFoundError";
  }
}

export interface SearchDocsParams {
  library: string;
  version?: string;
  query: string;
  limit?: number;
}

export interface FetchDocsParams {
  library: string;
  version: string;
  url: string;
  options?: {
    maxPages?: number;
    maxDepth?: number;
  };
}

export interface ScrapingProgress {
  pagesScraped: number;
  maxPages: number;
  currentUrl: string;
  depth: number;
  maxDepth: number;
  document?: DocContent;
}

export interface VectorStoreProgress {
  documentsProcessed: number;
  totalDocuments: number;
  currentDocument: {
    title: string;
    numChunks: number;
  };
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
