import { describe, expect, it, vi } from "vitest";
import { ScraperError } from "../../utils/errors";
import type { RawContent } from "../fetcher/types";
import { HtmlProcessor } from "./HtmlProcessor";

vi.mock("../../utils/logger");

describe("HtmlProcessor", () => {
  it("should process valid HTML content", async () => {
    const processor = new HtmlProcessor();
    const rawContent: RawContent = {
      content:
        "<html><head><title>Test Title</title></head><body><h1>Hello</h1><p>World</p></body></html>",
      mimeType: "text/html",
      source: "https://example.com",
    };

    const result = await processor.process(rawContent);
    expect(result.title).toBe("Test Title");
    expect(result.content).toContain("# Hello");
    expect(result.content).toContain("World");
    expect(result.source).toBe("https://example.com");
    expect(result.links).toEqual([]); // No links in this example
  });

  it("should extract links", async () => {
    const processor = new HtmlProcessor();
    const rawContent: RawContent = {
      content:
        '<html><head><title>Test</title></head><body><a href="https://example.com/page1">Page 1</a><a href="/page2">Page 2</a></body></html>',
      mimeType: "text/html",
      source: "https://example.com",
    };
    const result = await processor.process(rawContent);
    expect(result.links).toEqual([
      "https://example.com/page1",
      "https://example.com/page2",
    ]);
  });

  it("should handle relative links correctly", async () => {
    const processor = new HtmlProcessor();
    const rawContent: RawContent = {
      content:
        '<html><head><title>Test</title></head><body><a href="page1">Page 1</a></body></html>',
      mimeType: "text/html",
      source: "file:///path/to/index.html",
    };
    const result = await processor.process(rawContent);
    expect(result.links).toEqual(["file:///path/to/page1"]);
  });

  it("should remove script and style tags", async () => {
    const processor = new HtmlProcessor();
    const rawContent: RawContent = {
      content:
        "<html><head><title>Test</title><style>body { color: red; }</style></head><body><script>alert('Hello');</script><h1>Hello</h1></body></html>",
      mimeType: "text/html",
      source: "https://example.com",
    };
    const result = await processor.process(rawContent);
    expect(result.content).not.toContain("body { color: red; }");
    expect(result.content).not.toContain("alert('Hello');");
    expect(result.content).toContain("# Hello");
  });

  it("should throw error for non-HTML content", async () => {
    const processor = new HtmlProcessor();
    const rawContent: RawContent = {
      content: "Hello, world!",
      mimeType: "text/plain",
      source: "https://example.com",
    };
    await expect(processor.process(rawContent)).rejects.toThrow(ScraperError);
  });

  it("should return empty links array if extractLinks is false", async () => {
    const processor = new HtmlProcessor({ extractLinks: false });
    const rawContent: RawContent = {
      content:
        '<html><head><title>Test</title></head><body><a href="https://example.com/page1">Page 1</a></body></html>',
      mimeType: "text/html",
      source: "https://example.com",
    };
    const result = await processor.process(rawContent);
    expect(result.links).toEqual([]);
  });

  it("should extract links from nav sidebar before removing tags", async () => {
    const processor = new HtmlProcessor();
    const rawContent: RawContent = {
      content:
        '<html><head><title>Test</title></head><body><nav><ul><li><a href="/home">Home</a></li><li><a href="/about">About</a></li></ul></nav><p>Other content</p></body></html>',
      mimeType: "text/html",
      source: "https://example.com",
    };
    const result = await processor.process(rawContent);
    expect(result.links).toEqual([
      "https://example.com/home",
      "https://example.com/about",
    ]);
  });

  it("should remove unwanted tags and keep text from allowed tags", async () => {
    const processor = new HtmlProcessor();
    const rawContent: RawContent = {
      content:
        "<html><head><title>Test</title></head><body><nav><ul><li><a href=\"/home\">Home</a></li></ul></nav><p>This text should remain.</p><script>alert('This should be removed');</script></body></html>",
      mimeType: "text/html",
      source: "https://example.com",
    };
    const result = await processor.process(rawContent);
    expect(result.content).toContain("This text should remain.");
    expect(result.content).not.toContain("Home");
    expect(result.content).not.toContain("This should be removed");
  });

  describe("Code block language detection", () => {
    const processor = new HtmlProcessor();

    it("should detect language from highlight-source-<language> on a parent", async () => {
      const rawContent: RawContent = {
        content:
          '<html><head><title>Test</title></head><body><div class="highlight-source-python"><pre><code>print("Hello")</code></pre></div></body></html>',
        mimeType: "text/html",
        source: "https://example.com",
      };
      const result = await processor.process(rawContent);
      expect(result.content).toContain("```python");
    });

    it("should detect language from highlight-<language> on a parent", async () => {
      const rawContent: RawContent = {
        content:
          '<html><head><title>Test</title></head><body><div class="highlight-javascript"><pre><code>console.log("Hello")</code></pre></div></body></html>',
        mimeType: "text/html",
        source: "https://example.com",
      };
      const result = await processor.process(rawContent);
      expect(result.content).toContain("```javascript");
    });

    it("should detect language from language-<language> on a parent", async () => {
      const rawContent: RawContent = {
        content:
          '<html><head><title>Test</title></head><body><div class="language-typescript"><pre><code>console.log("Hello")</code></pre></div></body></html>',
        mimeType: "text/html",
        source: "https://example.com",
      };
      const result = await processor.process(rawContent);
      expect(result.content).toContain("```typescript");
    });

    it("should detect language from language-<language> on the pre tag itself", async () => {
      const rawContent: RawContent = {
        content:
          '<html><head><title>Test</title></head><body><pre class="language-java"><code>System.out.println("Hello")</code></pre></body></html>',
        mimeType: "text/html",
        source: "https://example.com",
      };
      const result = await processor.process(rawContent);
      expect(result.content).toContain("```java");
    });

    it("should default to empty language if no language class is present", async () => {
      const rawContent: RawContent = {
        content:
          '<html><head><title>Test</title></head><body><pre><code>print("Hello")</code></pre></body></html>',
        mimeType: "text/html",
        source: "https://example.com",
      };
      const result = await processor.process(rawContent);
      expect(result.content).toContain("```\n");
    });

    it("should prioritize data-language attribute", async () => {
      const rawContent: RawContent = {
        content:
          '<html><head><title>Test</title></head><body><div class="highlight-source-python"><pre data-language="typescript"><code>print("Hello")</code></pre></div></body></html>',
        mimeType: "text/html",
        source: "https://example.com",
      };
      const result = await processor.process(rawContent);
      expect(result.content).toContain("```typescript");
    });
  });
});
