import { BM25Retriever } from "@langchain/community/retrievers/bm25";
import type { Document } from "@langchain/core/documents";
import { OpenAIEmbeddings } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import fs from "node:fs/promises";
import path from "node:path";
import semver from "semver";
import type {
  ProgressCallback,
  SearchResult,
  VersionInfo,
  VectorStoreProgress,
} from "../types";
import { logger } from "../utils/logger";

type MemoryVector = (typeof MemoryVectorStore.prototype.memoryVectors)[0];

export interface VectorStoreData {
  vectors: MemoryVector[];
}

export const STORE_FILENAME = "store.json";

export class VectorStoreManager {
  private readonly baseDir: string;
  private onProgress?: ProgressCallback<VectorStoreProgress>;

  constructor(
    baseDir: string,
    options?: { onProgress?: ProgressCallback<VectorStoreProgress> }
  ) {
    this.baseDir = baseDir;
    this.onProgress = options?.onProgress;
  }

  private createMemoryVectorStore(): MemoryVectorStore {
    return new MemoryVectorStore(
      new OpenAIEmbeddings({
        modelName: "text-embedding-3-small",
        stripNewLines: true,
        batchSize: 512,
      })
    );
  }

  // Modified helper function
  async listVersions(library: string): Promise<VersionInfo[]> {
    const libraryPath = path.join(this.baseDir, library);
    try {
      const versions = await fs.readdir(libraryPath);
      const validVersions = (
        await Promise.all(
          versions.map(async (v) => {
            if (!semver.valid(v)) return null;
            const fullPath = path.join(libraryPath, v);
            const storePath = path.join(fullPath, STORE_FILENAME);
            try {
              const stat = await fs.stat(fullPath);
              if (!stat.isDirectory()) return null;
              await fs.access(storePath);
              return { version: v, indexed: true };
            } catch {
              return { version: v, indexed: false };
            }
          })
        )
      ).filter((v): v is VersionInfo => v !== null);
      return validVersions;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  private getStorePath(library: string, version: string): string {
    return path.join(this.baseDir, library, version);
  }

  async loadStore(
    library: string,
    version: string
  ): Promise<MemoryVectorStore | null> {
    const storePath = this.getStorePath(library, version);
    const storeFile = path.join(storePath, STORE_FILENAME);

    try {
      const storeData = await fs.readFile(storeFile, "utf-8");
      const data = JSON.parse(storeData) as VectorStoreData;

      // Create a new store with the loaded vectors
      const store = this.createMemoryVectorStore();
      store.memoryVectors = data.vectors;
      return store;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  async createStore(
    library: string,
    version: string
  ): Promise<MemoryVectorStore> {
    logger.info(`💾 Creating store for ${library}@${version}`);
    const storePath = this.getStorePath(library, version);
    await fs.mkdir(storePath, { recursive: true });

    const store = this.createMemoryVectorStore();
    store.memoryVectors = [];

    // Save empty store to disk
    const serialized: VectorStoreData = {
      vectors: store.memoryVectors,
    };

    await fs.writeFile(
      path.join(storePath, STORE_FILENAME),
      JSON.stringify(serialized)
    );

    return store;
  }

  // Refactored findBestVersion
  async findBestVersion(
    library: string,
    targetVersion?: string
  ): Promise<string | null> {
    logger.info(
      `🔍 Finding best version for ${library}${targetVersion ? `@${targetVersion}` : ""}`
    );

    const validVersions = (await this.listVersions(library)).filter(
      (v) => v.indexed
    );

    if (validVersions.length === 0) {
      logger.warn(`⚠️ No valid versions found for ${library}`);
      return null;
    }

    if (targetVersion) {
      const versionRegex = /^(\d+)(?:\.(?:x(?:\.x)?|\d+(?:\.(?:x|\d+))?))?$|^$/;
      if (!versionRegex.test(targetVersion)) {
        logger.warn(`⚠️ Invalid version format: ${targetVersion}`);
        return null;
      }
    }

    const versionStrings = validVersions.map((v) => v.version);

    if (!targetVersion) {
      return semver.maxSatisfying(versionStrings, "*");
    }

    let range = targetVersion;

    if (!semver.validRange(targetVersion)) {
      range = `~${targetVersion}`;
    } else if (semver.valid(targetVersion)) {
      range = `${range} || <=${targetVersion}`;
    }

    const result = semver.maxSatisfying(versionStrings, range);
    if (result) {
      logger.info(`✅ Found version ${result} for ${library}@${targetVersion}`);
    } else {
      logger.warn(
        `⚠️ No matching version found for ${library}@${targetVersion}`
      );
    }

    return result || null;
  }

  async deleteStore(library: string, version: string): Promise<void> {
    logger.info(`🗑️ Deleting store for ${library}@${version}`);
    const storePath = this.getStorePath(library, version);
    const storeFile = path.join(storePath, STORE_FILENAME);
    try {
      await fs.unlink(storeFile);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
      // If file doesn't exist, that's fine - we wanted to delete it anyway
    }
  }

  async removeAllDocuments(store: MemoryVectorStore): Promise<void> {
    if (store.memoryVectors.length === 0) {
      return; // Already empty
    }

    // Get library and version from first document
    const firstDoc = store.memoryVectors[0];
    const library = firstDoc.metadata.library as string;
    const version = firstDoc.metadata.version as string;

    logger.info(`🗑️ Removing all documents from ${library}@${version} store`);

    // Clear memory vectors
    store.memoryVectors = [];

    // Save empty store
    const storePath = this.getStorePath(library, version);
    const serialized: VectorStoreData = { vectors: [] };
    await fs.writeFile(
      path.join(storePath, STORE_FILENAME),
      JSON.stringify(serialized)
    );
  }

  async addDocument(
    store: MemoryVectorStore,
    document: Document
  ): Promise<void> {
    logger.info(`📚 Adding document: ${document.metadata.title}`);
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 4000,
      chunkOverlap: 200,
      separators: ["\n\n", "\n", " ", ""], // Respect markdown structure
    });

    if (!document.pageContent.trim()) {
      throw new Error("Document content cannot be empty");
    }

    // Split document into smaller chunks
    const splitDocs = await splitter.splitDocuments([document]);
    logger.info(`📄 Split document into ${splitDocs.length} chunks`);

    // Report progress
    if (this.onProgress) {
      this.onProgress({
        documentsProcessed: 1,
        totalDocuments: 1,
        currentDocument: {
          title: document.metadata.title as string,
          numChunks: splitDocs.length,
        },
      });
    }

    // Add split documents to store
    await store.addDocuments(splitDocs);

    // Get library and version from first document in store
    const firstDoc = store.memoryVectors[0] || document;
    const library = firstDoc.metadata.library as string;
    const version = firstDoc.metadata.version as string;
    const storePath = this.getStorePath(library, version);

    const serialized: VectorStoreData = {
      vectors: store.memoryVectors,
    };

    await fs.writeFile(
      path.join(storePath, STORE_FILENAME),
      JSON.stringify(serialized)
    );
  }

  async searchStore(
    store: MemoryVectorStore,
    query: string,
    limit = 5
  ): Promise<SearchResult[]> {
    const retriever = store.asRetriever({
      k: limit * 2,
      searchType: "similarity",
    });
    const initialResults = await retriever.invoke(query);
    const rerankedResults = await BM25Retriever.fromDocuments(initialResults, {
      k: limit,
      includeScore: true,
    }).invoke(query);

    return rerankedResults.map((doc) => ({
      content: doc.pageContent,
      score: (doc.metadata.bm25Score as number) ?? 0,
      metadata: {
        url: doc.metadata.url as string,
        title: doc.metadata.title as string,
        library: doc.metadata.library as string,
        version: doc.metadata.version as string,
      },
    }));
  }

  async listLibraries(): Promise<
    Array<{
      library: string;
      versions: Array<{ version: string; indexed: boolean }>;
    }>
  > {
    try {
      const libraries = await fs.readdir(this.baseDir, { withFileTypes: true });
      const result = [];

      for (const entry of libraries) {
        if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
        const versions = await this.listVersions(entry.name);

        result.push({
          library: entry.name,
          versions: versions,
        });
      }

      return result;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }
}
