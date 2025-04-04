# docs-mcp-server MCP Server

A MCP server for fetching and searching 3rd party package documentation.

This project provides a Model Context Protocol (MCP) server designed to scrape, process, index, and search documentation for various software libraries and packages. It fetches content from specified URLs, splits it into meaningful chunks using semantic splitting techniques, generates vector embeddings using OpenAI, and stores the data in an SQLite database. The server utilizes `sqlite-vec` for efficient vector similarity search and FTS5 for full-text search capabilities, combining them for hybrid search results. It supports versioning, allowing documentation for different library versions (including unversioned content) to be stored and queried distinctly.

The scraping process is managed by an asynchronous job queue (`PipelineManager`), allowing multiple scrape jobs to run concurrently.

The server exposes MCP tools for:

- Starting a scraping job (`scrape_docs`): Returns a `jobId` immediately.
- Checking job status (`get_job_status`): Retrieves the current status and progress of a specific job.
- Listing active/completed jobs (`list_jobs`): Shows recent and ongoing jobs.
- Cancelling a job (`cancel_job`): Attempts to stop a running or queued job.
- Searching documentation (`search_docs`).
- Listing indexed libraries (`list_libraries`).
- Finding appropriate versions (`find_version`).
- Removing indexed documents (`remove_docs`).

## Usage

Once the package is published to npm (`@arabold/docs-mcp-server`), you can run the server or the companion CLI in two main ways:

### Method 1: Global Installation (Recommended for CLI Usage)

Install the package globally using npm. This makes the `docs-server` and `docs-cli` commands directly available in your terminal.

1.  **Install Globally:**
    ```bash
    npm install -g @arabold/docs-mcp-server
    ```
