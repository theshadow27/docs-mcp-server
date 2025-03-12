import { ScraperRegistry, ScraperService } from "../scraper";
import type { VectorStoreService } from "../store";
import type {
  DocumentPipeline,
  DocumentPipelineCallbacks,
  ScrapeOptions,
  ScrapingProgress,
} from "../types";
import { logger } from "../utils/logger";

/**
 * Coordinates document processing workflow from scraping to storage.
 * Manages the lifecycle of document processing including scraping, progress tracking,
 * and storage operations. Implements a pipeline pattern with error handling and
 * progress reporting through callbacks, ensuring reliable document processing
 * from source to vector store.
 */
export class DocumentProcessingPipeline implements DocumentPipeline {
  private readonly store: VectorStoreService;
  private readonly library: string;
  private readonly version: string;
  private callbacks: DocumentPipelineCallbacks = {};
  private isProcessing = false;
  private registry: ScraperRegistry;
  private scraperService: ScraperService;

  constructor(store: VectorStoreService, library: string, version: string) {
    this.store = store;
    this.library = library;
    this.version = version;
    this.registry = new ScraperRegistry();
    this.scraperService = new ScraperService(this.registry);
  }

  /**
   * Registers callback handlers for pipeline events
   */
  setCallbacks(callbacks: DocumentPipelineCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Initiates document processing pipeline.
   * Coordinates scraping and storage operations with progress tracking
   */
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

  /**
   * Gracefully terminates ongoing processing
   */
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
      await this.store.addDocument(this.library, this.version, {
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
