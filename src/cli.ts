#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import { DocumentManagementService } from "./store/DocumentManagementService";
import { FindVersionTool, ListLibrariesTool, ScrapeTool, SearchTool } from "./tools";

const formatOutput = (data: unknown) => JSON.stringify(data, null, 2);

async function main() {
  const docService = new DocumentManagementService();

  try {
    await docService.initialize();

    const tools = {
      listLibraries: new ListLibrariesTool(docService),
      findVersion: new FindVersionTool(docService),
      scrape: new ScrapeTool(docService),
      search: new SearchTool(docService),
    };

    const program = new Command();

    // Handle cleanup on SIGINT
    process.on("SIGINT", async () => {
      await docService.shutdown();
      process.exit(0);
    });

    program
      .name("docs-mcp")
      .description("CLI for managing documentation vector store")
      .version("1.0.0");

    program
      .command("scrape <library> <url>") // Remove <version> as positional
      .description("Scrape and index documentation from a URL")
      .option("-v, --version <string>", "Version of the library (optional)") // Add optional version flag
      .option("-p, --max-pages <number>", "Maximum pages to scrape", "100")
      .option("-d, --max-depth <number>", "Maximum navigation depth", "3")
      .option("-c, --max-concurrency <number>", "Maximum concurrent page requests", "3")
      .option("--ignore-errors", "Ignore errors during scraping", true)
      .action(async (library, url, options) => {
        // Update action parameters
        const result = await tools.scrape.execute({
          url,
          library,
          version: options.version, // Get version from options
          options: {
            maxPages: Number.parseInt(options.maxPages),
            maxDepth: Number.parseInt(options.maxDepth),
            maxConcurrency: Number.parseInt(options.maxConcurrency),
            ignoreErrors: options.ignoreErrors,
          },
        });
        console.log(`✅ Successfully scraped ${result.pagesScraped} pages`);
      });

    program
      .command("search <library> <query>") // Remove <version> as positional
      .description(
        "Search documents in a library. Version matching examples:\n" +
          "  - search react --version 18.0.0 'hooks' -> matches docs for React 18.0.0 or earlier versions\n" +
          "  - search react --version 18.0.0 'hooks' --exact-match -> only matches React 18.0.0\n" +
          "  - search typescript --version 5.x 'types' -> matches any TypeScript 5.x.x version\n" +
          "  - search typescript --version 5.2.x 'types' -> matches any TypeScript 5.2.x version",
      )
      .option(
        "-v, --version <string>", // Add optional version flag
        "Version of the library (optional, supports ranges)",
      )
      .option("-l, --limit <number>", "Maximum number of results", "5")
      .option(
        "-e, --exact-match",
        "Only use exact version match (e.g., '18.0.0' matches only 18.0.0, not 17.x.x) (default: false)",
        false,
      )
      .action(async (library, query, options) => {
        // Update action parameters
        const result = await tools.search.execute({
          library,
          version: options.version, // Get version from options
          query,
          limit: Number.parseInt(options.limit),
          exactMatch: options.exactMatch,
        });
        console.log(formatOutput(result.results));
      });

    program
      .command("list-libraries")
      .description("List all available libraries and their versions")
      .action(async () => {
        const result = await tools.listLibraries.execute();
        console.log(formatOutput(result.libraries));
      });

    program
      .command("find-version <library>") // Remove [targetVersion] positional
      .description("Find the best matching version for a library")
      .option(
        "-v, --version <string>", // Add optional version flag
        "Target version to match (optional, supports ranges)",
      )
      .action(async (library, options) => { // Update action parameters
        const versionInfo = await tools.findVersion.execute({
          library,
          targetVersion: options.version, // Get version from options
        });
        // findVersion.execute now returns a string, handle potential error messages within it
        if (!versionInfo) { // Should not happen with current tool logic, but good practice
          throw new Error("Failed to get version information");
        }
        console.log(versionInfo); // Log the descriptive string from the tool
      });

    await program.parseAsync();
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : String(error));
    await docService.shutdown();
    process.exit(1);
  }

  // Clean shutdown after successful execution
  await docService.shutdown();
  process.exit(0);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
