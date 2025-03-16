import { type Document as HappyDocument, Window } from "happy-dom";
import remarkGfm from "remark-gfm";
import remarkHtml from "remark-html";
import remarkParse from "remark-parse";
import TurndownService from "turndown";
import { unified } from "unified";
import { fullTrim } from "../utils/string";
import { ContentSplitterError, MinimumChunkSizeError } from "./errors";
import { CodeContentSplitter } from "./splitters/CodeContentSplitter";
import { TableContentSplitter } from "./splitters/TableContentSplitter";
import { TextContentSplitter } from "./splitters/TextContentSplitter";

/**
 * Types of content within a document section
 */
export type SectionContentType = "text" | "code" | "table";

/**
 * Represents a section of content within a document,
 * typically defined by a heading
 */
export interface DocumentSection {
  title: string;
  level: number;
  path: string[]; // Full path including parent headings
  content: {
    type: SectionContentType;
    text: string;
    metadata?: {
      language?: string; // For code blocks
      headers?: string[]; // For tables
    };
  }[];
}

/**
 * Configuration for the markdown splitter
 */
export interface SplitterConfig {
  maxChunkSize: number; // Default: 4000
}

/**
 * Final output chunk after processing and size-based splitting
 */
export interface ContentChunk {
  type: SectionContentType;
  content: string;
  section: {
    title: string;
    level: number;
    path: string[];
  };
}

/**
 * Splits markdown documents into semantic chunks while preserving
 * structure and distinguishing between different content types.
 *
 * The splitting process happens in two steps:
 * 1. Split document into sections based on headings (H1-H3 only)
 * 2. Split section content into smaller chunks based on maxChunkSize
 */
export class SemanticMarkdownSplitter {
  private turndownService: TurndownService;
  private readonly config: Required<SplitterConfig>;
  public textSplitter: TextContentSplitter;
  public codeSplitter: CodeContentSplitter;
  public tableSplitter: TableContentSplitter;

  constructor(config: Partial<SplitterConfig> = {}) {
    this.config = {
      maxChunkSize: config.maxChunkSize ?? 4000,
    };

    this.turndownService = new TurndownService({
      headingStyle: "atx",
      hr: "---",
      bulletListMarker: "-",
      codeBlockStyle: "fenced",
      emDelimiter: "_",
      strongDelimiter: "**",
      linkStyle: "referenced",
      linkReferenceStyle: "full",
    });

    // Add table rule to preserve markdown table format
    this.turndownService.addRule("table", {
      filter: ["table"],
      replacement: (content, node) => {
        const table = node as HTMLTableElement;
        const headers = Array.from(table.querySelectorAll("th")).map(
          (th) => th.textContent?.trim() || "",
        );
        const rows = Array.from(table.querySelectorAll("tr")).filter(
          (tr) => !tr.querySelector("th"),
        );

        if (headers.length === 0 && rows.length === 0) return "";

        let markdown = "\n";
        if (headers.length > 0) {
          markdown += `| ${headers.join(" | ")} |\n`;
          markdown += `|${headers.map(() => "---").join("|")}|\n`;
        }

        for (const row of rows) {
          const cells = Array.from(row.querySelectorAll("td")).map(
            (td) => td.textContent?.trim() || "",
          );
          markdown += `| ${cells.join(" | ")} |\n`;
        }

        return markdown;
      },
    });

    this.textSplitter = new TextContentSplitter({
      maxChunkSize: this.config.maxChunkSize,
    });
    this.codeSplitter = new CodeContentSplitter({
      maxChunkSize: this.config.maxChunkSize,
    });
    this.tableSplitter = new TableContentSplitter({
      maxChunkSize: this.config.maxChunkSize,
    });
  }

  /**
   * Main entry point for splitting markdown content
   */
  async splitText(markdown: string): Promise<ContentChunk[]> {
    const html = await this.markdownToHtml(markdown);
    const dom = await this.parseHtml(html);
    const sections = await this.splitIntoSections(dom);
    return this.splitSectionContent(sections);
  }

