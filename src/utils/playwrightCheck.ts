import { chromium } from "playwright";
import { logger } from "./logger";

/**
 * Checks if Playwright browser is available and can be launched.
 * @param timeout Maximum time to wait for browser launch (in milliseconds)
 * @returns true if browser is available, false otherwise
 */
export async function isPlaywrightAvailable(timeout = 5000): Promise<boolean> {
  let browser = null;
  let timeoutId: NodeJS.Timeout | null = null;

  try {
    // Create a promise that rejects after timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error("Playwright browser launch timeout"));
      }, timeout);
    });

    // Try to launch browser with timeout
    browser = await Promise.race([
      chromium.launch({
        headless: true,
        timeout: timeout,
      }),
      timeoutPromise,
    ]);

    // If we got here, browser launched successfully
    logger.debug("✅ Playwright browser is available");
    return true;
  } catch (error) {
    logger.warn(
      `⚠️  Playwright browser not available: ${error instanceof Error ? error.message : String(error)}`,
    );
    return false;
  } finally {
    // Clean up timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    // Clean up browser if it was launched
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        logger.debug("Failed to close test browser:", closeError);
      }
    }
  }
}
