import { Window, type Document as HappyDocument } from "happy-dom";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkHtml from "remark-html";

/**
 * Represents a segment of content within a markdown chunk.
 * Can be either text or code with associated metadata.
 */
export interface ContentSegment {
  type: "text" | "code";
  content: string;
  language?: string; // For code segments
}

/**
 * Represents a semantic chunk of markdown content with
 * hierarchical structure and mixed content types.
 */
export interface MarkdownChunk {
  hierarchy: string[]; // e.g. ["Chapter 1", "Section 1.1"]
  level: number; // heading level (1-6)
  segments: ContentSegment[]; // Mixed content segments
  metadata: {
    title: string; // Section title
    path: string[]; // Full path including parent headings
  };
}

/**
 * Configuration options for the semantic markdown splitter.
 */
export interface MarkdownSplitterOptions {
  /** Minimum characters per chunk (default: 1000) */
  minChunkSize?: number;
  /** Maximum characters per chunk (default: 4000) */
  maxChunkSize?: number;
  /** Include hierarchy in chunk text (default: true) */
  includeHierarchy?: boolean;
}

/**
 * Internal node structure for building document hierarchy.
 */
interface HierarchyNode {
  title: string;
  level: number;
  path: string[];
  content: ContentSegment[];
  children: HierarchyNode[];
}

/**
 * Splits markdown documents into semantic chunks while preserving
 * structure and distinguishing between different content types.
 *
 * Features:
 * - Maintains document hierarchy using headers
 * - Separates text and code content
 * - Preserves code block language information
 * - Supports size-based chunk splitting
 */
export class SemanticMarkdownSplitter {
  private readonly options: Required<MarkdownSplitterOptions>;

  constructor(options: MarkdownSplitterOptions = {}) {
    this.options = {
      minChunkSize: options.minChunkSize ?? 1000,
      maxChunkSize: options.maxChunkSize ?? 4000,
      includeHierarchy: options.includeHierarchy ?? true,
    };
  }

  /**
   * Splits markdown text into semantic chunks while preserving structure
   * and distinguishing between different content types.
   */
  async splitText(text: string): Promise<MarkdownChunk[]> {
    // 1. Convert markdown to HTML (turndown actually converts HTML to MD,
    // but we're keeping this interface consistent with our planned structure)
    const html = await this.markdownToHtml(text);

    // 2. Parse HTML with happy-dom
    const dom = await this.parseHtml(html);

    // 3. Extract hierarchical structure
    const structure = this.buildHierarchy(dom);

    // 4. Process content segments and create chunks
    return this.createChunks(structure);
  }

  /**
   * Creates HTML from markdown using remark with GFM support.
   */
  private async markdownToHtml(markdown: string): Promise<string> {
    const html = await unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkHtml)
      .process(markdown);

