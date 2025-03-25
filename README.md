# docs-mcp-server MCP Server

A MCP server for fetching and searching 3rd party package documentation

## CLI Usage

The `docs-mcp` CLI provides commands for managing documentation. To see available commands and options:

```bash
# Show all commands
docs-mcp --help

# Show help for a specific command
docs-mcp scrape --help
docs-mcp search --help
```

### Version Handling

This server supports partial version matching, selecting the best available version based on these rules:

- If no version is specified, the latest indexed version is used.
- If a full version (e.g., `1.2.3`) is specified, that exact version is used, if available.
- If a partial version (e.g., `1.2`) is specified, the latest matching version (e.g., `1.2.5`) is used.
- If the specified version (full or partial) is not found, the server will attempt to find the closest preceding version.

## Development

Install dependencies:

```bash
npm install
```

Build the server:

```bash
npm run build
```

### Environment Setup

1. Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

2. Update your OpenAI API key in `.env`:

```
OPENAI_API_KEY=your-api-key-here
```

3. Start the MCP server:

The MCP server provides two endpoints:

- SSE endpoint: http://localhost:8000/sse
- POST messages: http://localhost:8000/message

## Installation

To use with Claude Desktop, add the server config:

- On MacOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- On Windows: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "docs-mcp-server": {
      "command": "node",
      "args": ["/path/to/docs-mcp-server/dist/server.js"],
      "env": {
        "OPENAI_API_KEY": "sk-proj-..."
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

### Debugging

Since MCP servers communicate over stdio, debugging can be challenging. We recommend using the [MCP Inspector](https://github.com/modelcontextprotocol/inspector), which is available as a package script:

```bash
npx @modelcontextprotocol/inspector node dist/server.js
```

The Inspector will provide a URL to access debugging tools in your browser.
