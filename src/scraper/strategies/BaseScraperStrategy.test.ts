import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Document, ProgressCallback } from "../../types";
import type { ScraperOptions } from "../types";
import { BaseScraperStrategy, QueueItem } from "./BaseScraperStrategy";

// Mock implementation for testing abstract class
class TestScraperStrategy extends BaseScraperStrategy {
  canHandle(): boolean {
    return true;
  }
  processItem = vi.fn();
}

describe("BaseScraperStrategy", () => {
  let strategy: TestScraperStrategy;

  beforeEach(() => {
    strategy = new TestScraperStrategy();
    strategy.processItem.mockClear();
  });

  it("should process items and call progressCallback", async () => {
    const options: ScraperOptions = {
      url: "https://example.com",
      library: "test",
      version: "1.0.0",
      maxPages: 1,
      maxDepth: 1,
    };
    const progressCallback = vi.fn();

    strategy.processItem.mockResolvedValue({
      document: { content: "test", metadata: {} },
      links: [],
    });

    await strategy.scrape(options, progressCallback);

    expect(strategy.processItem).toHaveBeenCalledTimes(1);
    expect(progressCallback).toHaveBeenCalledWith({
      pagesScraped: 1,
      maxPages: 1,
      currentUrl: "https://example.com",
      depth: 0,
      maxDepth: 1,
      document: { content: "test", metadata: {} },
    });
  });

  it("should respect maxPages", async () => {
    const options: ScraperOptions = {
      url: "https://example.com",
      library: "test",
      version: "1.0.0",
      maxPages: 2,
      maxDepth: 1,
    };

    const progressCallback = vi.fn();

    strategy.processItem.mockResolvedValue({
      document: { content: "test", metadata: {} },
      links: ["https://example.com/page2", "https://example.com/page3"],
    });

    await strategy.scrape(options, progressCallback);
    expect(strategy.processItem).toHaveBeenCalledTimes(2);
  });

  it("should ignore errors when ignoreErrors is true", async () => {
    const options: ScraperOptions = {
      url: "https://example.com",
      library: "test",
      version: "1.0.0",
      maxPages: 1,
      maxDepth: 1,
      ignoreErrors: true,
    };
    const progressCallback = vi.fn();
    const error = new Error("Test error");

    strategy.processItem.mockRejectedValue(error);

    await strategy.scrape(options, progressCallback);

    expect(strategy.processItem).toHaveBeenCalledTimes(1);
    expect(progressCallback).not.toHaveBeenCalled();
  });

  it("should throw errors when ignoreErrors is false", async () => {
    const options: ScraperOptions = {
      url: "https://example.com",
      library: "test",
      version: "1.0.0",
      maxPages: 1,
      maxDepth: 1,
      ignoreErrors: false,
    };
    const progressCallback = vi.fn();
    const error = new Error("Test error");

    strategy.processItem.mockRejectedValue(error);

    // Use resolves.toThrowError to check if the promise rejects with the expected error
    await expect(strategy.scrape(options, progressCallback)).rejects.toThrowError(
      "Test error",
    );
    expect(strategy.processItem).toHaveBeenCalledTimes(1);
    expect(progressCallback).not.toHaveBeenCalled();
  });
});