2.  **Run the Server:**
    ```bash
    docs-server
    ```
    _(Note: You'll need to manage environment variables like `OPENAI_API_KEY` yourself when running this way, e.g., by setting them in your shell profile or using a tool like `dotenv`.)_
3.  **Run the CLI:**
    ```bash
    docs-cli <command> [options]
    ```
    (See "CLI Command Reference" below for available commands and options.)

This method is convenient if you plan to use the `docs-cli` frequently.

### Method 2: Direct Execution with `npx` (Recommended for MCP Integration)

Run the server or CLI directly using `npx` without needing a global installation. The `-y` flag ensures the package is automatically downloaded if needed.

1.  **Run the Server (e.g., for MCP Integration):**

    ```bash
    npx -y --package=@arabold/docs-mcp-server docs-server
    ```

    This is the recommended approach for integrating with tools like Claude Desktop or Cline, as it avoids polluting the global namespace and ensures the correct version is used.

    **Claude/Cline Configuration Example:**
    Add the following configuration block to your MCP settings file (adjust path as needed):

    - Cline: `/Users/andrerabold/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`
    - Claude Desktop (MacOS): `~/Library/Application Support/Claude/claude_desktop_config.json`
    - Claude Desktop (Windows): `%APPDATA%/Claude/claude_desktop_config.json`

    ```json
    {
      "mcpServers": {
        "docs-mcp-server": {
          "command": "npx",
          "args": ["-y", "--package=@arabold/docs-mcp-server", "docs-server"],
          "env": {
            "OPENAI_API_KEY": "sk-proj-..." // Required: Replace with your key
          },
          "disabled": false,
          "autoApprove": []
        }
        // ... other servers might be listed here
      }
    }
    ```

    Remember to replace `"sk-proj-..."` with your actual OpenAI API key and restart the application.

2.  **Run the CLI:**
    ```bash
    npx -y --package=@arabold/docs-mcp-server docs-cli <command> [options]
    ```
    (See "CLI Command Reference" below for available commands and options.)

This method is ideal for one-off executions or when integrating the server into other tools.

## CLI Command Reference

The `docs-cli` provides commands for managing the documentation index. Access it either via global installation (`docs-cli ...`) or `npx` (`npx -y --package=@arabold/docs-mcp-server docs-cli ...`).

**General Help:**

```bash
docs-cli --help
# or
npx -y --package=@arabold/docs-mcp-server docs-cli --help
```

**Command Specific Help:** (Replace `docs-cli` with the `npx...` command if not installed globally)

```bash
docs-cli scrape --help
docs-cli search --help
docs-cli find-version --help
docs-cli remove --help
docs-cli list-libraries --help
```

### Scraping Documentation (`scrape`)

Scrapes and indexes documentation from a given URL for a specific library.

```bash
docs-cli scrape <library> <url> [options]
```

**Options:**

- `-v, --version <string>`: The specific version to associate with the scraped documents.
  - Accepts full versions (`1.2.3`), pre-release versions (`1.2.3-beta.1`), or partial versions (`1`, `1.2` which are expanded to `1.0.0`, `1.2.0`).
  - If omitted, the documentation is indexed as **unversioned**.
- `-p, --max-pages <number>`: Maximum pages to scrape (default: 100).
- `-d, --max-depth <number>`: Maximum navigation depth (default: 3).
- `-c, --max-concurrency <number>`: Maximum concurrent requests (default: 3).
- `--ignore-errors`: Ignore errors during scraping (default: true).

**Examples:**

```bash
# Scrape React 18.2.0 docs (assuming global install)
docs-cli scrape react --version 18.2.0 https://react.dev/

# Scrape React docs without a specific version (using npx)
npx -y --package=@arabold/docs-mcp-server docs-cli scrape react https://react.dev/
```

### Searching Documentation (`search`)

Searches the indexed documentation for a library, optionally filtering by version.

```bash
docs-cli search <library> <query> [options]
```

**Options:**

- `-v, --version <string>`: The target version or range to search within.
  - Supports exact versions (`18.0.0`), partial versions (`18`), or ranges (`18.x`).
  - If omitted, searches the **latest** available indexed version.
  - If a specific version/range doesn't match, it falls back to the latest indexed version _older_ than the target.
  - To search **only unversioned** documents, explicitly pass an empty string: `--version ""`. (Note: Omitting `--version` searches latest, which _might_ be unversioned if no other versions exist).
- `-l, --limit <number>`: Maximum number of results (default: 5).
- `-e, --exact-match`: Only match the exact version specified (disables fallback and range matching) (default: false).

**Examples:**

```bash
# Search latest React docs for 'hooks'
docs-cli search react 'hooks'

# Search React 18.x docs for 'hooks' (using npx)
npx -y --package=@arabold/docs-mcp-server docs-cli search react --version 18.x 'hooks'
```

### Finding Available Versions (`find-version`)

Checks the index for the best matching version for a library based on a target, and indicates if unversioned documents exist.

```bash
docs-cli find-version <library> [options]
```

**Options:**

- `-v, --version <string>`: The target version or range. If omitted, finds the latest available version.

**Examples:**

```bash
# Find the latest indexed version for react
docs-cli find-version react
```

### Listing Libraries (`list-libraries`)

Lists all libraries currently indexed in the store.

```bash
docs-cli list-libraries
```

### Removing Documentation (`remove`)

Removes indexed documents for a specific library and version.

```bash
docs-cli remove <library> [options]
```

**Options:**

- `-v, --version <string>`: The specific version to remove. If omitted, removes **unversioned** documents for the library.

**Examples:**

```bash
# Remove React 18.2.0 docs
docs-cli remove react --version 18.2.0
```

### Version Handling Summary

- **Scraping:** Requires a specific, valid version (`X.Y.Z`, `X.Y.Z-pre`, `X.Y`, `X`) or no version (for unversioned docs). Ranges (`X.x`) are invalid for scraping.
- **Searching/Finding:** Accepts specific versions, partials, or ranges (`X.Y.Z`, `X.Y`, `X`, `X.x`). Falls back to the latest older version if the target doesn't match. Omitting the version targets the latest available. Explicitly searching `--version ""` targets unversioned documents.
- **Unversioned Docs:** Libraries can have documentation stored without a specific version (by omitting `--version` during scrape). These can be searched explicitly using `--version ""`. The `find-version` command will also report if unversioned docs exist alongside any semver matches.

## Development & Advanced Setup

This section covers running the server/CLI using Docker or directly from the source code for development purposes.

### Running with Docker

This provides an isolated environment and exposes the server via HTTP endpoints.

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/arabold/docs-mcp-server.git # Replace with actual URL if different
    cd docs-mcp-server
    ```
2.  **Create `.env` file:**
    Copy the example and add your OpenAI key (see "Environment Setup" below).
    ```bash
    cp .env.example .env
    # Edit .env and add your OPENAI_API_KEY
    ```
3.  **Build the Docker image:**
    ```bash
    docker build -t docs-mcp-server .
    ```
4.  **Run the Docker container:**

    ```bash
    docker run -p 8000:8000 --env-file .env --name docs-mcp-server-container docs-mcp-server
    ```

    - `-p 8000:8000`: Maps host port 8000 to container port 8000.
    - `--env-file .env`: Loads environment variables from your local `.env`.
    - `--name docs-mcp-server-container`: Assigns a container name.

5.  **Available Endpoints:**
    - SSE: `http://localhost:8000/sse`
    - POST Messages: `http://localhost:8000/message`

### Running from Source (Development)

This method is required for contributing to the project or running un-published versions.

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/arabold/docs-mcp-server.git # Replace with actual URL if different
    cd docs-mcp-server
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Build the project:**
    This compiles TypeScript to JavaScript in the `dist/` directory.
    ```bash
    npm run build
    ```
4.  **Setup Environment:**
    Create and configure your `.env` file as described in "Environment Setup" below. This is crucial for providing the `OPENAI_API_KEY`.

5.  **Run:**
    - **Server (Development Mode):** `npm run dev:server` (builds, watches, and restarts)
    - **Server (Production Mode):** `npm run start` (runs pre-built code)
    - **CLI:** `npm run cli -- <command> [options]` or `node dist/cli.js <command> [options]`

### Environment Setup (for Source/Docker)

**Note:** This `.env` file setup is primarily needed when running the server from source or using the Docker method. When using the `npx` integration method, the `OPENAI_API_KEY` is set directly in the MCP configuration file.

1. Create a `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```
2. Update your OpenAI API key in `.env`:
   ```
   OPENAI_API_KEY=your-api-key-here
   ```

### Debugging (from Source)

Since MCP servers communicate over stdio when run directly via Node.js, debugging can be challenging. We recommend using the [MCP Inspector](https://github.com/modelcontextprotocol/inspector), which is available as a package script after building:

```bash
npx @modelcontextprotocol/inspector node dist/server.js
```

The Inspector will provide a URL to access debugging tools in your browser.

### Releasing

This project uses [semantic-release](https://github.com/semantic-release/semantic-release) and [Conventional Commits](https://www.conventionalcommits.org/) to automate the release process.

**How it works:**

1.  **Commit Messages:** All commits merged into the `main` branch **must** follow the Conventional Commits specification.
2.  **Automation:** The "Release" GitHub Actions workflow automatically runs `semantic-release` on pushes to `main`.
3.  **`semantic-release` Actions:** Determines version, updates `CHANGELOG.md` & `package.json`, commits, tags, publishes to npm, and creates a GitHub Release.

**What you need to do:**

- Use Conventional Commits.
- Merge to `main`.

**Automation handles:** Changelog, version bumps, tags, npm publish, GitHub releases.

### Architecture

For details on the project's architecture and design principles, please see [ARCHITECTURE.md](ARCHITECTURE.md).

_Notably, the vast majority of this project's code was generated by the AI assistant Cline, leveraging the capabilities of this very MCP server._
