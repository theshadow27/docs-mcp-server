class StoreError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(cause ? `${message} caused by ${cause}` : message);
    this.name = this.constructor.name;

    const causeError =
      cause instanceof Error ? cause : cause ? new Error(String(cause)) : undefined;
    if (causeError?.stack) {
      this.stack = causeError.stack;
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
