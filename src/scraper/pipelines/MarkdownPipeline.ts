import { TextDecoder } from "node:util";
import { MimeTypeUtils } from "../../utils/mimeTypeUtils";
import type { RawContent } from "../fetcher/types";
import type { ContentFetcher } from "../fetcher/types";
import { MarkdownLinkExtractorMiddleware } from "../middleware/components/MarkdownLinkExtractorMiddleware";
import { MarkdownMetadataExtractorMiddleware } from "../middleware/components/MarkdownMetadataExtractorMiddleware";
import type {
  ContentProcessingContext,
  ContentProcessorMiddleware,
} from "../middleware/types";
import type { ScraperOptions } from "../types";
import type { ContentPipeline, ProcessedContent } from "./types";

/**
 * Pipeline for processing Markdown content using middleware.
 */
export class MarkdownPipeline implements ContentPipeline {
  private readonly middleware: ContentProcessorMiddleware[];

  constructor() {
    this.middleware = [
      new MarkdownMetadataExtractorMiddleware(),
      new MarkdownLinkExtractorMiddleware(),
    ];
  }

  canProcess(rawContent: RawContent): boolean {
    if (!rawContent.mimeType) return false;
    return (
      MimeTypeUtils.isMarkdown(rawContent.mimeType) ||
      MimeTypeUtils.isText(rawContent.mimeType)
    );
  }

  async process(
    rawContent: RawContent,
    options: ScraperOptions,
    fetcher?: ContentFetcher,
  ): Promise<ProcessedContent> {
    let contentString: string;

    if (Buffer.isBuffer(rawContent.content)) {
      const decoder = new TextDecoder(rawContent.charset || "utf-8");
      contentString = decoder.decode(rawContent.content);
    } else {
      contentString = rawContent.content;
    }

    const context: ContentProcessingContext = {
      content: contentString,
      contentType: rawContent.mimeType,
      source: rawContent.source,
      metadata: {},
      links: [],
      errors: [],
      options,
      fetcher,
    };

    let index = -1;
    const dispatch = async (i: number): Promise<void> => {
      if (i <= index) throw new Error("next() called multiple times");
      index = i;
      const mw = this.middleware[i];
      if (!mw) return;
      await mw.process(context, dispatch.bind(null, i + 1));
    };

    try {
      await dispatch(0);
    } catch (error) {
      context.errors.push(error instanceof Error ? error : new Error(String(error)));
    }

    return {
      textContent: typeof context.content === "string" ? context.content : "",
      metadata: context.metadata,
      links: context.links,
      errors: context.errors,
    };
  }

  async close(): Promise<void> {}
}
