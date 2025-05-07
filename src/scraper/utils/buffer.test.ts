// Copyright (c) 2025
import { describe, expect, it } from "vitest";
import { convertToString } from "./buffer";

describe("buffer utilities", () => {
  describe("convertToString", () => {
    it("returns string content unchanged", () => {
      const input = "Hello, world!";
      expect(convertToString(input)).toBe(input);
    });

    it("converts Buffer to string with default UTF-8 charset", () => {
      const input = Buffer.from("Hello, world!", "utf-8");
      expect(convertToString(input)).toBe("Hello, world!");
    });

    it("converts Buffer to string with specified UTF-8 charset", () => {
      const input = Buffer.from("Hello, world!", "utf-8");
      expect(convertToString(input, "utf-8")).toBe("Hello, world!");
    });

    it("converts Buffer to string with ISO-8859-1 charset", () => {
      // Create a buffer with ISO-8859-1 encoding (Latin-1)
      // This contains characters that would be encoded differently in UTF-8
      const input = Buffer.from("Café", "latin1");
      expect(convertToString(input, "iso-8859-1")).toBe("Café");
    });

    it("handles special characters correctly with different charsets", () => {
      // Test with a string containing various special characters
      const specialChars = "äöüßéèêëàáâãåçñ¿¡";

      // Create buffer with ISO-8859-1 encoding
      const latinBuffer = Buffer.from(specialChars, "latin1");
      expect(convertToString(latinBuffer, "iso-8859-1")).toBe(specialChars);

      // Create buffer with UTF-8 encoding
      const utf8Buffer = Buffer.from(specialChars, "utf-8");
      expect(convertToString(utf8Buffer, "utf-8")).toBe(specialChars);
    });

    it("defaults to UTF-8 when charset is not specified", () => {
      const input = Buffer.from("Hello, world!", "utf-8");
      expect(convertToString(input, undefined)).toBe("Hello, world!");
    });

    it("handles empty buffer correctly", () => {
      const input = Buffer.from([]);
      expect(convertToString(input)).toBe("");
    });
  });
});
