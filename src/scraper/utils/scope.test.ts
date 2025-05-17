import { describe, expect, it } from "vitest";
import { isInScope } from "./scope";

describe("isInScope", () => {
  const base = new URL("https://docs.example.com/docs/start");

  it("returns true for subpages in subpages scope", () => {
    expect(
      isInScope(base, new URL("https://docs.example.com/docs/intro"), "subpages"),
    ).toBe(true);
    expect(
      isInScope(base, new URL("https://docs.example.com/docs/start/child"), "subpages"),
    ).toBe(true);
    expect(isInScope(base, new URL("https://docs.example.com/docs"), "subpages")).toBe(
      false,
    );
    expect(isInScope(base, new URL("https://docs.example.com/api"), "subpages")).toBe(
      false,
    );
    expect(isInScope(base, new URL("https://other.com/docs/start"), "subpages")).toBe(
      false,
    );
  });

  it("returns true for same hostname in hostname scope", () => {
    expect(
      isInScope(base, new URL("https://docs.example.com/docs/intro"), "hostname"),
    ).toBe(true);
    expect(isInScope(base, new URL("https://docs.example.com/api"), "hostname")).toBe(
      true,
    );
    expect(isInScope(base, new URL("https://other.com/docs/start"), "hostname")).toBe(
      false,
    );
  });

  it("returns true for same domain in domain scope", () => {
    expect(
      isInScope(base, new URL("https://docs.example.com/docs/intro"), "domain"),
    ).toBe(true);
    expect(isInScope(base, new URL("https://api.example.com/"), "domain")).toBe(true);
    expect(isInScope(base, new URL("https://other.com/docs/start"), "domain")).toBe(
      false,
    );
    expect(isInScope(base, new URL("https://example.com/"), "domain")).toBe(true);
  });

  it("returns false for different protocol", () => {
    expect(
      isInScope(base, new URL("http://docs.example.com/docs/intro"), "hostname"),
    ).toBe(false);
    expect(
      isInScope(base, new URL("ftp://docs.example.com/docs/intro"), "hostname"),
    ).toBe(false);
  });
});
