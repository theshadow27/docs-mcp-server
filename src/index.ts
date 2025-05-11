#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import type { FastifyInstance } from "fastify";
import packageJson from "../package.json";
import { startServer as startMcpServer, stopServer as stopMcpServer } from "./mcp";
import {
  getDocService,
  getPipelineManager,
  initializeServices,
  shutdownServices,
} from "./mcp/services";
import { FileFetcher, HttpFetcher } from "./scraper/fetcher";
import { ScrapeMode } from "./scraper/types";
import {
  FetchUrlTool,
  FindVersionTool,
  ListLibrariesTool,
  ScrapeTool,
  SearchTool,
} from "./tools";
import {
  DEFAULT_HTTP_PORT,
  DEFAULT_MAX_CONCURRENCY,
  DEFAULT_MAX_DEPTH,
  DEFAULT_MAX_PAGES,
  DEFAULT_PROTOCOL,
  DEFAULT_WEB_PORT,
} from "./utils/config";
import { LogLevel, logger, setLogLevel } from "./utils/logger";
import { startWebServer, stopWebServer } from "./web/web";

const formatOutput = (data: unknown) => JSON.stringify(data, null, 2);

// Module-level variables for server instances and shutdown state
let mcpServerRunning = false;
let webServerInstance: FastifyInstance | null = null;
// IS_SHUTTING_DOWN is a string "true" or "false" to be compatible with process.env
// It helps prevent re-entrant shutdown logic.
process.env.IS_SHUTTING_DOWN = "false";

const sigintHandler = async () => {
  if (process.env.IS_SHUTTING_DOWN === "true") return;
  process.env.IS_SHUTTING_DOWN = "true";

  logger.debug("Received SIGINT. Shutting down gracefully...");
  try {
    if (webServerInstance) {
      logger.debug("SIGINT: Stopping web server...");
      await stopWebServer(webServerInstance);
      webServerInstance = null;
      logger.debug("SIGINT: Web server stopped.");
    }
    if (mcpServerRunning) {
      logger.debug("SIGINT: Stopping MCP server instance...");
      await stopMcpServer(); // This now only stops the McpServer object
      mcpServerRunning = false;
      logger.debug("SIGINT: MCP server instance stopped.");
    }

    // Always attempt to shut down shared services, as they are global singletons
    // and might be running even if specific server flags are false, or need cleanup.
    logger.debug("SIGINT: Shutting down shared services...");
    await shutdownServices();
    logger.debug("SIGINT: Shared services shut down.");
  } catch (e) {
    logger.error(`❌ Error during shutdown: ${e}`);
  } finally {
    logger.debug("SIGINT: Shutdown process completed.");
    process.exit(0);
  }
};

