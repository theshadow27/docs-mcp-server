import { describe, expect, it, vi } from "vitest";
import { SemanticMarkdownSplitter } from "./SemanticMarkdownSplitter";
import { MinimumChunkSizeError } from "./errors";
import type { CodeContentSplitter } from "./splitters/CodeContentSplitter";
import type { TableContentSplitter } from "./splitters/TableContentSplitter";

describe("SemanticMarkdownSplitter", () => {
  it("should handle empty markdown", async () => {
    const splitter = new SemanticMarkdownSplitter();
    const result = await splitter.splitText("");
    expect(result).toEqual([]);
  });

  it("should handle markdown with no headings", async () => {
    const splitter = new SemanticMarkdownSplitter();
    const markdown = "This is some text without any headings.";
    const result = await splitter.splitText(markdown);

    expect(result).toEqual([
      {
        type: "text",
        content: "This is some text without any headings.",
        section: {
          title: "",
          level: 0,
          path: [],
        },
      },
    ]);
  });

  it("should correctly split on H1-H3 headings and keep content together", async () => {
    const splitter = new SemanticMarkdownSplitter();
    const markdown = `
# Chapter 1
Some text in chapter 1.

## Section 1.1
More text in section 1.1.

### Subsection 1.1.1
Text in subsection.

#### Not a section break
This should stay with previous section.

## Section 1.2
Final text.

# Chapter 2
Text in chapter 2.
`;
    const result = await splitter.splitText(markdown);

    expect(result).toEqual([
      {
        type: "text",
        content: "# Chapter 1\n\nSome text in chapter 1.",
        section: {
          title: "Chapter 1",
          level: 1,
          path: ["Chapter 1"],
        },
      },
      {
        type: "text",
        content: "## Section 1.1\n\nMore text in section 1.1.",
        section: {
          title: "Section 1.1",
          level: 2,
          path: ["Chapter 1", "Section 1.1"],
        },
      },
      {
        type: "text",
        content:
          "### Subsection 1.1.1\n\nText in subsection.\nNot a section break\nThis should stay with previous section.",
        section: {
          title: "Subsection 1.1.1",
          level: 3,
          path: ["Chapter 1", "Section 1.1", "Subsection 1.1.1"],
        },
      },
      {
        type: "text",
        content: "## Section 1.2\n\nFinal text.",
        section: {
          title: "Section 1.2",
          level: 2,
          path: ["Chapter 1", "Section 1.2"],
        },
      },
      {
        type: "text",
        content: "# Chapter 2\n\nText in chapter 2.",
        section: {
          title: "Chapter 2",
          level: 1,
          path: ["Chapter 2"],
        },
      },
    ]);
  });

  it("should keep headers with text but separate code and tables", async () => {
    const splitter = new SemanticMarkdownSplitter();
    const markdown = `
# Mixed Content Section

This is some text.
More text here.

\`\`\`javascript
// Some code in JavaScript
console.log('Hello');
\`\`\`

| Header 1 | Header 2 |
| -------- | -------- |
| Cell 1   | Cell 2   |
`;
    const result = await splitter.splitText(markdown);

    expect(result).toEqual([
      {
        type: "text",
        content: "# Mixed Content Section\n\nThis is some text. More text here.",
        section: {
          title: "Mixed Content Section",
          level: 1,
          path: ["Mixed Content Section"],
        },
      },
      {
        type: "code",
        content: "```javascript\n// Some code in JavaScript\nconsole.log('Hello');\n```",
        section: {
          title: "Mixed Content Section",
          level: 1,
          path: ["Mixed Content Section"],
        },
      },
      {
        type: "table",
        content: "| Header 1 | Header 2 |\n|---|---|\n| Cell 1 | Cell 2 |",
        section: {
          title: "Mixed Content Section",
          level: 1,
          path: ["Mixed Content Section"],
        },
      },
    ]);
  });

  it("should preserve table headers in metadata", async () => {
    const splitter = new SemanticMarkdownSplitter();
    // Mock the table splitter to verify it receives the headers
    const mockSplit = vi.fn().mockResolvedValue([{ content: "mocked content" }]);
    splitter.tableSplitter = {
      split: mockSplit,
    } as unknown as TableContentSplitter;

    const markdown = `
| Col 1 | Col 2 | Col 3 |
|-------|--------|-------|
| A1    | A2     | A3    |
| B1    | B2     | B3    |
`;

    await splitter.splitText(markdown);

    // Verify that the table splitter was called with headers
    expect(mockSplit).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: ["Col 1", "Col 2", "Col 3"],
      }),
    );
  });

  it("should preserve code language in metadata", async () => {
    const splitter = new SemanticMarkdownSplitter();
    // Mock the code splitter to verify it receives the language
    const mockSplit = vi.fn().mockResolvedValue([{ content: "mocked content" }]);
    splitter.codeSplitter = {
      split: mockSplit,
    } as unknown as CodeContentSplitter;

    const markdown = `
\`\`\`python
def hello():
    print("Hello, World!")
\`\`\`
`;

    await splitter.splitText(markdown);

    // Verify that the code splitter was called with language
    expect(mockSplit).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        language: "python",
      }),
    );
  });

  it("should correctly split long tables while preserving headers", async () => {
    const splitter = new SemanticMarkdownSplitter({ maxChunkSize: 100 });

    // Create a table with many rows that will exceed maxChunkSize
    const tableRows = Array.from(
      { length: 20 },
      (_, i) => `| ${i + 1} | This is row ${i + 1} | ${(i + 1) * 100} |`,
    ).join("\n");

    const markdown = `
| ID | Description | Value |
|----|------------|-------|
${tableRows}
`;

    const result = await splitter.splitText(markdown);

    // Verify that we got multiple chunks
    expect(result.length).toBeGreaterThan(1);

    // Verify each chunk
    for (const chunk of result) {
      expect(chunk.type).toBe("table");
      // Each chunk should start with the header
      expect(chunk.content).toMatch(/^\| ID \| Description \| Value \|/);
      // Each chunk should have the header separator
      expect(chunk.content).toMatch(/\|---|---|---\|/);
      // Each chunk should have at least one data row
      expect(chunk.content.split("\n").length).toBeGreaterThan(2);
      // Each chunk should be valid markdown table format
      expect(chunk.content).toMatch(/^\|.*\|$/gm);
      // Each chunk should be within size limit
      expect(chunk.content.length).toBeLessThanOrEqual(100);
    }
  });

  it("should correctly split long code blocks while preserving language", async () => {
    const splitter = new SemanticMarkdownSplitter({ maxChunkSize: 100 });

    // Create a long code block that will exceed maxChunkSize
    const codeLines = Array.from(
      { length: 20 },
      (_, i) =>
        `console.log("This is line ${i + 1} with some extra text to make it longer");`,
    ).join("\n");

    const markdown = `
\`\`\`javascript
${codeLines}
\`\`\`
`;

    const result = await splitter.splitText(markdown);

    // Verify that we got multiple chunks
    expect(result.length).toBeGreaterThan(1);

    // Verify each chunk
    for (const chunk of result) {
      expect(chunk.type).toBe("code");
      // Each chunk should start with the language identifier
      expect(chunk.content).toMatch(/^```javascript\n/);
      // Each chunk should end with closing backticks
      expect(chunk.content).toMatch(/\n```$/);
      // Each chunk should contain actual code
      expect(chunk.content).toMatch(/console\.log/);
      // Each chunk should be within size limit
      expect(chunk.content.length).toBeLessThanOrEqual(100);
    }
  });

  it("should throw MinimumChunkSizeError when table cannot be split further", async () => {
    const splitter = new SemanticMarkdownSplitter({ maxChunkSize: 20 });
    const markdown = `
| Header1 | Header2 |
|---------|---------|
| Cell1   | Cell2   |`;

    await expect(splitter.splitText(markdown)).rejects.toThrow(MinimumChunkSizeError);
  });

  it("should throw MinimumChunkSizeError when code block cannot be split further", async () => {
    const splitter = new SemanticMarkdownSplitter({ maxChunkSize: 20 });
    const markdown = "```javascript\nconst x = 1;\n```";

    await expect(splitter.splitText(markdown)).rejects.toThrow(MinimumChunkSizeError);
  });
});
