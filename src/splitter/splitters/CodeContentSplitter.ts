import { MinimumChunkSizeError } from "../errors";
import type {
  ContentChunk,
  ContentSplitter,
  ContentSplitterOptions,
} from "./types";

/**
 * Splits code content while preserving language information and formatting.
 * Uses line boundaries for splitting and ensures each chunk is properly
 * wrapped with language-specific code block markers.
 */
export class CodeContentSplitter implements ContentSplitter {
  constructor(private options: ContentSplitterOptions) {}

  async split(
    content: string,
    metadata?: { language?: string }
  ): Promise<ContentChunk[]> {
    const lines = content.split("\n");
    if (lines.length > 0) {
      // Check if a single line with code block markers exceeds maxChunkSize
      const singleLineSize = this.wrap(lines[0], metadata).length;
      if (singleLineSize > this.options.maxChunkSize) {
        throw new MinimumChunkSizeError(
          singleLineSize,
          this.options.maxChunkSize
        );
      }
    }

    const chunks: ContentChunk[] = [];
    let currentChunkLines: string[] = [];
    const language = metadata?.language || "";

    for (const line of lines) {
      currentChunkLines.push(line);
      const newChunkContent = this.wrap(currentChunkLines.join("\n"), metadata);
      const newChunkSize = newChunkContent.length;

      if (
        newChunkSize > this.options.maxChunkSize &&
        currentChunkLines.length > 1
      ) {
        // remove last item
        const lastLine = currentChunkLines.pop();
        // wrap content and create chunk
        chunks.push({
          content: this.wrap(currentChunkLines.join("\n"), metadata),
          metadata,
        });
        currentChunkLines = [lastLine as string];
      }
    }

    if (currentChunkLines.length > 0) {
      chunks.push({
        content: this.wrap(currentChunkLines.join("\n"), metadata),
        metadata,
      });
    }

    return chunks;
  }

  protected wrap(content: string, metadata?: { language?: string }): string {
    const language = metadata?.language || "";
    return `\`\`\`${language}\n${content.replace(/\n+$/, "")}\n\`\`\``;
  }
}