async function main() {
  let commandExecuted = false;
  process.env.IS_SHUTTING_DOWN = "false"; // Reset for this execution run

  // Ensure only one SIGINT handler is active for this process instance,
  // especially important across HMR cycles if dispose isn't perfect.
  process.removeListener("SIGINT", sigintHandler);
  process.on("SIGINT", sigintHandler);

  try {
    await initializeServices();
    const docService = getDocService();
    const pipelineManager = getPipelineManager();

    const tools = {
      listLibraries: new ListLibrariesTool(docService),
      findVersion: new FindVersionTool(docService),
      scrape: new ScrapeTool(docService, pipelineManager),
      search: new SearchTool(docService),
      fetchUrl: new FetchUrlTool(new HttpFetcher(), new FileFetcher()),
    };

    const program = new Command();

    program
      .name("docs-mcp-server")
      .description("Unified CLI, MCP Server, and Web Interface for Docs MCP Server.")
      .version(packageJson.version)
      .option("--verbose", "Enable verbose (debug) logging", false)
      .option("--silent", "Disable all logging except errors", false)
      .enablePositionalOptions()
      .option(
        "--protocol <type>",
        "Protocol for MCP server (stdio or http)",
        DEFAULT_PROTOCOL,
      )
      .option(
        "--port <number>",
        "Port for MCP server (if http protocol)",
        DEFAULT_HTTP_PORT.toString(),
      );

    program.hook("preAction", (thisCommand, actionCommand) => {
      const globalOptions = thisCommand.opts();
      if (globalOptions.silent) setLogLevel(LogLevel.ERROR);
      else if (globalOptions.verbose) setLogLevel(LogLevel.DEBUG);
      if (actionCommand.name() !== program.name()) commandExecuted = true;
    });

    program
      .command("web")
      .description("Start the web interface")
      .option(
        "--port <number>",
        "Port for the web interface",
        DEFAULT_WEB_PORT.toString(),
      )
      .action(async (cmdOptions) => {
        commandExecuted = true;
        const port = Number.parseInt(cmdOptions.port, 10);
        if (Number.isNaN(port)) {
          console.error("Web port must be a number.");
          process.exit(1);
        }
        webServerInstance = await startWebServer(port, docService, pipelineManager);
        await new Promise(() => {}); // Keep alive
      });

    // ... (All other CLI command definitions: scrape, search, list, find-version, remove, fetch-url - remain unchanged) ...
    // --- Scrape Command ---
    program
      .command("scrape <library> <url>")
      .description("Scrape and index documentation from a URL")
      .option("-v, --version <string>", "Version of the library (optional)")
      .option(
        "-p, --max-pages <number>",
        "Maximum pages to scrape",
        DEFAULT_MAX_PAGES.toString(),
      )
      .option(
        "-d, --max-depth <number>",
        "Maximum navigation depth",
        DEFAULT_MAX_DEPTH.toString(),
      )
      .option(
        "-c, --max-concurrency <number>",
        "Maximum concurrent page requests",
        DEFAULT_MAX_CONCURRENCY.toString(),
      )
      .option("--ignore-errors", "Ignore errors during scraping", true)
      .option(
        "--scope <scope>",
        "Crawling boundary: 'subpages' (default), 'hostname', or 'domain'",
        (value) => {
          const validScopes = ["subpages", "hostname", "domain"];
          if (!validScopes.includes(value)) {
            console.warn(`Warning: Invalid scope '${value}'. Using default 'subpages'.`);
            return "subpages";
          }
          return value;
        },
        "subpages",
      )
      .option(
        "--no-follow-redirects",
        "Disable following HTTP redirects (default: follow redirects)",
      )
      .option(
        "--scrape-mode <mode>",
        `HTML processing strategy: '${ScrapeMode.Fetch}', '${ScrapeMode.Playwright}', '${ScrapeMode.Auto}' (default)`,
        (value: string): ScrapeMode => {
          const validModes = Object.values(ScrapeMode);
          if (!validModes.includes(value as ScrapeMode)) {
            console.warn(
              `Warning: Invalid scrape mode '${value}'. Using default '${ScrapeMode.Auto}'.`,
            );
            return ScrapeMode.Auto;
          }
          return value as ScrapeMode;
        },
        ScrapeMode.Auto,
      )
      .action(async (library, url, options) => {
        const result = await tools.scrape.execute({
          url,
          library,
          version: options.version,
          options: {
            maxPages: Number.parseInt(options.maxPages),
            maxDepth: Number.parseInt(options.maxDepth),
            maxConcurrency: Number.parseInt(options.maxConcurrency),
            ignoreErrors: options.ignoreErrors,
            scope: options.scope,
            followRedirects: options.followRedirects,
            scrapeMode: options.scrapeMode,
          },
        });
        if ("pagesScraped" in result)
          console.log(`✅ Successfully scraped ${result.pagesScraped} pages`);
        else console.log(`🚀 Scraping job started with ID: ${result.jobId}`);
      });

    // --- Search Command ---
    program
      .command("search <library> <query>")
      .description(
        "Search documents in a library. Version matching examples:\n" +
          "  - search react --version 18.0.0 'hooks' -> matches docs for React 18.0.0 or earlier versions\n" +
          "  - search react --version 18.0.0 'hooks' --exact-match -> only matches React 18.0.0\n" +
          "  - search typescript --version 5.x 'types' -> matches any TypeScript 5.x.x version\n" +
          "  - search typescript --version 5.2.x 'types' -> matches any TypeScript 5.2.x version",
      )
      .option(
        "-v, --version <string>",
        "Version of the library (optional, supports ranges)",
      )
      .option("-l, --limit <number>", "Maximum number of results", "5")
      .option("-e, --exact-match", "Only use exact version match (default: false)", false)
      .action(async (library, query, options) => {
        const result = await tools.search.execute({
          library,
          version: options.version,
          query,
          limit: Number.parseInt(options.limit),
          exactMatch: options.exactMatch,
        });
        console.log(formatOutput(result.results));
      });

    // --- List Command ---
    program
      .command("list")
      .description("List all available libraries and their versions")
      .action(async () => {
        const result = await tools.listLibraries.execute();
        console.log(formatOutput(result.libraries));
      });

    // --- Find Version Command ---
    program
      .command("find-version <library>")
      .description("Find the best matching version for a library")
      .option("-v, --version <string>", "Pattern to match (optional, supports ranges)")
      .action(async (library, options) => {
        const versionInfo = await tools.findVersion.execute({
          library,
          targetVersion: options.version,
        });
        if (!versionInfo) throw new Error("Failed to get version information");
        console.log(versionInfo);
      });

    // --- Remove Command ---
    program
      .command("remove <library>")
      .description("Remove documents for a specific library and version")
      .option(
        "-v, --version <string>",
        "Version to remove (optional, removes unversioned if omitted)",
      )
      .action(async (library, options) => {
        const { version } = options;
        try {
          await docService.removeAllDocuments(library, version);
          console.log(
            `✅ Successfully removed documents for ${library}${version ? `@${version}` : " (unversioned)"}.`,
          );
        } catch (error) {
          console.error(
            `❌ Failed to remove documents for ${library}${version ? `@${version}` : " (unversioned)"}:`,
            error instanceof Error ? error.message : String(error),
          );
          throw error;
        }
      });

    // --- Fetch URL Command ---
    program
      .command("fetch-url <url>")
      .description("Fetch a URL and convert its content to Markdown")
      .option(
        "--no-follow-redirects",
        "Disable following HTTP redirects (default: follow redirects)",
      )
      .option(
        "--scrape-mode <mode>",
        `HTML processing strategy: '${ScrapeMode.Fetch}', '${ScrapeMode.Playwright}', '${ScrapeMode.Auto}' (default)`,
        (value: string): ScrapeMode => {
          const validModes = Object.values(ScrapeMode);
          if (!validModes.includes(value as ScrapeMode)) {
            console.warn(
              `Warning: Invalid scrape mode '${value}'. Using default '${ScrapeMode.Auto}'.`,
            );
            return ScrapeMode.Auto;
          }
          return value as ScrapeMode;
        },
        ScrapeMode.Auto,
      )
      .action(async (url, options) => {
        const content = await tools.fetchUrl.execute({
          url,
          followRedirects: options.followRedirects,
          scrapeMode: options.scrapeMode,
        });
        console.log(content);
      });

    program.action(async (options) => {
      if (!commandExecuted) {
        logger.debug("No subcommand specified, starting MCP server by default...");
        const protocol = options.protocol as "stdio" | "http";
        const port = Number.parseInt(options.port, 10);
        if (protocol !== "stdio" && protocol !== "http") {
          console.error('Invalid protocol specified. Use "stdio" or "http".');
          process.exit(1);
        }
        if (protocol === "http" && Number.isNaN(port)) {
          console.error("Port must be a number when using http protocol.");
          process.exit(1);
        }
        mcpServerRunning = true;
        await startMcpServer(protocol, protocol === "http" ? port : undefined);
        await new Promise(() => {});
      }
    });

    await program.parseAsync(process.argv);
  } catch (error) {
    logger.error(`❌ Error in main: ${error}`);
    if (process.env.IS_SHUTTING_DOWN !== "true") {
      process.env.IS_SHUTTING_DOWN = "true";
      if (webServerInstance) await stopWebServer(webServerInstance);
      if (mcpServerRunning) await stopMcpServer();
      else await shutdownServices();
    }
    process.exit(1);
  }

  if (commandExecuted && !webServerInstance && !mcpServerRunning) {
    if (process.env.IS_SHUTTING_DOWN !== "true") {
      // Avoid if SIGINT already handled
      await shutdownServices();
    }
  }
}

