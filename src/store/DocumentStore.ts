import type { Document } from "@langchain/core/documents";
import { OpenAIEmbeddings } from "@langchain/openai";
import pg from "pg";
import { ConnectionError, StoreError } from "./errors";

/**
 * Manages document storage and retrieval using pgvector for vector similarity search.
 * Provides an abstraction layer over PostgreSQL with vector extensions to store and
 * query document embeddings along with their metadata. Supports versioned storage
 * of documents for different libraries, enabling version-specific document retrieval
 * and searches.
 */
export class DocumentStore {
  private readonly pool: pg.Pool;
  private embeddings: OpenAIEmbeddings;

  constructor(connectionString: string) {
    if (!connectionString) {
      throw new StoreError("Missing required environment variable: POSTGRES_CONNECTION");
    }
    this.pool = new pg.Pool(this.parseConnectionString(connectionString));
    this.embeddings = new OpenAIEmbeddings({
      modelName: "text-embedding-3-small",
      stripNewLines: true,
      batchSize: 512,
    });
  }

  private parseConnectionString(connectionString: string): pg.PoolConfig {
    const url = new URL(connectionString);
    return {
      type: "postgres",
      host: url.hostname,
      port: Number.parseInt(url.port) || 5432,
      user: url.username,
      password: url.password,
      database: url.pathname.slice(1),
    } as pg.PoolConfig;
  }

  /**
   * Initializes database connection and ensures readiness
   */
  async initialize(): Promise<void> {
    try {
      await this.pool.query("SELECT 1");
    } catch (error) {
      throw new ConnectionError(
        "Failed to initialize database connection",
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Gracefully closes database connections
   */
  async shutdown(): Promise<void> {
    await this.pool.end();
  }

  /**
   * Retrieves all unique versions for a specific library
   */
  async queryUniqueVersions(library: string): Promise<string[]> {
    try {
      const result = await this.pool.query(
        "SELECT DISTINCT version FROM documents WHERE library = $1",
        [library],
      );
      return result.rows.map((row) => row.version);
    } catch (error) {
      throw new ConnectionError(
        "Failed to query versions",
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Verifies existence of documents for a specific library version
   */
  async checkDocumentExists(library: string, version: string): Promise<boolean> {
    try {
      const result = await this.pool.query(
        "SELECT EXISTS(SELECT 1 FROM documents WHERE library = $1 AND version = $2)",
        [library, version],
      );
      return result.rows[0].exists;
    } catch (error) {
      throw new ConnectionError(
        "Failed to check document existence",
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Retrieves a mapping of all libraries to their available versions
   */
  async queryLibraryVersions(): Promise<Map<string, Set<string>>> {
    interface QueryResult {
      library: string;
      version: string;
    }
    try {
      const result = await this.pool.query<QueryResult>(
        "SELECT DISTINCT library, version FROM documents",
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
    } catch (error) {
      throw new ConnectionError(
        "Failed to query library versions",
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Stores documents with library and version metadata, generating embeddings
   * for vector similarity search
   */
  async addDocuments(
    library: string,
    version: string,
    documents: Document[],
  ): Promise<void> {
    try {
      // Generate embeddings in batch
      const texts = documents.map((doc) => doc.pageContent);
      const embeddings = await this.embeddings.embedDocuments(texts);

      // Add documents using SQL function
      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];
        // Convert embedding array to PostgreSQL vector format
        const vectorStr = `[${embeddings[i].join(",")}]`;
        const url = doc.metadata.url as string;
        if (!url || typeof url !== "string" || !url.trim()) {
          throw new StoreError("Document metadata must include a valid URL");
        }

        await this.pool.query("SELECT add_document($1, $2, $3, $4, $5, $6)", [
          library,
          version,
          url,
          doc.pageContent,
          doc.metadata,
          vectorStr,
        ]);
      }
    } catch (error) {
      throw new ConnectionError(
        "Failed to add documents to store",
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Removes documents matching specified library and version
   */
  /**
   * Removes documents matching specified library and version
   * @returns Number of documents deleted
   */
  async deleteDocuments(library: string, version: string): Promise<number> {
    try {
      const result = await this.pool.query<{ delete_documents: number }>(
        "SELECT delete_documents($1, $2)",
        [library, version],
      );
      return result.rows[0].delete_documents;
    } catch (error) {
      throw new ConnectionError(
        "Failed to delete documents",
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Performs similarity search on stored documents within specified library version
   */
  async search(
    library: string,
    version: string,
    query: string,
    limit: number,
  ): Promise<Document[]> {
    try {
      // Generate query embedding for vector search
      const embedding = await this.embeddings.embedQuery(query);

      // Convert embedding array to PostgreSQL vector format
      const vectorStr = `[${embedding.join(",")}]`;

      const result = await this.pool.query(
        "SELECT * FROM search_documents($1, $2, $3, $4, $5)",
        [library, version, query, vectorStr, limit],
      );

      return result.rows.map((row) => ({
        pageContent: row.content,
        metadata: {
          ...row.metadata,
          score: row.similarity,
        },
      }));
    } catch (error) {
      throw new ConnectionError(
        "Failed to search documents",
        error instanceof Error ? error : undefined,
      );
    }
  }
}
