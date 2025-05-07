// Copyright (c) 2025
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import type { RawContent } from "../fetcher/types";
import type { ScraperOptions } from "../types";
import { HtmlPipeline } from "./HtmlPipeline";

// Mock middleware
vi.mock("../middleware/HtmlCheerioParserMiddleware");
vi.mock("../middleware/HtmlMetadataExtractorMiddleware");
vi.mock("../middleware/HtmlLinkExtractorMiddleware");
vi.mock("../middleware/HtmlToMarkdownMiddleware");

import { HtmlCheerioParserMiddleware } from "../middleware/HtmlCheerioParserMiddleware";
import { HtmlLinkExtractorMiddleware } from "../middleware/HtmlLinkExtractorMiddleware";
import { HtmlMetadataExtractorMiddleware } from "../middleware/HtmlMetadataExtractorMiddleware";
import { HtmlToMarkdownMiddleware } from "../middleware/HtmlToMarkdownMiddleware";

describe("HtmlPipeline", () => {
  let mockCheerioProcess: Mock;
  let mockMetadataProcess: Mock;
  let mockLinkProcess: Mock;
  let mockToMarkdownProcess: Mock;

  beforeEach(() => {
    mockCheerioProcess = vi.fn(async (ctx, next) => {
      ctx.dom = { fake: true };
      await next();
    });
    (HtmlCheerioParserMiddleware.prototype.process as Mock) = mockCheerioProcess;

    mockMetadataProcess = vi.fn(async (ctx, next) => {
      ctx.metadata.title = "HTML Title";
      await next();
    });
    (HtmlMetadataExtractorMiddleware.prototype.process as Mock) = mockMetadataProcess;

    mockLinkProcess = vi.fn(async (ctx, next) => {
      ctx.links.push("https://html.link/");
      await next();
    });
    (HtmlLinkExtractorMiddleware.prototype.process as Mock) = mockLinkProcess;

    mockToMarkdownProcess = vi.fn(async (ctx, next) => {
      ctx.content = "# Markdown";
      await next();
    });
    (HtmlToMarkdownMiddleware.prototype.process as Mock) = mockToMarkdownProcess;
  });

  it("canProcess returns true for text/html", () => {
    const pipeline = new HtmlPipeline();
    expect(pipeline.canProcess({ mimeType: "text/html" } as RawContent)).toBe(true);
    expect(pipeline.canProcess({ mimeType: "application/xhtml+xml" } as RawContent)).toBe(
      true,
    );
  });

  it("canProcess returns false for non-html", () => {
    const pipeline = new HtmlPipeline();
    expect(pipeline.canProcess({ mimeType: "text/markdown" } as RawContent)).toBe(false);
    // @ts-expect-error
    expect(pipeline.canProcess({ mimeType: undefined } as RawContent)).toBe(false);
  });

  it("process decodes Buffer content with UTF-8 charset", async () => {
    const pipeline = new HtmlPipeline();
    const raw: RawContent = {
      content: Buffer.from("<html>abc</html>", "utf-8"),
      mimeType: "text/html",
      charset: "utf-8",
      source: "http://test",
    };
    const result = await pipeline.process(raw, {} as ScraperOptions);
    expect(result.textContent).toBe("# Markdown");
  });

  it("process decodes Buffer content with ISO-8859-1 charset", async () => {
    // Save the original implementation
    const originalCheerioProcess = mockCheerioProcess;

    // Replace with a version that captures the content before calling next
    let capturedContent = "";
    mockCheerioProcess = vi.fn(async (ctx, next) => {
      capturedContent = ctx.content;
      ctx.dom = { fake: true };
      await next();
    });
    (HtmlCheerioParserMiddleware.prototype.process as Mock) = mockCheerioProcess;

    const pipeline = new HtmlPipeline();
    // Create a buffer with ISO-8859-1 encoding (Latin-1)
    // This contains characters that would be encoded differently in UTF-8
    const raw: RawContent = {
      content: Buffer.from("<html>Café</html>", "latin1"),
      mimeType: "text/html",
      charset: "iso-8859-1", // Explicitly set charset to ISO-8859-1
      source: "http://test",
    };
    const result = await pipeline.process(raw, {} as ScraperOptions);
    expect(result.textContent).toBe("# Markdown");

    // Verify the content was properly decoded
    expect(capturedContent).toBe("<html>Café</html>");

    // Restore the original implementation for other tests
    mockCheerioProcess = originalCheerioProcess;
    (HtmlCheerioParserMiddleware.prototype.process as Mock) = mockCheerioProcess;
  });

  it("process defaults to UTF-8 when charset is not specified", async () => {
    const pipeline = new HtmlPipeline();
    const raw: RawContent = {
      content: Buffer.from("<html>abc</html>", "utf-8"),
      mimeType: "text/html",
      // No charset specified
      source: "http://test",
    };
    const result = await pipeline.process(raw, {} as ScraperOptions);
    expect(result.textContent).toBe("# Markdown");
  });

  it("process uses string content directly", async () => {
    const pipeline = new HtmlPipeline();
    const raw: RawContent = {
      content: "<html>abc</html>",
      mimeType: "text/html",
      charset: "utf-8",
      source: "http://test",
    };
    const result = await pipeline.process(raw, {} as ScraperOptions);
    expect(result.textContent).toBe("# Markdown");
  });

  it("process calls middleware in order and aggregates results", async () => {
    const pipeline = new HtmlPipeline();
    const raw: RawContent = {
      content: "<html>abc</html>",
      mimeType: "text/html",
      charset: "utf-8",
      source: "http://test",
    };
    const result = await pipeline.process(raw, {} as ScraperOptions);
    expect(mockCheerioProcess).toHaveBeenCalledTimes(1);
    expect(mockMetadataProcess).toHaveBeenCalledTimes(1);
    expect(mockLinkProcess).toHaveBeenCalledTimes(1);
    expect(mockToMarkdownProcess).toHaveBeenCalledTimes(1);
    expect(result.metadata.title).toBe("HTML Title");
    expect(result.links).toContain("https://html.link/");
    expect(result.textContent).toBe("# Markdown");
  });

  it("process collects errors from middleware", async () => {
    mockMetadataProcess = vi.fn(async (ctx, next) => {
      ctx.errors.push(new Error("fail"));
      await next();
    });
    (HtmlMetadataExtractorMiddleware.prototype.process as Mock) = mockMetadataProcess;

    const pipeline = new HtmlPipeline();
    const raw: RawContent = {
      content: "<html>abc</html>",
      mimeType: "text/html",
      charset: "utf-8",
      source: "http://test",
    };
    const result = await pipeline.process(raw, {} as ScraperOptions);
    expect(result.errors.some((e) => e.message === "fail")).toBe(true);
  });
});
