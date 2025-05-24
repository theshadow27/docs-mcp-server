import fs from "node:fs/promises";
import path from "node:path";
import { ScraperError } from "../../utils/errors";
import { logger } from "../../utils/logger";
import type { ContentFetcher, FetchOptions, RawContent } from "./types";

/**
 * Fetches content from local file system.
 */
export class FileFetcher implements ContentFetcher {
  canFetch(source: string): boolean {
    return source.startsWith("file://");
  }

  async fetch(source: string, options?: FetchOptions): Promise<RawContent> {
    const filePath = source.replace(/^file:\/\//, "");
    logger.info(`📄 Fetching file: ${filePath}`);

    try {
      const content = await fs.readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mimeType = this.getMimeType(ext, content);
      return {
        content,
        mimeType,
        source,
        encoding: "utf-8", // Assume UTF-8 for text files
      };
    } catch (error: unknown) {
      throw new ScraperError(
        `Failed to read file ${filePath}: ${
          (error as { message?: string }).message ?? "Unknown error"
        }`,
        false,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Returns the MIME type for a file extension, optionally inspecting content for binary detection.
   * For known text extensions, always returns the text MIME type.
   * For unknown extensions, checks for null bytes in the first 8000 bytes to detect binary files.
   */
  private getMimeType(ext: string, content?: Buffer): string {
    switch (ext) {
      case ".html":
      case ".htm":
      case ".htmx":
        return "text/html";
      case ".md":
      case ".mdx":
      case ".markdown":
        return "text/markdown";
      case ".txt":
      case ".text":
        return "text/plain";
      default:
        if (content) {
          // Fast null byte check using Buffer.indexOf
          const maxCheck = Math.min(content.length, 8000);
          if (content.subarray(0, maxCheck).indexOf(0) !== -1) {
            return "application/octet-stream";
          }
        }
        return "application/octet-stream";
    }
  }
}
