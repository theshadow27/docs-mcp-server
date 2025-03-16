import { validateUrl } from "../utils/url";
import { DefaultScraperStrategy } from "./strategies/DefaultScraperStrategy";
import { GitHubScraperStrategy } from "./strategies/GitHubScraperStrategy";
import { NpmScraperStrategy } from "./strategies/NpmScraperStrategy";
import { PyPiScraperStrategy } from "./strategies/PyPiScraperStrategy";
import type { ScraperStrategy } from "./types";

export class ScraperRegistry {
  private strategies = [NpmScraperStrategy, PyPiScraperStrategy, GitHubScraperStrategy];

  getStrategy(url: string): ScraperStrategy {
    validateUrl(url);
    const StrategyClass = this.strategies.find((s) => s.canHandle(url));
    return StrategyClass?.create() ?? new DefaultScraperStrategy({});
  }
}