main().catch((error) => {
  if (process.env.IS_SHUTTING_DOWN !== "true") {
    logger.error(`🔥 Fatal error in main execution: ${error}`);
    shutdownServices().catch((err) =>
      logger.error(`❌ Error during fatal shutdown cleanup: ${err}`),
    );
  }
  process.exit(1); // Ensure exit on fatal error
});

// Handle HMR for vite-node --watch
if (import.meta.hot) {
  import.meta.hot.on("vite:beforeFullReload", async () => {
    logger.info("🔥 Hot reload detected");
    process.removeListener("SIGINT", sigintHandler); // Remove for this outgoing instance

    // Set shutting down flag for HMR context
    const wasAlreadyShuttingDown = process.env.IS_SHUTTING_DOWN === "true";
    process.env.IS_SHUTTING_DOWN = "true";

    try {
      if (webServerInstance) {
        logger.debug("Shutting down web server...");
        await stopWebServer(webServerInstance);
        logger.info("✅ Web server shut down.");
      }
      if (mcpServerRunning) {
        logger.debug("Shutting down MCP server...");
        await stopMcpServer();
        logger.info("✅ MCP server shut down.");
      }
      // Always attempt to shut down shared services during HMR
      // as they are singletons and need reset for the next module instance.
      logger.debug("Shutting down shared services...");
      await shutdownServices();
      logger.info("✅ Shared services shut down.");
    } catch (hmrError) {
      logger.error(`❌ Error during cleanup: ${hmrError}`);
    } finally {
      // Reset state for the next module instantiation
      webServerInstance = null;
      mcpServerRunning = false;
      if (!wasAlreadyShuttingDown) {
        // Only reset if HMR initiated the shutdown flag
        process.env.IS_SHUTTING_DOWN = "false";
      }
    }
  });
}