    return `<!DOCTYPE html>
      <html>
        <body>
          ${String(html)}
        </body>
      </html>`;
  }

  /**
   * Parses HTML using happy-dom
   */
  private async parseHtml(html: string): Promise<HappyDocument> {
    const window = new Window();
    window.document.write(html);
    return window.document;
  }

  /**
   * Builds a hierarchical structure of the document by analyzing
   * headings and content sections.
   */
  private buildHierarchy(dom: HappyDocument): HierarchyNode[] {
    const body = dom.querySelector("body");
    if (!body) {
      throw new Error("Invalid HTML structure: no body element found");
    }

    // Create root node to hold the entire document
    const rootNode: HierarchyNode = {
      title: "", // Empty title for root
      level: 0,
      path: [],
      content: [],
      children: [],
    };

    let currentNode: HierarchyNode = rootNode;
    const stack: HierarchyNode[] = [rootNode];

    // Process each child of the body
    for (const element of Array.from(body.children)) {
      // Check if element is a heading
      const headingMatch = element.tagName.match(/H([1-6])/);

      if (headingMatch) {
        const level = Number.parseInt(headingMatch[1], 10);
        const title = element.textContent?.trim() || "";

        const node: HierarchyNode = {
          title,
          level,
          path: [], // Will be filled in later
          content: [],
          children: [],
        };

        // Pop nodes from stack until we find the parent level
        while (stack.length > 1 && stack[stack.length - 1].level >= level) {
          stack.pop();
        }

        // Add node to current parent
        const parent = stack[stack.length - 1];
        parent.children.push(node);
        stack.push(node);
        currentNode = node;
      } else {
        // Process content
        if (element.tagName === "PRE") {
          // Handle code blocks
          const code = element.querySelector("code");
          const language =
            code?.className.replace("language-", "") || undefined;
          const content = code?.textContent || element.textContent || "";

          const segment: ContentSegment = {
            type: "code",
            content: content.trim(),
            language,
          };

          currentNode.content.push(segment);
        } else {
          // Handle text content
          const text = element.textContent?.trim();
          if (text) {
            const segment: ContentSegment = {
              type: "text",
              content: text,
            };

            currentNode.content.push(segment);
          }
        }
      }
    }

    return this.updateHierarchyPaths([rootNode]);
  }

  /**
   * Updates the path arrays in the hierarchy to include the full
   * path from root to each node.
   */
  private updateHierarchyPaths(
    nodes: HierarchyNode[],
    parentPath: string[] = []
  ): HierarchyNode[] {
    return nodes.map((node) => {
      node.path = [...parentPath, node.title];
      node.children = this.updateHierarchyPaths(node.children, node.path);
      return node;
    });
  }

  /**
   * Creates markdown chunks from the hierarchical structure.
   */
  private createChunks(nodes: HierarchyNode[]): MarkdownChunk[] {
    const chunks: MarkdownChunk[] = [];

    const processNode = (node: HierarchyNode) => {
      // Filter out empty segments
      const validSegments = node.content.filter(
        (segment) => segment.content.trim().length > 0
      );

      if (validSegments.length > 0) {
        chunks.push({
          hierarchy: node.path.filter(Boolean), // Remove empty strings
          level: node.level,
          segments: validSegments,
          metadata: {
            title: node.title,
            path: node.path.filter(Boolean), // Remove empty strings
          },
        });
      }

      // Process children
      for (const child of node.children) {
        processNode(child);
      }
    };

    // Process the hierarchy starting from root
    nodes.forEach(processNode);
    return this.splitLargeChunks(chunks);
  }

  /**
   * Splits chunks that exceed the maximum size while preserving
   * semantic boundaries and content types.
   */
  private splitLargeChunks(chunks: MarkdownChunk[]): MarkdownChunk[] {
    const result: MarkdownChunk[] = [];

    for (const chunk of chunks) {
      const totalSize = chunk.segments.reduce(
        (sum, segment) => sum + segment.content.length,
        0
      );

      if (totalSize <= this.options.maxChunkSize) {
        result.push(chunk);
        continue;
      }

      // Split large chunks
      let currentChunk: MarkdownChunk = {
        ...chunk,
        segments: [],
      };

      let currentSize = 0;

      for (const segment of chunk.segments) {
        if (segment.type === "code") {
          if (segment.content.length > this.options.maxChunkSize) {
            // Split large code blocks at line boundaries
            const lines = segment.content.split("\n");
            let currentCode = "";

            // If current chunk has other content, save it first
            if (currentChunk.segments.length > 0) {
              result.push(currentChunk);
              currentChunk = { ...chunk, segments: [] };
              currentSize = 0;
            }

            for (const line of lines) {
              // Check if adding this line would exceed maxChunkSize
              if (
                currentCode.length + line.length + 1 >
                this.options.maxChunkSize
              ) {
                if (currentCode.trim()) {
                  // Add accumulated code as a segment
                  currentChunk.segments.push({
                    type: "code",
                    content: currentCode.trim(),
                    language: segment.language,
                  });
                  result.push(currentChunk);
                  currentChunk = { ...chunk, segments: [] };
                  currentSize = 0;
                }
                // Start new code accumulation
                currentCode = `${line}\n`;
              } else {
                currentCode += `${line}\n`;
              }
            }

            // Add remaining code if any
            if (currentCode.trim()) {
              currentChunk.segments.push({
                type: "code",
                content: currentCode.trim(),
                language: segment.language,
              });
              currentSize = currentCode.length;
            }
          } else {
            // Small code block - preserve as a single segment
            if (
              currentSize + segment.content.length >
              this.options.maxChunkSize
            ) {
              result.push(currentChunk);
              currentChunk = { ...chunk, segments: [] };
              currentSize = 0;
            }
            currentChunk.segments.push(segment);
            currentSize += segment.content.length;
          }
        } else {
          // Split text segments if needed
          const words = segment.content.split(/\s+/);
          let currentText = "";

          for (const word of words) {
            if (
              currentSize + currentText.length + word.length + 1 >
              this.options.maxChunkSize
            ) {
              if (currentText) {
                currentChunk.segments.push({
                  type: "text",
                  content: currentText.trim(),
                });
                result.push(currentChunk);
                currentChunk = {
                  ...chunk,
                  segments: [],
                };
                currentSize = 0;
                currentText = "";
              }
            }
            currentText += currentText ? ` ${word}` : word;
          }

          if (currentText) {
            currentChunk.segments.push({
              type: "text",
              content: currentText.trim(),
            });
            currentSize += currentText.length;
          }
        }
      }

      if (currentChunk.segments.length > 0) {
        result.push(currentChunk);
      }
    }

    return result;
  }
}
