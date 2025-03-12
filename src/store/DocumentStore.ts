import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
import type { Document } from "@langchain/core/documents";
import { OpenAIEmbeddings } from "@langchain/openai";
import type { PoolConfig } from "pg";
import { Pool } from "pg";

export class DocumentStore {
  private readonly pool: Pool;
  private vectorStore: PGVectorStore | null = null;

  constructor(connectionString: string) {
    if (!connectionString) {
      throw new Error("Connection string is required");
    }
    this.pool = new Pool(this.parseConnectionString(connectionString));
  }

  private parseConnectionString(connectionString: string): PoolConfig {
    const url = new URL(connectionString);
    return {
      type: "postgres",
      host: url.hostname,
      port: Number.parseInt(url.port) || 5432,
      user: url.username,
      password: url.password,
      database: url.pathname.slice(1),
    } as PoolConfig;
  }

  async initialize(): Promise<void> {
    if (!this.vectorStore) {
      this.vectorStore = await this.createVectorStore();
    }
  }

  async shutdown(): Promise<void> {
    await this.pool.end();
    this.vectorStore = null;
  }

  private async createVectorStore(): Promise<PGVectorStore> {
    return PGVectorStore.initialize(
      new OpenAIEmbeddings({
        modelName: "text-embedding-3-small",
        stripNewLines: true,
        batchSize: 512,
      }),
      {
        pool: this.pool,
        tableName: "documents",
        columns: {
          idColumnName: "id",
          vectorColumnName: "embedding",
          contentColumnName: "content",
          metadataColumnName: "metadata",
        },
        distanceStrategy: "cosine",
      }
    );
  }

  async queryUniqueVersions(library: string): Promise<string[]> {
    const result = await this.pool.query(
      "SELECT DISTINCT metadata->>'version' as version FROM documents WHERE metadata->>'library' = $1",
      [library]
    );
    return result.rows.map((row) => row.version);
  }

  async checkDocumentExists(
    library: string,
    version: string
  ): Promise<boolean> {
    const result = await this.pool.query(
      "SELECT EXISTS(SELECT 1 FROM documents WHERE metadata->>'library' = $1 AND metadata->>'version' = $2)",
      [library, version]
    );
    return result.rows[0].exists;
  }

  async queryLibraryVersions(): Promise<Map<string, Set<string>>> {
    const result = await this.pool.query(
      "SELECT DISTINCT metadata->>'library' as library, metadata->>'version' as version FROM documents"
    );
    const libraryMap = new Map<string, Set<string>>();

    for (const row of result.rows) {
      const library = row.library;
      const version = row.version;

      if (!libraryMap.has(library)) {
        libraryMap.set(library, new Set());
      }
      libraryMap.get(library)?.add(version);
    }

    return libraryMap;
  }

  async addDocuments(
    documents: Document[],
    filter: { library: string; version: string }
  ): Promise<void> {
    if (!this.vectorStore) {
      throw new Error("Store not initialized");
    }

    // Add library/version to each document's metadata
    const docsWithMetadata = documents.map((doc) => ({
      ...doc,
      metadata: {
        ...doc.metadata,
        library: filter.library,
        version: filter.version,
      },
    }));

    await this.vectorStore.addDocuments(docsWithMetadata);
  }

  async deleteDocuments(filter: {
    library: string;
    version: string;
  }): Promise<void> {
    if (!this.vectorStore) {
      throw new Error("Store not initialized");
    }
    await this.vectorStore.delete({ filter });
  }

  async search(
    query: string,
    limit: number,
    filter: { library: string; version: string }
  ): Promise<Document[]> {
    if (!this.vectorStore) {
      throw new Error("Store not initialized");
    }
    return this.vectorStore.similaritySearch(query, limit * 2, filter);
  }
}
