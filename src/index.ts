#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const TANSTACK_CLI = "npx";
const TANSTACK_ARGS = ["--yes", "@tanstack/cli"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function runCli(
  args: string[],
  timeoutMs = 60_000,
): Promise<{ stdout: string; stderr: string }> {
  const { stdout, stderr } = await execFileAsync(
    TANSTACK_CLI,
    [...TANSTACK_ARGS, ...args],
    {
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024, // 10 MB
      env: { ...process.env, NO_COLOR: "1" },
    },
  );
  return { stdout: stdout.trim(), stderr: stderr.trim() };
}

function parseJsonOutput(stdout: string): unknown {
  // The CLI may print warnings before the JSON blob – find the first { or [
  const jsonStart = stdout.search(/[\[{]/);
  if (jsonStart === -1) {
    throw new Error(`CLI returned non-JSON output:\n${stdout}`);
  }
  return JSON.parse(stdout.slice(jsonStart));
}

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function jsonResult(data: unknown) {
  return textResult(JSON.stringify(data, null, 2));
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "tanstack-mcp",
  version: "1.0.0",
});

// 1. listTanStackAddOns
server.tool(
  "listTanStackAddOns",
  "List all available TanStack Start add-ons for a given framework",
  {
    framework: z
      .enum(["React", "Solid"])
      .default("React")
      .describe("Project framework"),
  },
  async ({ framework }) => {
    const { stdout } = await runCli([
      "create",
      "--list-add-ons",
      "--framework",
      framework,
      "--json",
    ]);
    return jsonResult(parseJsonOutput(stdout));
  },
);

// 2. getAddOnDetails
server.tool(
  "getAddOnDetails",
  "Get detailed information about a specific TanStack Start add-on (files, dependencies, options, routes)",
  {
    addonId: z
      .string()
      .describe(
        "Add-on identifier (e.g. drizzle, clerk, shadcn, prisma, sentry)",
      ),
    framework: z
      .enum(["React", "Solid"])
      .default("React")
      .describe("Project framework"),
  },
  async ({ addonId, framework }) => {
    const { stdout } = await runCli([
      "create",
      "--addon-details",
      addonId,
      "--framework",
      framework,
      "--json",
    ]);
    return jsonResult(parseJsonOutput(stdout));
  },
);

// 3. createTanStackApplication
server.tool(
  "createTanStackApplication",
  "Scaffold a new TanStack Start application with the specified add-ons and options",
  {
    projectName: z.string().describe("Name of the project directory to create"),
    framework: z
      .enum(["React", "Solid"])
      .default("React")
      .describe("Project framework"),
    addOns: z
      .array(z.string())
      .optional()
      .describe(
        "Comma-separated add-on ids to include (e.g. ['drizzle','clerk'])",
      ),
    packageManager: z
      .enum(["npm", "yarn", "pnpm", "bun", "deno"])
      .optional()
      .describe("Package manager to use"),
    deployment: z
      .enum(["cloudflare", "netlify", "nitro", "railway"])
      .optional()
      .describe("Deployment adapter"),
    toolchain: z
      .enum(["biome", "eslint"])
      .optional()
      .describe("Linter / formatter toolchain"),
    routerOnly: z
      .boolean()
      .optional()
      .describe(
        "Use router-only mode (file-based routing without TanStack Start)",
      ),
    examples: z
      .boolean()
      .optional()
      .describe("Include demo/example pages"),
    targetDir: z
      .string()
      .optional()
      .describe("Target directory for the project root"),
    addOnConfig: z
      .string()
      .optional()
      .describe("JSON string with add-on configuration options"),
  },
  async ({
    projectName,
    framework,
    addOns,
    packageManager,
    deployment,
    toolchain,
    routerOnly,
    examples,
    targetDir,
    addOnConfig,
  }) => {
    const args = ["create", projectName, "--framework", framework];

    if (addOns && addOns.length > 0) {
      args.push("--add-ons", addOns.join(","));
    }
    if (packageManager) args.push("--package-manager", packageManager);
    if (deployment) args.push("--deployment", deployment);
    if (toolchain) args.push("--toolchain", toolchain);
    if (routerOnly) args.push("--router-only");
    if (examples === true) args.push("--examples");
    if (examples === false) args.push("--no-examples");
    if (targetDir) args.push("--target-dir", targetDir);
    if (addOnConfig) args.push("--add-on-config", addOnConfig);

    // Always non-interactive, no git init (the agent controls git)
    args.push("--no-git");

    const { stdout, stderr } = await runCli(args, 120_000);
    return textResult(
      [stdout, stderr].filter(Boolean).join("\n---\n"),
    );
  },
);

// 4. tanstack_list_libraries
server.tool(
  "tanstack_list_libraries",
  "List all TanStack libraries with their descriptions, supported frameworks, and links",
  {
    group: z
      .enum(["state", "headlessUI", "performance", "tooling"])
      .optional()
      .describe("Filter by library group"),
  },
  async ({ group }) => {
    const args = ["libraries", "--json"];
    if (group) args.push("--group", group);

    const { stdout } = await runCli(args);
    return jsonResult(parseJsonOutput(stdout));
  },
);

// 5. tanstack_doc
server.tool(
  "tanstack_doc",
  "Fetch the full content of a specific TanStack documentation page",
  {
    library: z
      .string()
      .describe("Library ID (e.g. query, router, table, start, form, virtual)"),
    path: z
      .string()
      .describe(
        "Documentation path (e.g. framework/react/overview, guide/server-functions)",
      ),
    docsVersion: z
      .string()
      .optional()
      .describe("Docs version (default: latest)"),
  },
  async ({ library, path, docsVersion }) => {
    const args = ["doc", library, path, "--json"];
    if (docsVersion) args.push("--docs-version", docsVersion);

    const { stdout } = await runCli(args);
    return jsonResult(parseJsonOutput(stdout));
  },
);

// 6. tanstack_search_docs
server.tool(
  "tanstack_search_docs",
  "Search across TanStack documentation for a query string. Returns matching pages with titles, URLs, and breadcrumbs.",
  {
    query: z.string().describe("Search query (e.g. 'server functions', 'loaders', 'mutations')"),
    library: z
      .string()
      .optional()
      .describe("Filter to a specific library (e.g. start, router, query)"),
    framework: z
      .string()
      .optional()
      .describe("Filter to a specific framework (e.g. react, vue, solid)"),
    limit: z
      .number()
      .min(1)
      .max(50)
      .optional()
      .describe("Max results to return (default 10, max 50)"),
  },
  async ({ query, library, framework, limit }) => {
    const args = ["search-docs", query, "--json"];
    if (library) args.push("--library", library);
    if (framework) args.push("--framework", framework);
    if (limit) args.push("--limit", String(limit));

    const { stdout } = await runCli(args);
    return jsonResult(parseJsonOutput(stdout));
  },
);

// 7. tanstack_ecosystem
server.tool(
  "tanstack_ecosystem",
  "List TanStack ecosystem partners (auth, database, deployment, monitoring, etc.) with optional category/library filters",
  {
    category: z
      .string()
      .optional()
      .describe(
        "Filter by category (e.g. auth, database, deployment, monitoring, api, code-review)",
      ),
    library: z
      .string()
      .optional()
      .describe("Filter by TanStack library (e.g. start, query, table)"),
  },
  async ({ category, library }) => {
    const args = ["ecosystem", "--json"];
    if (category) args.push("--category", category);
    if (library) args.push("--library", library);

    const { stdout } = await runCli(args);
    return jsonResult(parseJsonOutput(stdout));
  },
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("tanstack-mcp server running on stdio");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
