class StoreError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = this.constructor.name;
    if (cause?.stack) {
      this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
    }
  }
}

class ConnectionError extends StoreError {}

class DocumentNotFoundError extends StoreError {
  constructor(public readonly id: string) {
    super(`Document ${id} not found`);
  }
}

export { StoreError, ConnectionError, DocumentNotFoundError };
