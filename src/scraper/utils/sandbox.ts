import { createContext, runInContext } from "node:vm";
import { type DOMWindow, JSDOM } from "jsdom";
import { logger } from "../../utils/logger";

/**
 * Options for executing JavaScript in a sandboxed JSDOM environment.
 */
export interface SandboxExecutionOptions {
  /** The source URL to associate with the JSDOM instance. */
  url: string;
  /** Maximum execution time for all scripts in milliseconds. Defaults to 5000. */
  timeout?: number;
  /** Initial HTML content. */
  html: string;
}

/**
 * Result of executing JavaScript in a sandboxed JSDOM environment.
 */
export interface SandboxExecutionResult {
  /** The final HTML content after script execution. */
  finalHtml: string;
  /** The JSDOM window object after script execution. */
  window: DOMWindow;
  /** Any errors encountered during script execution. */
  errors: Error[];
}

const DEFAULT_TIMEOUT = 5000; // 5 seconds

/**
 * Executes JavaScript found within an HTML string inside a secure JSDOM sandbox.
 * Uses Node.js `vm` module for sandboxing.
 *
 * @param options - The execution options.
 * @returns A promise resolving to the execution result.
 */
export async function executeJsInSandbox(
  options: SandboxExecutionOptions,
): Promise<SandboxExecutionResult> {
  const { html, url, timeout = DEFAULT_TIMEOUT } = options;
  const errors: Error[] = [];
  let jsdom: JSDOM | undefined;

  try {
    logger.debug(`Creating JSDOM sandbox for ${url}`);
    // Create JSDOM instance *without* running scripts immediately
    jsdom = new JSDOM(html, {
      url,
      runScripts: "outside-only", // We'll run scripts manually in the VM
      pretendToBeVisual: true, // Helps with some scripts expecting a visual environment
      // Consider adding resources: "usable" if scripts need to fetch external resources,
      // but be aware of security implications.
    });

    const { window } = jsdom;

    // Create a VM context with the JSDOM window globals
    // Note: This provides access to the DOM, but not Node.js globals by default
    const context = createContext({
      ...window, // Spread window properties into the context
      window, // Provide window object itself
      document: window.document,
      // Add other globals if needed, e.g., console, setTimeout, etc.
      // Be cautious about exposing potentially harmful APIs.
      console: {
        log: (...args: unknown[]) => logger.debug(`Sandbox log: ${JSON.stringify(args)}`),
        warn: (...args: unknown[]) =>
          logger.debug(`Sandbox warn: ${JSON.stringify(args)}`),
        error: (...args: unknown[]) =>
          logger.debug(`Sandbox error: ${JSON.stringify(args)}`),
      },
      setTimeout: window.setTimeout.bind(window),
      clearTimeout: window.clearTimeout.bind(window),
      setInterval: window.setInterval.bind(window),
      clearInterval: window.clearInterval.bind(window),
    });

    // Find all script elements in the document
    const scripts = Array.from(window.document.querySelectorAll("script"));
    logger.debug(`Found ${scripts.length} script(s) to execute in sandbox for ${url}`);

    for (const script of scripts) {
      const scriptContent = script.textContent || "";
      const scriptSrc = script.src;

      if (scriptSrc) {
        // TODO (#18): Implement fetching and executing external scripts securely.
        // This requires careful consideration of security (CORS, resource limits).
        // For now, we'll skip external scripts.
        logger.warn(
          `Skipping external script execution (src=${scriptSrc}) in sandbox for ${url}. Feature not yet implemented.`,
        );
        continue;
      }

      if (!scriptContent.trim()) {
        continue; // Skip empty inline scripts
      }

      logger.debug(`Executing inline script in sandbox for ${url}`);
      try {
        // Execute the script content within the VM context
        runInContext(scriptContent, context, {
          timeout,
          displayErrors: true, // Let VM handle basic error formatting
        });
      } catch (error) {
        const executionError =
          error instanceof Error
            ? error
            : new Error(`Script execution failed: ${String(error)}`);
        logger.error(
          `Error executing script in sandbox for ${url}: ${executionError.message}`,
        );
        errors.push(executionError);
        // Decide whether to continue with other scripts or stop on first error
        // For now, let's continue
      }
    }

    // Serialize the final state of the DOM after script execution
    const finalHtml = jsdom.serialize();
    logger.debug(`Sandbox execution finished for ${url}`);

    return {
      finalHtml,
      window,
      errors,
    };
  } catch (error) {
    const setupError =
      error instanceof Error
        ? error
        : new Error(`Sandbox setup failed: ${String(error)}`);
    logger.error(`Error setting up sandbox for ${url}: ${setupError.message}`);
    // Always wrap the error to provide context
    const wrappedError = new Error(
      `Sandbox setup failed for ${url}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
    logger.error(wrappedError.message); // Log the wrapped error message
    errors.push(wrappedError);
    // If setup fails, return the original HTML and any errors
    return {
      finalHtml: html,
      window: jsdom?.window ?? ({} as DOMWindow), // Provide an empty object if window creation failed
      errors,
    };
  } finally {
    // Clean up the JSDOM window to free resources, especially if timers were set
    jsdom?.window?.close();
  }
}
