import { TextDecoder } from "node:util";

/**
 * Converts a Buffer to a string using the specified charset, or returns the content if already a string.
 * @param content The content to convert, can be a string or a Buffer.
 * @param charset The character set to use for decoding if content is a Buffer. Defaults to 'utf-8'.
 * @returns The content as a string.
 */
export function convertToString(content: string | Buffer, charset?: string): string {
  if (Buffer.isBuffer(content)) {
    const decoder = new TextDecoder(charset || "utf-8");
    return decoder.decode(content);
  }
  return content;
}
