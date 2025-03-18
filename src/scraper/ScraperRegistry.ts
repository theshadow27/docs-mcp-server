import { validateUrl } from "../utils/url";
import { WebScraperStrategy } from "./strategies/WebScraperStrategy";
import { GitHubScraperStrategy } from "./strategies/GitHubScraperStrategy";
import { LocalFileStrategy } from "./strategies/LocalFileStrategy";
import { NpmScraperStrategy } from "./strategies/NpmScraperStrategy";
import { PyPiScraperStrategy } from "./strategies/PyPiScraperStrategy";
import type { ScraperStrategy } from "./types";
import { ScraperError } from "../utils/errors";

export class ScraperRegistry {
  private strategies: ScraperStrategy[];

  constructor() {
    this.strategies = [
      new NpmScraperStrategy(),
      new PyPiScraperStrategy(),
      new GitHubScraperStrategy(),
      new WebScraperStrategy(),
      new LocalFileStrategy(),
    ];
  }

  getStrategy(url: string): ScraperStrategy {
    validateUrl(url);
    const strategy = this.strategies.find((s) => s.canHandle(url));
    if (!strategy) {
      throw new ScraperError(`No strategy found for URL: ${url}`);
    }
    return strategy;
  }
}
