import type { VectorStoreManager } from "../store/VectorStoreManager.js";
import { logger } from "../utils/logger";

export interface ListLibrariesToolOptions {
  storeManager: VectorStoreManager;
}

export interface LibraryVersion {
  version: string;
  indexed: boolean;
}

export interface LibraryInfo {
  name: string;
  versions: LibraryVersion[];
}

export interface ListLibrariesResult {
  libraries: LibraryInfo[];
}

export interface FindVersionToolOptions {
  storeManager: VectorStoreManager;
  library: string;
  targetVersion?: string;
}

export const listLibraries = async (
  options: ListLibrariesToolOptions
): Promise<ListLibrariesResult> => {
  const { storeManager } = options;
  const rawLibraries = await storeManager.listLibraries();

  const libraries = rawLibraries.map(({ library, versions }) => ({
    name: library,
    versions: versions.map((v) => ({
      version: v.version,
      indexed: v.indexed,
    })),
  }));

  return { libraries };
};

export const findVersion = async (
  options: FindVersionToolOptions
): Promise<string | null> => {
  const { storeManager: store, library, targetVersion } = options;
  return store.findBestVersion(library, targetVersion);
};
