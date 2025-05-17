// Utility for scope filtering, extracted from WebScraperStrategy
import type { URL } from "node:url";

/**
 * Returns true if the targetUrl is in scope of the baseUrl for the given scope.
 * - "subpages": same hostname, and target path starts with the parent directory of the base path
 * - "hostname": same hostname
 * - "domain": same top-level domain (e.g. example.com)
 */
export function isInScope(
  baseUrl: URL,
  targetUrl: URL,
  scope: "subpages" | "hostname" | "domain",
): boolean {
  if (baseUrl.protocol !== targetUrl.protocol) return false;
  switch (scope) {
    case "subpages": {
      if (baseUrl.hostname !== targetUrl.hostname) return false;
      // Use the parent directory of the base path
      const baseDir = baseUrl.pathname.endsWith("/")
        ? baseUrl.pathname
        : baseUrl.pathname.replace(/\/[^/]*$/, "/");
      return targetUrl.pathname.startsWith(baseDir);
    }
    case "hostname":
      return baseUrl.hostname === targetUrl.hostname;
    case "domain": {
      // Compare the last two segments of the hostname (e.g. example.com)
      const getDomain = (host: string) => host.split(".").slice(-2).join(".");
      return getDomain(baseUrl.hostname) === getDomain(targetUrl.hostname);
    }
    default:
      return false;
  }
}
