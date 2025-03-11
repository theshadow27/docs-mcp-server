import type {
  ScrapeOptions,
  ProgressCallback,
  ScrapingProgress,
  DocContent,
  ScraperStrategy,
} from "../../types";
import { DefaultScraperStrategy } from "./DefaultScraperStrategy";

export class GitHubScraperStrategy implements ScraperStrategy {
  private defaultStrategy: DefaultScraperStrategy;

  static canHandle(url: string): boolean {
    const { hostname } = new URL(url);
    return ["github.com", "www.github.com"].includes(hostname);
  }

  static create(): GitHubScraperStrategy {
    return new GitHubScraperStrategy();
  }

  constructor() {
    const shouldFollowLink = (baseUrl: URL, targetUrl: URL) => {
      // Must be in same repository
      if (this.getRepoPath(baseUrl) !== this.getRepoPath(targetUrl)) {
        return false;
      }

      const path = targetUrl.pathname;

      // Root README (repository root)
      if (path === this.getRepoPath(targetUrl)) {
        return true;
      }

      // Wiki pages
      if (path.startsWith(`${this.getRepoPath(targetUrl)}/wiki`)) {
        return true;
      }

      // Markdown files under /blob/
      if (
        path.startsWith(`${this.getRepoPath(targetUrl)}/blob/`) &&
        path.endsWith(".md")
      ) {
        return true;
      }

      return false;
    };

    this.defaultStrategy = new DefaultScraperStrategy({
      urlNormalizerOptions: {
        ignoreCase: true,
        removeHash: true,
        removeTrailingSlash: true,
        removeQuery: true, // Remove query parameters like ?tab=readme-ov-file
      },
      shouldFollowLink,
    });
  }

  private getRepoPath(url: URL): string {
    // Extract /<org>/<repo> from github.com/<org>/<repo>/...
    const match = url.pathname.match(/^\/[^/]+\/[^/]+/);
    return match?.[0] || "";
  }

  async scrape(
    options: ScrapeOptions,
    progressCallback?: ProgressCallback<ScrapingProgress>
  ): Promise<void> {
    // Validate it's a GitHub URL
    const url = new URL(options.url);
    if (!url.hostname.includes("github.com")) {
      throw new Error("URL must be a GitHub URL");
    }

    await this.defaultStrategy.scrape(options, progressCallback);
  }
}
