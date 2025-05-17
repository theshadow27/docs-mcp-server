import { describe, expect, it } from "vitest";
import {
  extractPathAndQuery,
  isRegexPattern,
  matchesAnyPattern,
  patternToRegExp,
  shouldIncludeUrl,
} from "./patternMatcher";

describe("patternMatcher", () => {
  it("isRegexPattern detects regex", () => {
    expect(isRegexPattern("/foo.*/")).toBe(true);
    expect(isRegexPattern("foo.*/")).toBe(false);
    expect(isRegexPattern("/foo.*/")).toBe(true);
    expect(isRegexPattern("foo.*")).toBe(false);
  });

  it("patternToRegExp auto-detects regex and glob", () => {
    expect(patternToRegExp("/foo.*/").test("foo123")).toBe(true);
    expect(patternToRegExp("foo*bar").test("fooxbar")).toBe(true);
    expect(patternToRegExp("foo*bar").test("fooyyybar")).toBe(true);
    expect(patternToRegExp("foo*bar").test("foo/bar")).toBe(false);
  });

  it("matchesAnyPattern works for globs and regex", () => {
    expect(matchesAnyPattern("foo/abc/bar", ["foo/*/bar"])).toBe(true);
    expect(matchesAnyPattern("foo/abc/bar", ["/foo/.*/bar/"])).toBe(true);
    expect(matchesAnyPattern("foo/abc/bar", ["baz/*"])).toBe(false);
  });

  it("extractPathAndQuery extracts path and query", () => {
    expect(extractPathAndQuery("https://example.com/foo/bar?x=1")).toBe("/foo/bar?x=1");
    expect(extractPathAndQuery("/foo/bar?x=1")).toBe("/foo/bar?x=1");
  });

  it("shouldIncludeUrl applies exclude over include", () => {
    // Exclude wins
    expect(shouldIncludeUrl("https://x.com/foo", ["foo*"], ["/foo/"])).toBe(false);
    // Include only
    expect(shouldIncludeUrl("https://x.com/foo", ["foo*"], undefined)).toBe(true);
    // No include/exclude
    expect(shouldIncludeUrl("https://x.com/foo", undefined, undefined)).toBe(true);
    // Exclude only
    expect(shouldIncludeUrl("https://x.com/foo", undefined, ["foo*"])).toBe(false);
  });
});
