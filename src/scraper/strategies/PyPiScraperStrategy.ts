import type { ProgressCallback } from "../../types";
import type { ScraperOptions, ScraperProgress, ScraperStrategy } from "../types";
import { DefaultScraperStrategy } from "./DefaultScraperStrategy";

export class PyPiScraperStrategy implements ScraperStrategy {
  private defaultStrategy: DefaultScraperStrategy;

  static canHandle(url: string): boolean {
    const { hostname } = new URL(url);
    return ["pypi.org", "www.pypi.org"].includes(hostname);
  }

  static create(): PyPiScraperStrategy {
    return new PyPiScraperStrategy();
  }

  constructor() {
    this.defaultStrategy = new DefaultScraperStrategy({
      urlNormalizerOptions: {
        ignoreCase: true,
        removeHash: true,
        removeTrailingSlash: true,
        removeQuery: true, // Enable removeQuery for PyPI packages
      },
    });
  }

  async scrape(
    options: ScraperOptions,
    progressCallback?: ProgressCallback<ScraperProgress>,
  ): Promise<void> {
    // Use default strategy with our configuration
    await this.defaultStrategy.scrape(options, progressCallback);
  }
}
