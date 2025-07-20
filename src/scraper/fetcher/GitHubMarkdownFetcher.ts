import { logger } from "../../utils/logger";
import type { ContentFetcher, FetchOptions, RawContent } from "./types";

interface GitHubRepoInfo {
  owner: string;
  repo: string;
  branch?: string;
  path?: string;
}

interface GitHubTreeItem {
  path: string;
  type: "blob" | "tree";
  sha: string;
  url: string;
}

export class GitHubMarkdownFetcher implements ContentFetcher {
  private readonly apiBaseUrl = "https://api.github.com";
  private readonly rawBaseUrl = "https://raw.githubusercontent.com";

  canFetch(source: string): boolean {
    try {
      const url = new URL(source);
      return url.hostname === "github.com" || url.hostname === "www.github.com";
    } catch {
      return false;
    }
  }

  async fetch(source: string, options?: FetchOptions): Promise<RawContent> {
    const repoInfo = this.parseGitHubUrl(source);
    if (!repoInfo) {
      throw new Error(`Invalid GitHub URL: ${source}`);
    }

    // If a specific file is requested, fetch it directly
    if (repoInfo.path?.endsWith(".md")) {
      return this.fetchSingleFile(repoInfo, options);
    }

    // Otherwise, fetch all markdown files from the repository
    const markdownFiles = await this.fetchMarkdownFilesList(repoInfo, options);
    const contents = await this.fetchMultipleFiles(repoInfo, markdownFiles, options);

    // Combine all markdown files into a single document
    const combinedContent = this.combineMarkdownFiles(contents, repoInfo);

    return {
      content: combinedContent,
      mimeType: "text/markdown",
      charset: "utf-8",
      source,
    };
  }

  private parseGitHubUrl(url: string): GitHubRepoInfo | null {
    try {
      const parsed = new URL(url);
      const pathParts = parsed.pathname.split("/").filter(Boolean);

      if (pathParts.length < 2) {
        return null;
      }

      const owner = pathParts[0];
      const repo = pathParts[1];
      let branch = "main"; // Default branch
      let path = "";

      // Handle different GitHub URL formats
      if (pathParts.length > 2) {
        if (pathParts[2] === "tree" && pathParts.length > 3) {
          branch = pathParts[3];
          path = pathParts.slice(4).join("/");
        } else if (pathParts[2] === "blob" && pathParts.length > 3) {
          branch = pathParts[3];
          path = pathParts.slice(4).join("/");
        }
      }

      return { owner, repo, branch, path };
    } catch {
      return null;
    }
  }

  private async fetchSingleFile(
    repoInfo: GitHubRepoInfo,
    options?: FetchOptions,
  ): Promise<RawContent> {
    const { owner, repo, branch, path } = repoInfo;
    const rawUrl = `${this.rawBaseUrl}/${owner}/${repo}/${branch}/${path}`;

    const response = await this.makeRequest(rawUrl, options);
    const content = await response.text();

    return {
      content,
      mimeType: "text/markdown",
      charset: "utf-8",
      source: rawUrl,
    };
  }

  private async fetchMarkdownFilesList(
    repoInfo: GitHubRepoInfo,
    options?: FetchOptions,
  ): Promise<string[]> {
    const { owner, repo, branch } = repoInfo;
    const treeUrl = `${this.apiBaseUrl}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;

    try {
      const response = await this.makeRequest(treeUrl, options);
      const data = await response.json();

      if (!data.tree || !Array.isArray(data.tree)) {
        // Try with 'master' branch if 'main' fails
        if (branch === "main") {
          const masterRepoInfo = { ...repoInfo, branch: "master" };
          return this.fetchMarkdownFilesList(masterRepoInfo, options);
        }
        throw new Error("Invalid response from GitHub API");
      }

      // Filter for markdown files
      const markdownFiles = data.tree
        .filter(
          (item: GitHubTreeItem) =>
            item.type === "blob" &&
            (item.path.endsWith(".md") || item.path.endsWith(".markdown")),
        )
        .map((item: GitHubTreeItem) => item.path);

      logger.info(`Found ${markdownFiles.length} markdown files in ${owner}/${repo}`);
      return markdownFiles;
    } catch (error) {
      // If API fails, try with master branch
      if (branch === "main" && error instanceof Error && error.message.includes("404")) {
        const masterRepoInfo = { ...repoInfo, branch: "master" };
        return this.fetchMarkdownFilesList(masterRepoInfo, options);
      }
      throw error;
    }
  }

  private async fetchMultipleFiles(
    repoInfo: GitHubRepoInfo,
    filePaths: string[],
    options?: FetchOptions,
  ): Promise<Array<{ path: string; content: string }>> {
    const { owner, repo, branch } = repoInfo;
    const contents: Array<{ path: string; content: string }> = [];

    // Fetch files with concurrency limit
    const concurrencyLimit = 5;
    for (let i = 0; i < filePaths.length; i += concurrencyLimit) {
      const batch = filePaths.slice(i, i + concurrencyLimit);
      const batchPromises = batch.map(async (path) => {
        try {
          const rawUrl = `${this.rawBaseUrl}/${owner}/${repo}/${branch}/${path}`;
          const response = await this.makeRequest(rawUrl, options);
          const content = await response.text();
          return { path, content };
        } catch (error) {
          logger.warn(`Failed to fetch ${path}: ${error}`);
          return null;
        }
      });

      const results = await Promise.all(batchPromises);
      contents.push(
        ...results.filter((r): r is { path: string; content: string } => r !== null),
      );
    }

    return contents;
  }

  private combineMarkdownFiles(
    files: Array<{ path: string; content: string }>,
    repoInfo: GitHubRepoInfo,
  ): string {
    // Sort files by path for consistent output
    files.sort((a, b) => a.path.localeCompare(b.path));

    let combined = `# ${repoInfo.owner}/${repoInfo.repo} Documentation\n\n`;
    combined += "This documentation was fetched from the GitHub repository.\n\n";
    combined += "---\n\n";

    for (const file of files) {
      combined += `## File: ${file.path}\n\n`;
      combined += file.content;
      combined += "\n\n---\n\n";
    }

    return combined;
  }

  private async makeRequest(url: string, options?: FetchOptions): Promise<Response> {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "docs-mcp-server",
      ...options?.headers,
    };

    // Add GitHub token if provided in headers
    if (options?.headers?.Authorization) {
      headers.Authorization = options.headers.Authorization;
    }

    const fetchOptions: RequestInit = {
      headers,
      signal: options?.signal,
    };

    if (options?.followRedirects === false) {
      fetchOptions.redirect = "manual";
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      throw new Error(
        `GitHub API request failed: ${response.status} ${response.statusText}`,
      );
    }

    return response;
  }
}
