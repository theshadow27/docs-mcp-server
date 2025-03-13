class SplitterError extends Error {
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

class ChunkSizeError extends SplitterError {
  constructor(
    public readonly size: number,
    public readonly maxSize: number,
    message?: string
  ) {
    super(message ?? `Chunk size ${size} exceeds maximum ${maxSize}`);
  }
}

class InvalidContentError extends SplitterError {
  constructor(message: string) {
    super(`Invalid content: ${message}`);
  }
}

export { SplitterError, ChunkSizeError, InvalidContentError };
