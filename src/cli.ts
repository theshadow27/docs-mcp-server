#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import path from "node:path";
import os from "node:os";
import { VectorStoreService } from "./store/VectorStoreService.js";
import {
  FindVersionTool,
  ListLibrariesTool,
  ScrapeTool,
  SearchTool,
} from "./tools";

const formatOutput = (data: unknown) => JSON.stringify(data, null, 2);

async function main() {
  const storeService = new VectorStoreService();

  try {
    await storeService.initialize();

    const tools = {
      listLibraries: new ListLibrariesTool(storeService),
      findVersion: new FindVersionTool(storeService),
      scrape: new ScrapeTool(storeService),
      search: new SearchTool(storeService),
    };

    const program = new Command();

    // Handle cleanup on SIGINT
    process.on("SIGINT", async () => {
      await storeService.shutdown();
      process.exit(0);
    });

    program
      .name("docs-mcp")
      .description("CLI for managing documentation vector store")
      .version("1.0.0");

    program
      .command("scrape <library> <version> <url>")
      .description("Scrape and index documentation from a URL")
      .option("-p, --max-pages <number>", "Maximum pages to scrape", "100")
      .option("-d, --max-depth <number>", "Maximum navigation depth", "3")
      .option(
        "--subpages-only",
        "Allow scraping pages outside the initial URL path",
        true
      )
      .action(async (library, version, url, options) => {
        const result = await tools.scrape.execute({
          url,
          library,
          version,
          options: {
            maxPages: Number.parseInt(options.maxPages),
            maxDepth: Number.parseInt(options.maxDepth),
          },
        });
        console.log(`✅ Successfully scraped ${result.pagesScraped} pages`);
      });

    program
      .command("search <library> <version> <query>")
      .description(
        "Search documents in a library. Version matching examples:\n" +
          "  - search react 18.0.0 'hooks' -> matches docs for React 18.0.0 or earlier versions\n" +
          "  - search react 18.0.0 'hooks' --exact-match -> only matches React 18.0.0\n" +
          "  - search typescript 5.x 'types' -> matches any TypeScript 5.x.x version\n" +
          "  - search typescript 5.2.x 'types' -> matches any TypeScript 5.2.x version"
      )
      .option("-l, --limit <number>", "Maximum number of results", "5")
      .option(
        "-e, --exact-match",
        "Only use exact version match (e.g., '18.0.0' matches only 18.0.0, not 17.x.x) (default: false)",
        false
      )
      .action(async (library, version, query, options) => {
        const result = await tools.search.execute({
          library,
          version,
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
      .command("find-version <library> [targetVersion]")
      .description("Find the best matching version for a library")
      .action(async (library, targetVersion) => {
        const version = await tools.findVersion.execute({
          library,
          targetVersion,
        });
        if (!version) {
          throw new Error("No matching version found");
        }
        console.log(version);
      });

    await program.parseAsync();
  } catch (error) {
    console.error(
      "Error:",
      error instanceof Error ? error.message : String(error)
    );
    await storeService.shutdown();
    process.exit(1);
  }

  // Clean shutdown after successful execution
  await storeService.shutdown();
  process.exit(0);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
