import type { MemoryVectorStore } from "langchain/vectorstores/memory";
import { ScraperRegistry, ScraperService } from "../scraper";
import type { VectorStoreManager } from "../store";
import type {
  DocumentPipeline,
  DocumentPipelineCallbacks,
  ScrapeOptions,
  ScrapingProgress,
} from "../types";
import { logger } from "../utils/logger";

export class DocumentProcessingPipeline implements DocumentPipeline {
  private readonly store: VectorStoreManager;
  private readonly vectorStore: MemoryVectorStore;
  private callbacks: DocumentPipelineCallbacks = {};
  private isProcessing = false;
  private registry: ScraperRegistry;
  private scraperService: ScraperService;

  constructor(store: VectorStoreManager, vectorStore: MemoryVectorStore) {
    this.store = store;
    this.vectorStore = vectorStore;
    this.registry = new ScraperRegistry();
    this.scraperService = new ScraperService(this.registry);
  }

  setCallbacks(callbacks: DocumentPipelineCallbacks): void {
    this.callbacks = callbacks;
  }

  async process(options: ScrapeOptions): Promise<void> {
    if (this.isProcessing) {
      throw new Error("Pipeline is already processing");
    }

    this.isProcessing = true;
    try {
      await this.scraperService.scrape(options, (progress: ScrapingProgress) =>
        this.handleScrapingProgress(progress)
      );
      logger.info("✅ Pipeline processing complete");
    } catch (error) {
      logger.error(`❌ Pipeline failed: ${error}`);
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  async stop(): Promise<void> {
    if (!this.isProcessing) return;
    this.isProcessing = false;
  }

  private async handleScrapingProgress(
    progress: ScrapingProgress
  ): Promise<void> {
    if (!this.isProcessing) return;

    // Process document if present
    if (!progress.document) return;

    try {
      await this.store.addDocument(this.vectorStore, {
        pageContent: progress.document.content,
        metadata: progress.document.metadata,
      });

      // Report page progress
      if (this.callbacks.onProgress) {
        await this.callbacks.onProgress(progress);
      }
    } catch (error) {
      if (this.callbacks.onError) {
        await this.callbacks.onError(
          error instanceof Error ? error : new Error(String(error)),
          progress.document
        );
      }
      logger.error(
        `❌ Failed to process document ${progress.document.metadata.title}: ${error}`
      );
    }
  }
}
