class PipelineError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = this.constructor.name;
    if (cause?.stack) {
      this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
    }
  }
}

class DocumentProcessingError extends PipelineError {
  constructor(
    message: string,
    public readonly documentId: string,
    cause?: Error
  ) {
    super(`Failed to process document ${documentId}: ${message}`, cause);
  }
}

class PipelineStateError extends PipelineError {}

export { PipelineError, DocumentProcessingError, PipelineStateError };
