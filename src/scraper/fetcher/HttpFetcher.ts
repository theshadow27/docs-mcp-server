import axios, { type AxiosError } from "axios";
import { ScraperError } from "../../utils/errors";
import { logger } from "../../utils/logger";
import type { ContentFetcher, FetchOptions, RawContent } from "./types";

/**
 * Fetches content from remote sources using HTTP/HTTPS.
 */
export class HttpFetcher implements ContentFetcher {
  private readonly MAX_RETRIES = 6;
  private readonly BASE_DELAY = 1000; // 1 second

  canFetch(source: string): boolean {
    return source.startsWith("http://") || source.startsWith("https://");
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async fetch(source: string, options?: FetchOptions): Promise<RawContent> {
    const maxRetries = options?.maxRetries ?? this.MAX_RETRIES;
    const baseDelay = options?.retryDelay ?? this.BASE_DELAY;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await axios.get(source, {
          responseType: "arraybuffer", // For handling both text and binary
          headers: options?.headers,
          timeout: options?.timeout,
        });

        return {
          content: response.data,
          mimeType: response.headers["content-type"] || "application/octet-stream",
          source: source,
          encoding: response.headers["content-encoding"],
        } satisfies RawContent;
      } catch (error: unknown) {
        const axiosError = error as AxiosError;
        const status = axiosError.response?.status;
        const code = axiosError.code;

        if (
          attempt < maxRetries &&
          (status === undefined || (status >= 500 && status < 600))
        ) {
          const delay = baseDelay * 2 ** attempt;
          logger.warn(
            `Attempt ${attempt + 1}/${
              maxRetries + 1
            } failed for ${source} (Status: ${status}, Code: ${code}). Retrying in ${delay}ms...`,
          );
          await this.delay(delay);
          continue;
        }

        // Not a 5xx error or max retries reached
        throw new ScraperError(
          `Failed to fetch ${source} after ${
            attempt + 1
          } attempts: ${axiosError.message ?? "Unknown error"}`,
          true,
          error instanceof Error ? error : undefined,
        );
      }
    }
    throw new ScraperError(
      `Failed to fetch ${source} after ${maxRetries + 1} attempts`,
      true,
    );
  }
}
