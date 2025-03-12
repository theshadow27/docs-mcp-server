import type {
  ScrapeOptions,
  ProgressCallback,
  ScrapingProgress,
} from "../types";
import { ScraperError } from "../utils/errors";
import { logger } from "../utils/logger";
import type { ScraperRegistry } from "./ScraperRegistry";

/**
 * Orchestrates web scraping operations using registered scraping strategies.
 * Delegates scraping to appropriate strategies based on URL patterns and provides
 * a unified error handling layer, wrapping domain-specific errors into ScraperErrors
 * for consistent error management throughout the application.
 */
export class ScraperService {
  constructor(private registry: ScraperRegistry) {}

  /**
   * Executes scraping using appropriate strategy for given URL.
   * Provides progress tracking and error handling wrapper
   */
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
