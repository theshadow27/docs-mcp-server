import type {
  ScraperConfig,
  ScrapingProgressCallback,
  DocContent,
} from "../types";
import { validateUrl } from "../utils/url";
import { DefaultScraperStrategy } from "./strategies/default-strategy";
import { NpmScraperStrategy } from "./strategies/npm-strategy";
import { PyPiScraperStrategy } from "./strategies/pypi-strategy";
import { GitHubScraperStrategy } from "./strategies/github-strategy";

export class DocumentationScraperDispatcher {
  private readonly onProgress?: ScrapingProgressCallback;

  constructor(options?: { onProgress?: ScrapingProgressCallback }) {
    this.onProgress = options?.onProgress;
  }

  private determineStrategy(url: string) {
    // Validate URL before determining strategy
    validateUrl(url);
    const { hostname } = new URL(url);

    // NPM domains
    if (
      hostname === "npmjs.org" ||
      hostname === "npmjs.com" ||
      hostname === "www.npmjs.com"
    ) {
      return new NpmScraperStrategy({ onProgress: this.onProgress });
    }

    // PyPI domain
    if (hostname === "pypi.org" || hostname === "www.pypi.org") {
      return new PyPiScraperStrategy({ onProgress: this.onProgress });
    }

    // GitHub domain
    if (hostname === "github.com" || hostname === "www.github.com") {
      return new GitHubScraperStrategy({ onProgress: this.onProgress });
    }

    // Default strategy for all other domains
    return new DefaultScraperStrategy({ onProgress: this.onProgress });
  }

  async scrape(
    config: ScraperConfig,
    progressCallback?: ScrapingProgressCallback
  ): Promise<DocContent[]> {
    // Validate config URL before proceeding
    validateUrl(config.url);
    const strategy = this.determineStrategy(config.url);
    return strategy.scrape(config, progressCallback);
  }
}

// Re-export strategies for external use if needed
export { DefaultScraperStrategy } from "./strategies/default-strategy";
export { NpmScraperStrategy } from "./strategies/npm-strategy";
export { PyPiScraperStrategy } from "./strategies/pypi-strategy";
export { GitHubScraperStrategy } from "./strategies/github-strategy";
