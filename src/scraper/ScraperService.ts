import type {
  ScrapeOptions,
  ProgressCallback,
  ScrapingProgress,
} from "../types";
import { ScraperError } from "../utils/errors";
import { logger } from "../utils/logger";
import type { ScraperRegistry } from "./ScraperRegistry";

export class ScraperService {
  constructor(private registry: ScraperRegistry) {}

  async scrape(
    options: ScrapeOptions,
    progressCallback?: ProgressCallback<ScrapingProgress>
  ): Promise<void> {
    try {
      const strategy = this.registry.getStrategy(options.url);
      await strategy.scrape(options, progressCallback);
    } catch (error) {
      logger.error(
        `❌ Scraping failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      // Wrap non-ScraperError errors in ScraperError
      if (!(error instanceof ScraperError)) {
        throw new ScraperError(
          `Failed to scrape ${options.url}: ${error instanceof Error ? error.message : "Unknown error"}`,
          false,
          error
        );
      }
      throw error;
    }
  }
}
