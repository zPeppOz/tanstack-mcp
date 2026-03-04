# tanstack-mcp

MCP server that wraps the [TanStack CLI](https://tanstack.com/cli) to provide programmatic access to TanStack documentation, libraries, add-ons, ecosystem partners, and project scaffolding.

Built as a drop-in replacement after TanStack [removed the built-in MCP server](https://tanstack.com/cli/latest/docs/mcp-migration.md) from `@tanstack/cli`.

## Tools

| Tool | Description |
|---|---|
| `listTanStackAddOns` | List all available TanStack Start add-ons for a given framework |
| `getAddOnDetails` | Get detailed info about a specific add-on (files, deps, options, routes) |
| `createTanStackApplication` | Scaffold a new TanStack Start app with add-ons and options |
| `tanstack_list_libraries` | List all TanStack libraries with descriptions and links |
| `tanstack_doc` | Fetch the full content of a TanStack documentation page |
| `tanstack_search_docs` | Search across TanStack documentation |
| `tanstack_ecosystem` | List TanStack ecosystem partners with optional filters |

## Prerequisites

- Node.js ≥ 18
- `npx` available in PATH (ships with npm)

## Usage

### Claude Desktop / Claude Code

Add to your MCP config (`~/.claude/claude_desktop_config.json` or project `.mcp.json`):

```json
{
  "mcpServers": {
    "tanstack": {
      "command": "npx",
      "args": ["-y", "tanstack-mcp"]
    }
  }
}
```

### From source (this repo)

```json
{
  "mcpServers": {
    "tanstack": {
      "command": "node",
      "args": ["/absolute/path/to/tanstack-mcp/dist/index.js"]
    }
  }
}
```

### Cursor / Windsurf / other MCP clients

Same config shape — adjust based on your client's MCP configuration format.

## Development

```bash
npm install
npm run build   # compile TypeScript → dist/
npm start       # run the server (stdio)
npm run dev     # watch mode
```

## How it works

Each MCP tool maps to a `@tanstack/cli` command with `--json` output:

```
listTanStackAddOns       → tanstack create --list-add-ons --framework <f> --json
getAddOnDetails          → tanstack create --addon-details <id> --framework <f> --json
createTanStackApplication → tanstack create <name> --framework <f> --add-ons <a,b> ...
tanstack_list_libraries  → tanstack libraries --json
tanstack_doc             → tanstack doc <library> <path> --json
tanstack_search_docs     → tanstack search-docs "<query>" --json
tanstack_ecosystem       → tanstack ecosystem --json
```

The server spawns `npx @tanstack/cli` for each invocation, parses the JSON output, and returns it through the MCP protocol over stdio.

## License

MIT
