import type {
  ScraperConfig,
  ScrapingProgressCallback,
  DocContent,
  ScraperStrategy,
} from "../../types";
import { DefaultScraperStrategy } from "./default-strategy";

export class NpmScraperStrategy implements ScraperStrategy {
  private defaultStrategy: DefaultScraperStrategy;

  constructor(options?: { onProgress?: ScrapingProgressCallback }) {
    this.defaultStrategy = new DefaultScraperStrategy({
      ...options,
      urlNormalizerOptions: {
        ignoreCase: true,
        removeHash: true,
        removeTrailingSlash: true,
        removeQuery: true, // Enable removeQuery for NPM packages
      },
    });
  }

  async scrape(
    config: ScraperConfig,
    progressCallback?: ScrapingProgressCallback
  ): Promise<DocContent[]> {
    // Use default strategy with our configuration
    return this.defaultStrategy.scrape(config, progressCallback);
  }
}
