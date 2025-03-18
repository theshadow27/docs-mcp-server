import fs from "node:fs/promises";
import path from "node:path";
import type { Document, ProgressCallback } from "../../types";
import { logger } from "../../utils/logger";
import type { ScraperOptions, ScraperProgress } from "../types";
import { FileFetcher } from "../fetcher";
import { BaseScraperStrategy, type QueueItem } from "./BaseScraperStrategy";

export class LocalFileStrategy extends BaseScraperStrategy {
  private readonly fileFetcher = new FileFetcher();

  canHandle(url: string): boolean {
    return url.startsWith("file://");
  }

  protected async processItem(
    item: QueueItem,
    options: ScraperOptions
  ): Promise<{ document?: Document; links?: string[] }> {
    const filePath = item.value.replace(/^file:\/\//, "");
    const stats = await fs.stat(filePath);

    // If this is a directory, return contained files and subdirectories as new paths
    if (stats.isDirectory()) {
      const contents = await fs.readdir(filePath);
      return {
        links: contents.map((name) => `file://${path.join(filePath, name)}`),
      };
    }

    // Process the file
    logger.info(
      `📄 Processing file ${this.pageCount}/${options.maxPages}: ${filePath}`
    );

    const rawContent = await this.fileFetcher.fetch(item.value);
    const processor = this.getProcessor(rawContent.mimeType);
    const result = await processor.process(rawContent);

    return {
      document: {
        content: result.content,
        metadata: {
          url: item.value,
          title: result.title,
          library: options.library,
          version: options.version,
        },
      } satisfies Document,
    };
  }

  async scrape(
    options: ScraperOptions,
    progressCallback: ProgressCallback<ScraperProgress>
  ): Promise<void> {
    await super.scrape(options, progressCallback);
  }
}
