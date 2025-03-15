import { describe, expect, it } from "vitest";
import { CodeContentSplitter } from "./CodeContentSplitter.js";
import type { ContentSplitterOptions } from "./types.js";

describe("CodeContentSplitter", () => {
	const options = {
		maxChunkSize: 100,
	} satisfies ContentSplitterOptions;
	const splitter = new CodeContentSplitter(options);

	it("should preserve language in code blocks", async () => {
		const code = `function test() {
  console.log("Hello");
}`;
		const chunks = await splitter.split(code, { language: "typescript" });
		expect(chunks.length).toBe(1);
		expect(chunks[0].content).toBe(`\`\`\`typescript\n${code}\n\`\`\``);
		expect(chunks[0].metadata).toEqual({ language: "typescript" });
	});

	it("should handle code without language", async () => {
		const code = `const x = 1;
const y = 2;`;
		const chunks = await splitter.split(code);
		expect(chunks.length).toBe(1);
		expect(chunks[0].content).toBe(`\`\`\`\n${code}\n\`\`\``);
		expect(chunks[0].metadata).toBeUndefined();
	});

	it("should split large code blocks by lines", async () => {
		const longLine =
			"console.log('This is a very long line of code that should be split.');";
		const code = Array(10).fill(longLine).join("\n");

		const chunks = await splitter.split(code, { language: "javascript" });
		expect(chunks.length).toBeGreaterThan(1);
		for (const chunk of chunks) {
			expect(chunk.content.length).toBeLessThanOrEqual(options.maxChunkSize);
			expect(chunk.content.startsWith("```javascript\n")).toBe(true);
			expect(chunk.content.endsWith("\n```")).toBe(true);
		}
	});

	it("should handle empty code blocks", async () => {
		const chunks = await splitter.split("", { language: "python" });
		expect(chunks.length).toBe(1);
		expect(chunks[0].content).toBe("```python\n\n```");
	});

	it("should preserve indentation", async () => {
		const code = `function test() {
  if (condition) {
    for (let i = 0; i < 10; i++) {
      console.log(i);
    }
  }
}`;
		const chunks = await splitter.split(code, { language: "typescript" });
		for (const chunk of chunks) {
			// Check if indentation is preserved within the chunk
			const lines = chunk.content.split("\n");
			for (let i = 1; i < lines.length - 1; i++) {
				// Skip the first (```typescript) and last (```) lines
				if (lines[i].includes("if")) {
					expect(lines[i].startsWith("  "));
				} else if (lines[i].includes("for")) {
					expect(lines[i].startsWith("    "));
				} else if (lines[i].includes("console")) {
					expect(lines[i].startsWith("      "));
				}
			}
		}
	});
});
