import type {
  ScraperConfig,
  ScrapingProgressCallback,
  DocContent,
} from "../types";
import { validateUrl } from "../utils/url";
import { DefaultScraperStrategy } from "./strategies/default-strategy";
import { NpmScraperStrategy } from "./strategies/npm-strategy";
import { PyPiScraperStrategy } from "./strategies/pypi-strategy";

export class DocumentationScraperDispatcher {
  private determineStrategy(
    url: string,
    options?: { onProgress?: ScrapingProgressCallback }
  ) {
    // Validate URL before determining strategy
    validateUrl(url);
    const { hostname } = new URL(url);

    // NPM domains
    if (
      hostname === "npmjs.org" ||
      hostname === "npmjs.com" ||
      hostname === "www.npmjs.com"
    ) {
      return new NpmScraperStrategy(options);
    }

    // PyPI domain
    if (hostname === "pypi.org" || hostname === "www.pypi.org") {
      return new PyPiScraperStrategy(options);
    }

    // Default strategy for all other domains
    return new DefaultScraperStrategy(options);
  }

  async scrape(
    config: ScraperConfig,
    progressCallback?: ScrapingProgressCallback
  ): Promise<DocContent[]> {
    // Validate config URL before proceeding
    validateUrl(config.url);
    const strategy = this.determineStrategy(config.url, {
      onProgress: progressCallback,
    });
    return strategy.scrape(config, progressCallback);
  }
}

// Re-export strategies for external use if needed
export { DefaultScraperStrategy } from "./strategies/default-strategy";
export { NpmScraperStrategy } from "./strategies/npm-strategy";
export { PyPiScraperStrategy } from "./strategies/pypi-strategy";
