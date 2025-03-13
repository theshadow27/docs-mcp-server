import { describe, it, expect } from "vitest";
import { SemanticMarkdownSplitter } from "./SemanticMarkdownSplitter";

describe("SemanticMarkdownSplitter", () => {
  const splitter = new SemanticMarkdownSplitter({
    minChunkSize: 10, // Small sizes for testing
    maxChunkSize: 100,
  });

  it("should split content into hierarchical chunks", async () => {
    const markdown = `# Title 1
Some content here.

## Section 1.1
More content here.

\`\`\`typescript
const x = 1;
const y = 2;
\`\`\`

## Section 1.2
Final content.`;

    const chunks = await splitter.splitText(markdown);

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].hierarchy).toContain("Title 1");
    expect(chunks[1].metadata.path).toEqual(["Title 1", "Section 1.1"]);
  });

  it("should distinguish between text and code content", async () => {
    const markdown = `# Code Example
Normal text here.

\`\`\`typescript
function test() {
  return true;
}
\`\`\`

More text.`;

    const chunks = await splitter.splitText(markdown);
    const codeSegments = chunks[0].segments.filter((s) => s.type === "code");
    const textSegments = chunks[0].segments.filter((s) => s.type === "text");

    expect(codeSegments.length).toBeGreaterThan(0);
    expect(textSegments.length).toBeGreaterThan(0);
    expect(codeSegments[0].language).toBe("typescript");
  });

  it("should respect maxChunkSize while preserving code blocks", async () => {
    const markdown = `# Large Content
${Array(20).fill("Very long text.").join(" ")}

\`\`\`typescript
const x = 1;
const y = 2;
\`\`\`

${Array(20).fill("More long text.").join(" ")}`;

    const chunks = await splitter.splitText(markdown);

    expect(chunks.length).toBeGreaterThan(1);

    // Verify no chunk exceeds maxChunkSize
    for (const chunk of chunks) {
      const totalSize = chunk.segments.reduce(
        (sum, segment) => sum + segment.content.length,
        0
      );
      expect(totalSize).toBeLessThanOrEqual(100);
    }

    // Verify code blocks are not split
    const codeSegments = chunks
      .flatMap((c) => c.segments)
      .filter((s) => s.type === "code");
    expect(codeSegments[0].content).toContain("const x = 1");
    expect(codeSegments[0].content).toContain("const y = 2");
  });

  it("should handle empty content gracefully", async () => {
    const markdown = "";
    const chunks = await splitter.splitText(markdown);
    expect(chunks).toEqual([]);
  });

  it("should preserve hierarchical structure with nested headings", async () => {
    const markdown = `# Main Title
Top level content.

## Section 1
Section 1 content.

### Subsection 1.1
Deep nested content.

## Section 2
Final section content.`;

    const chunks = await splitter.splitText(markdown);

    expect(chunks[0].hierarchy).toEqual(["Main Title"]);
    expect(chunks[1].hierarchy).toEqual(["Main Title", "Section 1"]);
    expect(chunks[2].hierarchy).toEqual([
      "Main Title",
      "Section 1",
      "Subsection 1.1",
    ]);
    expect(chunks[3].hierarchy).toEqual(["Main Title", "Section 2"]);
  });

  it("should handle plain text without headers", async () => {
    const markdown = `This is just plain text.
Some more text here.

And another paragraph.`;

    const chunks = await splitter.splitText(markdown);

    expect(chunks.length).toBe(1);
    expect(chunks[0].segments.length).toBe(2);
    expect(chunks[0].segments.every((s) => s.type === "text")).toBe(true);
    expect(chunks[0].hierarchy).toEqual([]);
  });

  it("should handle content before first header", async () => {
    const markdown = `Initial text before any headers.
More initial content.

## First Section
Some section content.

### Subsection
Deeper nested content.`;

    const chunks = await splitter.splitText(markdown);

    // First chunk should be root with initial content
    expect(chunks[0].segments.length).toBeGreaterThan(0);
    expect(chunks[0].hierarchy).toEqual([]);

    // Second chunk should be "First Section"
    expect(chunks[1].hierarchy).toEqual(["First Section"]);
    expect(
      chunks[1].segments.some((s) => s.content.includes("section content"))
    ).toBe(true);

    // Third chunk should be "Subsection" under "First Section"
    expect(chunks[2].hierarchy).toEqual(["First Section", "Subsection"]);
    expect(
      chunks[2].segments.some((s) => s.content.includes("Deeper nested"))
    ).toBe(true);
  });

  it("should handle mixed content structures", async () => {
    const markdown = `Some text at root level.

\`\`\`javascript
// Root level code
const x = 1;
\`\`\`

## Section 1
Section content.

More text here.
\`\`\`python
def test():
    pass
\`\`\``;

    const chunks = await splitter.splitText(markdown);

    // Root level should have text and JavaScript code
    expect(chunks[0].segments.length).toBe(2);
    expect(chunks[0].segments[0].type).toBe("text");
    expect(chunks[0].segments[1].type).toBe("code");
    expect(chunks[0].segments[1].language).toBe("javascript");

    // Section 1 should have text and Python code
    expect(chunks[1].hierarchy).toEqual(["Section 1"]);
    expect(chunks[1].segments.length).toBe(3);
    expect(chunks[1].segments[2].type).toBe("code");
    expect(chunks[1].segments[2].language).toBe("python");
  });

  it("should split very large code blocks", async () => {
    const markdown = `# Test
\`\`\`typescript
${Array(50).fill("// Very long line of code that exceeds the limit").join("\n")}
\`\`\``;

    const splitter = new SemanticMarkdownSplitter({
      minChunkSize: 10,
      maxChunkSize: 100, // Small size for testing
    });

    const chunks = await splitter.splitText(markdown);

    expect(chunks.length).toBeGreaterThan(1);

    // All chunks should be under maxChunkSize
    for (const chunk of chunks) {
      const totalSize = chunk.segments.reduce(
        (sum, segment) => sum + segment.content.length,
        0
      );
      expect(totalSize).toBeLessThanOrEqual(100);

      // All code segments should maintain the language
      const codeSegments = chunk.segments.filter((s) => s.type === "code");
      for (const segment of codeSegments) {
        expect(segment.language).toBe("typescript");
      }
    }

    // Content should still be valid code lines
    const allCode = chunks
      .flatMap((c) => c.segments)
      .filter((s) => s.type === "code")
      .map((s) => s.content)
      .join("\n");

    expect(allCode).toContain("// Very long line of code");
  });
});
