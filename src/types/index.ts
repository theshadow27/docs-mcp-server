export interface DocContent {
  content: string;
  metadata: {
    url: string;
    title: string;
    library: string;
    version: string;
  };
}

export interface ScraperConfig {
  url: string;
  library: string;
  version: string;
  maxPages: number;
  maxDepth: number;
  subpagesOnly?: boolean; // Only scrape pages under the initial URL path (default: true)
}

export interface PageResult {
  content: string;
  title: string;
  url: string;
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

interface BaseParams {
  library: string;
}

export interface SearchDocsParams extends BaseParams {
  version?: string;
  query: string;
  limit?: number;
}

export interface FetchDocsParams extends BaseParams {
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
}

export interface VectorStoreProgress {
  documentsProcessed: number;
  totalDocuments: number;
  currentDocument: {
    title: string;
    numChunks: number;
  };
}

export type ScrapingProgressCallback = (progress: ScrapingProgress) => void;
export interface ProgressResponse {
  content: { type: string; text: string }[];
}

export type VectorStoreProgressCallback = (
  progress: VectorStoreProgress
) => void;

export function isSearchDocsParams(obj: unknown): obj is SearchDocsParams {
  if (!obj || typeof obj !== "object") return false;

  const params = obj as Partial<SearchDocsParams>;
  return (
    typeof params.library === "string" &&
    typeof params.query === "string" &&
    (params.version === undefined || typeof params.version === "string") &&
    (params.limit === undefined || typeof params.limit === "number")
  );
}

export function isFetchDocsParams(obj: unknown): obj is FetchDocsParams {
  if (!obj || typeof obj !== "object") return false;

  const params = obj as Partial<FetchDocsParams>;
  const basicCheck =
    typeof params.library === "string" &&
    typeof params.version === "string" &&
    typeof params.url === "string";

  if (!basicCheck) return false;

  if (params.options) {
    const opts = params.options;
    return (
      (opts.maxPages === undefined || typeof opts.maxPages === "number") &&
      (opts.maxDepth === undefined || typeof opts.maxDepth === "number")
    );
  }

  return true;
}
