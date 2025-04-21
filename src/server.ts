#!/usr/bin/env node
import "dotenv/config";
import { program } from "commander";
import { startServer } from "./mcp/index.js";
import { DEFAULT_HTTP_PORT, DEFAULT_PROTOCOL } from "./utils/config.js";

program
  .option("--protocol <type>", "Protocol to use (stdio or http)", DEFAULT_PROTOCOL)
  .option(
    "--port <number>",
    "Port to listen on for http protocol",
    `${DEFAULT_HTTP_PORT}`,
  )
  .parse(process.argv);

const options = program.opts();

async function main() {
  const protocol = options.protocol;
  const port = Number.parseInt(options.port, 10);

  if (protocol !== "stdio" && protocol !== "http") {
    console.error('Invalid protocol specified. Use "stdio" or "http".');
    process.exit(1);
  }

  if (protocol === "http" && Number.isNaN(port)) {
    console.error("Port must be a number when using http protocol.");
    process.exit(1);
  }

  try {
    await startServer(protocol, protocol === "http" ? port : undefined);
  } catch (error) {
    console.error(`Server failed to start: ${error}`);
    process.exit(1);
  }
}

main();
