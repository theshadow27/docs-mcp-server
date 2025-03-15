import { describe, expect, it } from "vitest";
import { type UrlNormalizerOptions, normalizeUrl } from "./url";

describe("URL normalization", () => {
	describe("default behavior", () => {
		it("should preserve query parameters", () => {
			expect(normalizeUrl("https://example.com/api?version=1.0")).toBe(
				"https://example.com/api?version=1.0",
			);
		});

		it("should remove hash fragments", () => {
			expect(normalizeUrl("https://example.com/page#section")).toBe(
				"https://example.com/page",
			);
		});

		it("should remove trailing slashes", () => {
			expect(normalizeUrl("https://example.com/page/")).toBe(
				"https://example.com/page",
			);
		});

		it("should convert to lowercase", () => {
			expect(normalizeUrl("https://EXAMPLE.com/PAGE")).toBe(
				"https://example.com/page",
			);
		});
	});

	describe("individual options", () => {
		it("should keep hash fragments when removeHash is false", () => {
			expect(
				normalizeUrl("https://example.com/page#section", { removeHash: false }),
			).toBe("https://example.com/page#section");
		});

		it("should keep trailing slashes when removeTrailingSlash is false", () => {
			expect(
				normalizeUrl("https://example.com/page/", {
					removeTrailingSlash: false,
				}),
			).toBe("https://example.com/page/");
		});

		it("should preserve case when ignoreCase is false", () => {
			expect(
				normalizeUrl("https://example.com/PATH/TO/PAGE", { ignoreCase: false }),
			).toBe("https://example.com/PATH/TO/PAGE");
		});

		it("should remove query parameters when removeQuery is true", () => {
			expect(
				normalizeUrl("https://example.com/api?version=1.0", {
					removeQuery: true,
				}),
			).toBe("https://example.com/api");
		});
	});

	describe("edge cases", () => {
		it("should handle invalid URLs gracefully", () => {
			const invalidUrl = "not-a-url";
			expect(normalizeUrl(invalidUrl)).toBe(invalidUrl);
		});

		it("should handle URLs with multiple query parameters", () => {
			expect(normalizeUrl("https://example.com/api?v=1&format=json")).toBe(
				"https://example.com/api?v=1&format=json",
			);
		});

		it("should handle URLs with both hash and query", () => {
			expect(normalizeUrl("https://example.com/path?query=1#section")).toBe(
				"https://example.com/path?query=1",
			);
		});

		it("should handle malformed hash and query combinations", () => {
			expect(normalizeUrl("https://example.com/path#hash?query=1")).toBe(
				"https://example.com/path",
			);
		});
	});

	describe("index file removal", () => {
		it("should remove index files by default", () => {
			expect(normalizeUrl("https://example.com/path/index.html")).toBe(
				"https://example.com/path",
			);
			expect(normalizeUrl("https://example.com/path/index.htm")).toBe(
				"https://example.com/path",
			);
			expect(normalizeUrl("https://example.com/path/index.asp")).toBe(
				"https://example.com/path",
			);
			expect(normalizeUrl("https://example.com/path/index.php")).toBe(
				"https://example.com/path",
			);
			expect(normalizeUrl("https://example.com/path/index.jsp")).toBe(
				"https://example.com/path",
			);
		});

		it("should preserve index files when removeIndex is false", () => {
			const opts = { removeIndex: false };
			expect(normalizeUrl("https://example.com/path/index.html", opts)).toBe(
				"https://example.com/path/index.html",
			);
		});

		it("should preserve paths containing 'index' as part of another word", () => {
			expect(normalizeUrl("https://example.com/reindex/page")).toBe(
				"https://example.com/reindex/page",
			);
		});

		it("should preserve query parameters when removing index files", () => {
			expect(normalizeUrl("https://example.com/path/index.html?param=1")).toBe(
				"https://example.com/path?param=1",
			);
		});
	});
});
