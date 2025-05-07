// Copyright (c) 2025
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import type { RawContent } from "../fetcher/types";
import type { ScraperOptions } from "../types";
import { HtmlPipeline } from "./HtmlPipeline";

// Mock middleware
vi.mock("../middleware/components/HtmlCheerioParserMiddleware");
vi.mock("../middleware/components/HtmlMetadataExtractorMiddleware");
vi.mock("../middleware/components/HtmlLinkExtractorMiddleware");
vi.mock("../middleware/components/HtmlToMarkdownMiddleware");

import { HtmlCheerioParserMiddleware } from "../middleware/components/HtmlCheerioParserMiddleware";
import { HtmlLinkExtractorMiddleware } from "../middleware/components/HtmlLinkExtractorMiddleware";
import { HtmlMetadataExtractorMiddleware } from "../middleware/components/HtmlMetadataExtractorMiddleware";
import { HtmlToMarkdownMiddleware } from "../middleware/components/HtmlToMarkdownMiddleware";

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

  it("process decodes Buffer content with charset", async () => {
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
