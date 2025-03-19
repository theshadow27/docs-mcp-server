import { ScraperError } from "../../utils/errors";
import type { RawContent } from "../fetcher/types";
import type { ContentProcessor, ProcessedContent } from "./types";

/**
 * Processes Markdown content, validates it. In the future, could
 * add normalization or other Markdown-specific features.
 */
export class MarkdownProcessor implements ContentProcessor {
  canProcess(content: RawContent): boolean {
    return (
      content.mimeType === "text/markdown" ||
      content.mimeType === "text/plain" || // Treat plain text as markdown
      content.source.endsWith(".md")
    );
  }

  async process(content: RawContent): Promise<ProcessedContent> {
    if (!this.canProcess(content)) {
      throw new ScraperError(
        `MarkdownProcessor cannot process content of type ${content.mimeType}`,
        false,
      );
    }

    const markdownContent =
      typeof content.content === "string"
        ? content.content
        : content.content.toString((content.encoding as BufferEncoding) || "utf-8");

    // Basic Markdown validation (for now, just check if it's not empty)
    if (!markdownContent.trim()) {
      throw new ScraperError("Empty Markdown content", false);
    }

    // TODO: Extract title from Markdown (e.g., first H1)
    const title = this.extractTitle(markdownContent) || "Untitled";

    return {
      content: markdownContent,
      title,
      source: content.source,
      links: [], // TODO: Extract links from Markdown
      metadata: {},
    };
  }

  private extractTitle(markdown: string): string | null {
    // Simple heuristic: Use the first H1 as the title
    const match = markdown.match(/^#\s+(.*)$/m);
    return match ? match[1].trim() : null;
  }
}
