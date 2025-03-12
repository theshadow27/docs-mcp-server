import type { VectorStoreService } from "../store/VectorStoreService.js";
import { logger } from "../utils/logger";

export interface ListLibrariesToolOptions {
  storeService: VectorStoreService;
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
  storeService: VectorStoreService;
  library: string;
  targetVersion?: string;
}

export const listLibraries = async (
  options: ListLibrariesToolOptions
): Promise<ListLibrariesResult> => {
  const { storeService } = options;
  const rawLibraries = await storeService.listLibraries();

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
  const { storeService, library, targetVersion } = options;
  return storeService.findBestVersion(library, targetVersion);
};
