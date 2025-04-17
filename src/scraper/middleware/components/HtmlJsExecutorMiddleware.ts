import { logger } from "../../../utils/logger";
import { executeJsInSandbox } from "../../utils/sandbox"; // Updated import path
import type { ContentProcessingContext, ContentProcessorMiddleware } from "../types";

/**
 * Middleware to parse HTML content and execute embedded JavaScript within a secure sandbox.
 * It uses the `executeJsInSandbox` utility (Node.js `vm` + JSDOM) to run scripts.
 *
 * This middleware updates `context.content` with the HTML *after* script execution.
 * It may also populate `context.dom` with the final JSDOM window object, although
 * subsequent standard middleware should rely on the updated `context.content`.
 */
export class HtmlJsExecutorMiddleware implements ContentProcessorMiddleware {
  async process(
    context: ContentProcessingContext,
    next: () => Promise<void>,
  ): Promise<void> {
    // Only process HTML content
    if (!context.contentType.startsWith("text/html")) {
      await next();
      return;
    }

    // Ensure content is a string for the sandbox
    const initialHtml =
      typeof context.content === "string"
        ? context.content
        : Buffer.from(context.content).toString("utf-8");

    try {
      logger.debug(
        `Executing JavaScript in sandbox for HTML content from ${context.source}`,
      );

      // TODO: Plumb timeout options from context.options if available
      const sandboxOptions = {
        html: initialHtml,
        url: context.source,
        // timeout: context.options?.scriptTimeout // Example for future enhancement
      };

      const result = await executeJsInSandbox(sandboxOptions);

      // Update context content with the HTML after script execution
      context.content = result.finalHtml;

      // Optionally, update the DOM object as well for potential custom middleware use
      context.dom = result.window;

      // Add any errors encountered during script execution to the context
      if (result.errors.length > 0) {
        context.errors.push(...result.errors);
        logger.warn(
          `Encountered ${result.errors.length} error(s) during sandbox execution for ${context.source}`,
        );
      }

      logger.debug(
        `Sandbox execution completed for ${context.source}. Proceeding with updated content.`,
      );

      // Proceed to the next middleware with the modified context
      await next();
    } catch (error) {
      // Catch errors related to the middleware execution itself (e.g., sandbox call failing unexpectedly)
      // Ensure the error message clearly indicates the middleware source
      const baseMessage = `HtmlJsExecutorMiddleware failed for ${context.source}`;
      const errorMessage = error instanceof Error ? error.message : String(error);
      const processingError = new Error(`${baseMessage}: ${errorMessage}`, {
        cause: error, // Preserve original error cause if available
      });

      logger.error(processingError.message); // Log the combined message
      context.errors.push(processingError);
      // Do not proceed further down the pipeline if the executor itself fails critically
      return;
    }
  }
}
