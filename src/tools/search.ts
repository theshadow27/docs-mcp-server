import type { VectorStoreManager } from "../store/index.js";
import type { SearchResult } from "../types/index.js";

export interface SearchOptions {
  library: string;
  version: string;
  query: string;
  limit: number;
  store: VectorStoreManager;
}

export interface SearchToolResult {
  results: SearchResult[];
}

export const search = async (
  options: SearchOptions
): Promise<SearchToolResult> => {
  const { library, version, query, limit, store } = options;

  const results = await store.search(library, version, query, limit);

  return {
    results,
  };
};