  /**
   * Step 1: Split document into sections based on H1-H3 headings.
   * Headers are kept with their associated text content, while code blocks
   * and tables are separated into their own chunks.
   */
  private async splitIntoSections(dom: HappyDocument): Promise<DocumentSection[]> {
    const body = dom.querySelector("body");
    if (!body) {
      throw new Error("Invalid HTML structure: no body element found");
    }

    let currentSection = this.createRootSection();
    const sections: DocumentSection[] = [currentSection];
    const stack: DocumentSection[] = [currentSection];
    let currentTextContent: string[] = [];

    const flushTextContent = () => {
      if (currentTextContent.length > 0) {
        const text = currentTextContent.join("\n");
        currentSection.content.push({
          type: "text",
          text,
        });
        currentTextContent = [];
      }
    };

    // Process each child of the body
    for (const element of Array.from(body.children)) {
      const headingMatch = element.tagName.match(/H([1-3])/);

      if (headingMatch) {
        // Flush any accumulated text to the current section before creating new one
        flushTextContent();

        // Create new section for H1-H3 heading
        const level = Number.parseInt(headingMatch[1], 10);
        const title = fullTrim(element.textContent);

        // Pop sections from stack until we find the parent level
        while (stack.length > 1 && stack[stack.length - 1].level >= level) {
          stack.pop();
        }

        // Start new section with the header
        currentSection = {
          title,
          level,
          path: [...stack.map((s) => s.title).filter(Boolean), title],
          content: [],
        };

        // Add the header to the text content buffer
        currentTextContent.push(`${"#".repeat(level)} ${title}\n`);

        sections.push(currentSection);
        stack.push(currentSection);
      } else {
        // Process content based on type
        if (element.tagName === "PRE") {
          // Code blocks are kept as separate chunks
          const code = element.querySelector("code");
          const language = code?.className.replace("language-", "") || undefined;
          const content = code?.textContent || element.textContent || "";
          // Create a new section for the code block
          const codeSection = {
            title: currentSection.title,
            level: currentSection.level,
            path: currentSection.path,
            content: [
              {
                type: "code",
                text: content,
                metadata: {
                  language,
                },
              },
            ],
          } satisfies DocumentSection;
          sections.push(codeSection);
        } else if (element.tagName === "TABLE") {
          // Tables are kept as separate chunks
          const headers = Array.from(element.querySelectorAll("th")).map((th) =>
            fullTrim(th.textContent || ""),
          );
          const tableContent = fullTrim(this.turndownService.turndown(element.outerHTML));
          // Create a new section for the table
          const tableSection = {
            title: currentSection.title,
            level: currentSection.level,
            path: currentSection.path,
            content: [
              {
                type: "table",
                text: tableContent,
                metadata: {
                  headers: headers.length > 0 ? headers : undefined,
                },
              },
            ],
          } satisfies DocumentSection;
          sections.push(tableSection);
        } else {
          const text = fullTrim(this.turndownService.turndown(element.innerHTML));
          if (text) {
            // Add text to current buffer instead of creating new chunk
            currentTextContent.push(text);
          }
        }
      }
    }

    // Flush any remaining text content
    flushTextContent();
    return sections;
  }

  /**
   * Step 2: Split section content into smaller chunks
   */
  private async splitSectionContent(
    sections: DocumentSection[],
  ): Promise<ContentChunk[]> {
    const chunks: ContentChunk[] = [];

    for (const section of sections) {
      for (const content of section.content) {
        let splitContent: string[] = [];

        try {
          switch (content.type) {
            case "text": {
              const textChunks = await this.textSplitter.split(content.text);
              splitContent = textChunks.map((c) => c.content);
              break;
            }
            case "code": {
              const codeChunks = await this.codeSplitter.split(content.text, {
                language: content.metadata?.language,
              });
              splitContent = codeChunks.map((c) => c.content);
              break;
            }
            case "table": {
              const tableChunks = await this.tableSplitter.split(content.text, {
                headers: content.metadata?.headers,
              });
              splitContent = tableChunks.map((c) => c.content);
              break;
            }
          }
        } catch (err) {
          // Re-throw MinimumChunkSizeError, wrap other errors
          if (err instanceof MinimumChunkSizeError) {
            throw err;
          }
          // Convert error message to string, handling non-Error objects
          const errMessage = err instanceof Error ? err.message : String(err);
          throw new ContentSplitterError(
            `Failed to split ${content.type} content: ${errMessage}`,
          );
        }

        // Create chunks from split content
        chunks.push(
          ...splitContent.map(
            (text): ContentChunk => ({
              type: content.type,
              content: text,
              section: {
                title: section.title,
                level: section.level,
                path: section.path,
              },
            }),
          ),
        );
      }
    }

    return chunks;
  }

  /**
   * Helper to create the root section
   */
  private createRootSection(): DocumentSection {
    return {
      title: "",
      level: 0,
      path: [],
      content: [],
    };
  }

  /**
   * Convert markdown to HTML using remark
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
   * Parse HTML using happy-dom
   */
  private async parseHtml(html: string): Promise<HappyDocument> {
    const window = new Window();
    window.document.write(html);
    return window.document;
  }
}
