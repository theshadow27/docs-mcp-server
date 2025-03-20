import type { DocumentStore } from "./DocumentStore";
import type { StoreSearchResult } from "./types";

const CHILD_LIMIT = 5;
const SIBLING_LIMIT = 2;

export class DocumentRetrieverService {
  private documentStore: DocumentStore;

  constructor(documentStore: DocumentStore) {
    this.documentStore = documentStore;
  }

  /**
   * Searches for documents and expands the context around the matches.
   * @param library The library name.
   * @param version The library version.
   * @param query The search query.
   * @param limit The optional limit for the initial search results.
   * @returns An array of strings representing the aggregated content of the retrieved chunks.
   */
  async search(
    library: string,
    version: string,
    query: string,
    limit?: number,
  ): Promise<StoreSearchResult[]> {
    const initialResults = await this.documentStore.findByContent(
      library,
      version,
      query,
      limit ?? 10,
    );

    const results: StoreSearchResult[] = [];

    for (const doc of initialResults) {
      const id = doc.id as string;
      let content = "";

      // Parent
      const parent = await this.documentStore.findParentChunk(library, version, id);
      if (parent) {
        content += `${parent.pageContent}\n\n`;
      }

      // Preceding Siblings
      const precedingSiblings = await this.documentStore.findPrecedingSiblingChunks(
        library,
        version,
        id,
        SIBLING_LIMIT,
      );
      content += `${precedingSiblings.map((d) => d.pageContent).join("\n\n")}\n\n`;

      // Initial Result
      content += `${doc.pageContent}`;

      // Child Chunks
      const childChunks = await this.documentStore.findChildChunks(
        library,
        version,
        id,
        CHILD_LIMIT,
      );
      content += `\n\n${childChunks.map((d) => d.pageContent).join("\n\n")}`;

      // Subsequent Siblings
      const subsequentSiblings = await this.documentStore.findSubsequentSiblingChunks(
        library,
        version,
        id,
        SIBLING_LIMIT,
      );
      content += `\n\n${subsequentSiblings.map((d) => d.pageContent).join("\n\n")}`;

      results.push({
        url: doc.metadata.url,
        content,
        score: doc.metadata.score,
      });
    }

    return results;
  }
}
