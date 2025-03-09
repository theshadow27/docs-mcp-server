import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { OpenAIEmbeddings } from "@langchain/openai";
import path from "node:path";
import fs from "node:fs/promises";
import semver from "semver";
import type { SearchResult, VectorStoreProgressCallback } from "../types";
import type { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { BM25Retriever } from "@langchain/community/retrievers/bm25";

type MemoryVector = (typeof MemoryVectorStore.prototype.memoryVectors)[0];

interface VectorStoreData {
  vectors: MemoryVector[];
}

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
    const storePath = this.getStorePath(library, version);
    await fs.mkdir(storePath, { recursive: true });

    return this.createMemoryVectorStore();
  }

  async findBestVersion(
    library: string,
    targetVersion?: string
  ): Promise<string | null> {
    try {
      const libraryPath = path.join(this.baseDir, library);
      const versions = await fs.readdir(libraryPath);

      // Check for valid version directories with store.json
      const validVersions = (
        await Promise.all(
          versions.map(async (v) => {
            if (!semver.valid(v)) return null;
            const fullPath = path.join(libraryPath, v);
            const storePath = path.join(fullPath, "store.json");
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

      if (validVersions.length === 0) return null;

      if (!targetVersion) {
        return semver.maxSatisfying(validVersions, "*") || null;
      }

      return semver.maxSatisfying(validVersions, `<=${targetVersion}`) || null;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  async addDocument(
    library: string,
    version: string,
    document: Document
  ): Promise<void> {
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
      path.join(storePath, "store.json"),
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
    const storeFile = path.join(storePath, "store.json");

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
      const results = await retriever.invoke(query);
      const rerankedResults = await BM25Retriever.fromDocuments(results, {
        k: limit,
        includeScore: true,
      }).invoke(query);

      return rerankedResults.map((doc) => ({
        content: doc.pageContent,
        score: (doc.metadata.bm25Score as number) ?? 0,
        metadata: {
          url: doc.metadata.url,
          title: doc.metadata.title,
          library: doc.metadata.library,
          version: doc.metadata.version,
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
              const storePath = path.join(libraryPath, v, "store.json");
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
