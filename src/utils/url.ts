import { InvalidUrlError } from "./errors";

interface UrlNormalizerOptions {
	ignoreCase?: boolean;
	removeHash?: boolean;
	removeTrailingSlash?: boolean;
	removeQuery?: boolean;
	removeIndex?: boolean;
}

const defaultNormalizerOptions: UrlNormalizerOptions = {
	ignoreCase: true,
	removeHash: true,
	removeTrailingSlash: true,
	removeQuery: false,
	removeIndex: true,
};

export function normalizeUrl(
	url: string,
	options: UrlNormalizerOptions = defaultNormalizerOptions,
): string {
	try {
		const parsedUrl = new URL(url);
		const finalOptions = { ...defaultNormalizerOptions, ...options };

		// Create a new URL to ensure proper structure
		const normalized = new URL(parsedUrl.origin + parsedUrl.pathname);

		// Remove index files first, before handling trailing slashes
		if (finalOptions.removeIndex) {
			normalized.pathname = normalized.pathname.replace(
				/\/index\.(html|htm|asp|php|jsp)$/i,
				"/",
			);
		}

		// Handle trailing slash
		if (finalOptions.removeTrailingSlash && normalized.pathname.length > 1) {
			normalized.pathname = normalized.pathname.replace(/\/+$/, "");
		}

		// Keep original parts we want to preserve
		const preservedHash = !finalOptions.removeHash ? parsedUrl.hash : "";
		const preservedSearch = !finalOptions.removeQuery ? parsedUrl.search : "";

		// Construct final URL string in correct order (query before hash)
		let result = normalized.origin + normalized.pathname;
		if (preservedSearch) {
			result += preservedSearch;
		}
		if (preservedHash) {
			result += preservedHash;
		}

		// Apply case normalization if configured
		if (finalOptions.ignoreCase) {
			result = result.toLowerCase();
		}

		return result;
	} catch {
		return url; // Return original URL if parsing fails
	}
}

/**
 * Validates if a string is a valid URL
 * @throws {InvalidUrlError} If the URL is invalid
 */
export function validateUrl(url: string): void {
	try {
		new URL(url);
	} catch (error) {
		throw new InvalidUrlError(url, error instanceof Error ? error : undefined);
	}
}

export type { UrlNormalizerOptions };
