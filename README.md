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

### Docker Compose

The project includes a Docker Compose setup with PostgreSQL (with pgvector extension) and pgAdmin for development:

1. Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

2. Update the environment variables in `.env`:

- `POSTGRES_PASSWORD`: Choose a secure password for PostgreSQL
- `OPENAI_API_KEY`: Your OpenAI API key
- `PGADMIN_EMAIL`: Email for pgAdmin login (default: admin@example.com)
- `PGADMIN_PASSWORD`: Password for pgAdmin login (default: admin)

3. Start the services:

```bash
docker compose up -d
```

4. Access pgAdmin:

- Open http://localhost:5050 in your browser
- Login with PGADMIN_EMAIL and PGADMIN_PASSWORD
- Add a new server in pgAdmin:
  - Name: docs-mcp
  - Host: postgres
  - Port: 5432
  - Database: docs_mcp
  - Username: mcp_user
  - Password: (use POSTGRES_PASSWORD from .env)

5. Access MCP server:

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
        "OPENAI_API_KEY": "sk-proj-...",
        "POSTGRES_CONNECTION": "postgresql://mcp_user:docs_mcp@localhost:5432/docs_mcp"
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
