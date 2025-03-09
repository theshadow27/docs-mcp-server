import type {
  ScraperConfig,
  ScrapingProgressCallback,
  DocContent,
  ScraperStrategy,
} from "../../types";
import { DefaultScraperStrategy } from "./default-strategy";

export class GitHubScraperStrategy implements ScraperStrategy {
  private defaultStrategy: DefaultScraperStrategy;

  constructor(options?: { onProgress?: ScrapingProgressCallback }) {
    this.defaultStrategy = new DefaultScraperStrategy({
      ...options,
      urlNormalizerOptions: {
        ignoreCase: true,
        removeHash: true,
        removeTrailingSlash: true,
        removeQuery: true, // Remove query parameters like ?tab=readme-ov-file
      },
    });
  }

  private getRepoPath(url: URL): string {
    // Extract /<org>/<repo> from github.com/<org>/<repo>/...
    const match = url.pathname.match(/^\/[^/]+\/[^/]+/);
    return match?.[0] || "";
  }

  async scrape(
    config: ScraperConfig,
    progressCallback?: ScrapingProgressCallback
  ): Promise<DocContent[]> {
    // Validate it's a GitHub URL
    const url = new URL(config.url);
    if (!url.hostname.includes("github.com")) {
      throw new Error("URL must be a GitHub URL");
    }

    return this.defaultStrategy.scrape(
      config,
      progressCallback,
      (baseUrl, targetUrl, depth) => {
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
      }
    );
  }
}
