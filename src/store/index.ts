import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { OpenAIEmbeddings } from "@langchain/openai";
import path from "node:path";
import fs from "node:fs/promises";
import semver from "semver";
import { logger } from "../utils/logger";
import type { SearchResult, VectorStoreProgressCallback } from "../types";
import type { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { BM25Retriever } from "@langchain/community/retrievers/bm25";

type MemoryVector = (typeof MemoryVectorStore.prototype.memoryVectors)[0];

interface VectorStoreData {
  vectors: MemoryVector[];
}

const STORE_FILENAME = "store.json";

export class VectorStoreManager {
  private readonly baseDir: string;
  private onProgress?: VectorStoreProgressCallback;

  constructor(
    baseDir: string,
    options?: { onProgress?: VectorStoreProgressCallback }
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

  private getStorePath(library: string, version: string): string {
    return path.join(this.baseDir, library, version);
  }

  async createStore(
    library: string,
    version: string
  ): Promise<MemoryVectorStore> {
    logger.info(`💾 Creating store for ${library}@${version}`);
    const storePath = this.getStorePath(library, version);
    await fs.mkdir(storePath, { recursive: true });

    return this.createMemoryVectorStore();
  }

  async findBestVersion(
    library: string,
    targetVersion?: string
  ): Promise<string | null> {
    logger.info(
      `🔍 Finding best version for ${library}${targetVersion ? `@${targetVersion}` : ""}`
    );
    try {
      const libraryPath = path.join(this.baseDir, library);
      const versions = await fs.readdir(libraryPath);

      // Check for valid version directories with store.json
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
              return v;
            } catch {
              return null;
            }
          })
        )
      ).filter((v): v is string => v !== null);

      if (validVersions.length === 0) {
        logger.warn(`⚠️ No valid versions found for ${library}`);
        return null;
      }

      const result = !targetVersion
        ? semver.maxSatisfying(validVersions, "*")
        : semver.maxSatisfying(validVersions, `<=${targetVersion}`);

      if (result) {
        logger.info(`✅ Found version ${result} for ${library}`);
      } else {
        logger.warn(
          `⚠️ No matching version found for ${library}${targetVersion ? `@${targetVersion}` : ""}`
        );
      }

      return result || null;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  async clearStore(library: string, version: string): Promise<void> {
    logger.info(`🗑️ Clearing store for ${library}@${version}`);
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

  async addDocument(
    library: string,
    version: string,
    document: Document
  ): Promise<void> {
    logger.info(
      `📚 Adding document: ${document.metadata.title} for ${library}@${version}`
    );
    const store = await this.createStore(library, version);
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

    const storePath = this.getStorePath(library, version);

    const serialized: VectorStoreData = {
      vectors: store.memoryVectors,
    };

    await fs.writeFile(
      path.join(storePath, STORE_FILENAME),
      JSON.stringify(serialized)
    );
  }

  async search(
    library: string,
    version: string,
    query: string,
    limit = 5
  ): Promise<SearchResult[]> {
    const storePath = this.getStorePath(library, version);
    const storeFile = path.join(storePath, STORE_FILENAME);

    try {
      const storeData = await fs.readFile(storeFile, "utf-8");
      const data = JSON.parse(storeData) as VectorStoreData;

      // Create a new store with the loaded vectors
      const store = this.createMemoryVectorStore();
      store.memoryVectors = data.vectors;

      const retriever = store.asRetriever({
        k: limit * 2,
        searchType: "similarity",
      });
      const initialResults = await retriever.invoke(query);
      const rerankedResults = await BM25Retriever.fromDocuments(
        initialResults,
        {
          k: limit,
          includeScore: true,
        }
      ).invoke(query);

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
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error(`No documentation found for ${library}@${version}`);
      }
      throw error;
    }
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
        const libraryPath = path.join(this.baseDir, entry.name);
        const versions = await fs.readdir(libraryPath, { withFileTypes: true });

        const versionDetails = await Promise.all(
          versions
            .map((v) => semver.coerce(v.name)?.version || null)
            .filter((v): v is string => v !== null)
            .map(async (v) => {
              const storePath = path.join(libraryPath, v, STORE_FILENAME);
              try {
                await fs.access(storePath);
                return { version: v, indexed: true };
              } catch {
                return { version: v, indexed: false };
              }
            })
        );

        result.push({
          library: entry.name,
          versions: versionDetails,
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
