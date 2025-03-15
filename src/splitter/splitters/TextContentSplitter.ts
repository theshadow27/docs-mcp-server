import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import type {
  ContentChunk,
  ContentSplitter,
  ContentSplitterOptions,
} from "./types.js";
import { fullTrim } from "../../utils/string.js";
import { MinimumChunkSizeError } from "../errors.js";

/**
 * Splits text content using a hierarchical approach:
 * 1. Try splitting by paragraphs (double newlines)
 * 2. If chunks still too large, split by single newlines
 * 3. Finally, use word boundaries via LangChain's splitter
 */
export class TextContentSplitter implements ContentSplitter {
  constructor(private options: ContentSplitterOptions) {}

  /**
   * Splits text content into chunks while trying to preserve semantic boundaries.
   * Prefers paragraph breaks, then line breaks, finally falling back to word boundaries.
   */
  async split(
    content: string,
    metadata?: ContentChunk["metadata"]
  ): Promise<ContentChunk[]> {
    const trimmedContent = fullTrim(content);

    if (trimmedContent.length <= this.options.maxChunkSize) {
      return [{ content: trimmedContent, metadata }];
    }

    // Check for unsplittable content (e.g., a single word longer than maxChunkSize)
    const words = trimmedContent.split(/\s+/);
    const longestWord = words.reduce((max, word) =>
      word.length > max.length ? word : max
    );
    if (longestWord.length > this.options.maxChunkSize) {
      throw new MinimumChunkSizeError(
        longestWord.length,
        this.options.maxChunkSize
      );
    }

    // First try splitting by paragraphs (double newlines)
    const paragraphChunks = this.splitByParagraphs(trimmedContent);
    if (this.areChunksValid(paragraphChunks)) {
      // No merging for paragraph chunks; they are already semantically separated
      return paragraphChunks;
    }

    // If that doesn't work, try splitting by single newlines
    const lineChunks = this.splitByLines(trimmedContent);
    if (this.areChunksValid(lineChunks)) {
      return this.mergeChunks(lineChunks, "\n");
    }

    // Finally, fall back to word-based splitting using LangChain
    const wordChunks = await this.splitByWords(trimmedContent);
    return this.mergeChunks(wordChunks, " ");
  }

  /**
   * Checks if all chunks are within the maximum size limit
   */
  private areChunksValid(chunks: ContentChunk[]): boolean {
    return chunks.every(
      (chunk) => chunk.content.length <= this.options.maxChunkSize
    );
  }

  /**
   * Splits text into chunks by paragraph boundaries (double newlines)
   */
  private splitByParagraphs(text: string): ContentChunk[] {
    const paragraphs = text
      .split(/\n\s*\n/)
      .map((p) => fullTrim(p))
      .filter(Boolean);

    return paragraphs
      .map((content) => ({ content }))
      .filter((chunk) => chunk.content.length > 2);
  }

  /**
   * Splits text into chunks by line boundaries
   */
  private splitByLines(text: string): ContentChunk[] {
    const lines = text
      .split(/\n/)
      .map((line) => fullTrim(line))
      .filter(Boolean);

    return lines
      .map((content) => ({ content }))
      .filter((chunk) => chunk.content.length > 1);
  }

  /**
   * Uses LangChain's recursive splitter for word-based splitting as a last resort
   */
  private async splitByWords(text: string): Promise<ContentChunk[]> {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: this.options.maxChunkSize,
      chunkOverlap: 0,
    });

    const chunks = await splitter.splitText(text);
    return chunks.map((content) => ({ content, metadata: undefined }));
  }

  /**
   * Attempts to merge small chunks with previous chunks to minimize fragmentation.
   * Only merges if combined size is within maxChunkSize.
   */
  protected mergeChunks(
    chunks: ContentChunk[],
    separator: string
  ): ContentChunk[] {
    const mergedChunks: ContentChunk[] = [];
    let currentChunk: ContentChunk | null = null;

    for (const chunk of chunks) {
      if (currentChunk === null) {
        currentChunk = chunk;
        continue;
      }

      const currentChunkSize = this.getChunkSize(currentChunk);
      const nextChunkSize = this.getChunkSize(chunk);

      if (
        currentChunkSize + nextChunkSize + separator.length <=
        this.options.maxChunkSize
      ) {
        // Merge chunks
        currentChunk = {
          content: `${currentChunk.content}${separator}${chunk.content}`,
          metadata: currentChunk.metadata, // Simplification: keep first chunk's metadata
        };
      } else {
        // Add the current chunk to the result and start a new one
        mergedChunks.push(currentChunk);
        currentChunk = chunk;
      }
    }

    if (currentChunk) {
      mergedChunks.push(currentChunk);
    }

    return mergedChunks;
  }

  protected getChunkSize(chunk: ContentChunk): number {
    return chunk.content.length;
  }

  protected wrap(content: string, metadata?: ContentChunk["metadata"]): string {
    return content;
  }
}
