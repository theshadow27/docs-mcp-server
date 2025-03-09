import { isFetchDocsParams, isSearchDocsParams } from "./index.js";
import { describe, it, expect } from "vitest";

describe("Type Guards", () => {
  it("should validate FetchDocsParams", () => {
    const validParams = {
      library: "test",
      version: "1.0.0",
      url: "http://example.com",
    };
    expect(isFetchDocsParams(validParams)).toBe(true);

    const invalidParams = {
      library: "test",
      version: 123,
      url: "http://example.com",
    };
    expect(isFetchDocsParams(invalidParams)).toBe(false);
  });

  it("should validate SearchDocsParams", () => {
    const validParams = {
      library: "test",
      query: "test query",
    };
    expect(isSearchDocsParams(validParams)).toBe(true);

    const invalidParams = {
      library: 123,
      query: "test query",
    };
    expect(isSearchDocsParams(invalidParams)).toBe(false);
  });
});
