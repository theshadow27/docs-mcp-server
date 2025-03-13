import type { Document } from "@langchain/core/documents";
import {
  SemanticMarkdownSplitter,
  type MarkdownChunk,
  type ContentSegment,
} from "../splitter";
import semver from "semver";
import { BM25Retriever } from "@langchain/community/retrievers/bm25";
import type { SearchResult, VersionInfo } from "../types";
import { logger } from "../utils/logger";
import { DocumentStore } from "./DocumentStore";

/**
 * Provides semantic search capabilities across different versions of library documentation.
 */
export class VectorStoreService {
  private readonly store: DocumentStore;

  constructor() {
    const connectionString = process.env.POSTGRES_CONNECTION || "";
    if (!connectionString) {
      throw new Error("POSTGRES_CONNECTION environment variable is required");
    }
    this.store = new DocumentStore(connectionString);
  }

  async initialize(): Promise<void> {
    await this.store.initialize();
  }

  async shutdown(): Promise<void> {
    logger.info("🔌 Shutting down store manager");
    await this.store.shutdown();
  }

  /**
   * Returns a list of all available versions for a library.
   * Only returns versions that follow semver format.
   */
  async listVersions(library: string): Promise<VersionInfo[]> {
    const versions = await this.store.queryUniqueVersions(library);
    return versions
      .filter((v) => semver.valid(v))
      .map((version) => ({
        version,
        indexed: true,
      }));
  }

  async exists(library: string, version: string): Promise<boolean> {
    return this.store.checkDocumentExists(library, version);
  }

  /**
   * Finds the most appropriate version of documentation based on the requested version.
   * When no target version is specified, returns the latest version.
   *
   * Version matching behavior:
   * - Exact versions (e.g., "18.0.0"): Matches that version or any earlier version
   * - X-Range patterns (e.g., "5.x", "5.2.x"): Matches within the specified range
   * - No version: Returns the latest available version
   *
   * For documentation, we prefer matching older versions over no match at all,
   * since older docs are often still relevant and useful.
   */
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
    await this.store.deleteDocuments({ library, version });
  }

  async removeAllDocuments(library: string, version: string): Promise<void> {
    logger.info(`🗑️ Removing all documents from ${library}@${version} store`);
    await this.store.deleteDocuments({ library, version });
  }

  /**
   * Adds a document to the store, splitting it into smaller chunks for better search results.
   * Uses SemanticMarkdownSplitter to maintain markdown structure and content types during splitting.
   * Preserves hierarchical structure of documents and distinguishes between text and code segments.
   */
  async addDocument(
    library: string,
    version: string,
    document: Document
  ): Promise<void> {
    logger.info(`📚 Adding document: ${document.metadata.title}`);

    const splitter = new SemanticMarkdownSplitter({
      maxChunkSize: 4000,
      minChunkSize: 1000,
      includeHierarchy: true,
    });

    if (!document.pageContent.trim()) {
      throw new Error("Document content cannot be empty");
    }

    // Split document into semantic chunks
    const chunks = await splitter.splitText(document.pageContent);

    // Convert semantic chunks to documents
    const splitDocs = chunks.map((chunk: MarkdownChunk) => ({
      pageContent: chunk.segments
        .map((segment: ContentSegment) => {
          if (segment.type === "code") {
            return `\`\`\`${segment.language || ""}\n${segment.content}\n\`\`\``;
          }
          return segment.content;
        })
        .join("\n\n"),
      metadata: {
        ...document.metadata,
        hierarchy: chunk.hierarchy,
        level: chunk.level,
        title: chunk.metadata.title,
        path: chunk.metadata.path,
      },
    }));
    logger.info(`📄 Split document into ${splitDocs.length} chunks`);

    // Add split documents to store
    await this.store.addDocuments(splitDocs, { library, version });
  }

  /**
   * Searches for documentation content across versions.
   * Results are re-ranked using BM25 algorithm for improved relevance.
   */
  async searchStore(
    library: string,
    version: string,
    query: string,
    limit = 5
  ): Promise<SearchResult[]> {
    const results = await this.store.search(query, limit, { library, version });

    // Rerank with BM25
    const rerankedResults = await BM25Retriever.fromDocuments(results, {
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
        hierarchy: doc.metadata.hierarchy as string[],
        level: doc.metadata.level as number,
        path: doc.metadata.path as string[],
      },
    }));
  }

  async listLibraries(): Promise<
    Array<{
      library: string;
      versions: Array<{ version: string; indexed: boolean }>;
    }>
  > {
    const libraryMap = await this.store.queryLibraryVersions();
    return Array.from(libraryMap.entries()).map(([library, versions]) => ({
      library,
      versions: Array.from(versions).map((version) => ({
        version,
        indexed: true,
      })),
    }));
  }
}
