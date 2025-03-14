import type { ProgressCallback } from "../../types";
import type {
  ScraperOptions,
  ScraperProgress,
  ScraperStrategy,
} from "../types";
import { DefaultScraperStrategy } from "./DefaultScraperStrategy";

export class NpmScraperStrategy implements ScraperStrategy {
  private defaultStrategy: DefaultScraperStrategy;

  static canHandle(url: string): boolean {
    const { hostname } = new URL(url);
    return ["npmjs.org", "npmjs.com", "www.npmjs.com"].includes(hostname);
  }

  static create(): NpmScraperStrategy {
    return new NpmScraperStrategy();
  }

  constructor() {
    this.defaultStrategy = new DefaultScraperStrategy({
      urlNormalizerOptions: {
        ignoreCase: true,
        removeHash: true,
        removeTrailingSlash: true,
        removeQuery: true, // Enable removeQuery for NPM packages
      },
    });
  }

  async scrape(
    options: ScraperOptions,
    progressCallback?: ProgressCallback<ScraperProgress>
  ): Promise<void> {
    // Use default strategy with our configuration
    await this.defaultStrategy.scrape(options, progressCallback);
  }
}
