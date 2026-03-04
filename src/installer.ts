#!/usr/bin/env node

/**
 * Auto-installs the TanStack MCP server into detected AI coding clients.
 *
 * Usage:
 *   npx @g7aro/tanstack-mcp --install          # interactive — shows detected clients
 *   npx @g7aro/tanstack-mcp --install --all     # install into all detected clients
 *   npx @g7aro/tanstack-mcp --install claude     # install into specific client(s)
 *   npx @g7aro/tanstack-mcp --uninstall          # remove from all clients
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { homedir, platform } from "node:os";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClientDef {
  id: string;
  name: string;
  /** Returns the config file path, or null if not applicable */
  configPath: () => string | null;
  /** How to detect the client is installed */
  detect: () => boolean;
  /** Write the MCP entry — returns human-readable summary */
  install: () => string;
  /** Remove the MCP entry — returns human-readable summary */
  uninstall: () => string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HOME = homedir();
const IS_WIN = platform() === "win32";
const IS_MAC = platform() === "darwin";

const SERVER_ENTRY = {
  command: "npx",
  args: ["-y", "@g7aro/tanstack-mcp"],
};

function expandPath(...segments: string[]): string {
  return join(HOME, ...segments);
}

function dirExists(p: string): boolean {
  try {
    return existsSync(p);
  } catch {
    return false;
  }
}

function commandExists(cmd: string): boolean {
  try {
    execFileSync(IS_WIN ? "where" : "which", [cmd], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function readJson(path: string): Record<string, unknown> {
  try {
    // Strip BOM + comments (JSONC support)
    const raw = readFileSync(path, "utf-8")
      .replace(/^\uFEFF/, "")
      .replace(/\/\/.*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

// ---------------------------------------------------------------------------
// Generic JSON-based installer (mcpServers key)
// ---------------------------------------------------------------------------

function jsonInstaller(
  configPath: string,
  serverKey: string,
  entryKey: string,
): { install: () => string; uninstall: () => string } {
  return {
    install() {
      const data = readJson(configPath);
      const servers =
        (data[serverKey] as Record<string, unknown>) ?? {};
      servers[entryKey] = { ...SERVER_ENTRY };
      data[serverKey] = servers;
      writeJson(configPath, data);
      return `  → wrote ${configPath}`;
    },
    uninstall() {
      if (!existsSync(configPath)) return `  → ${configPath} not found, skip`;
      const data = readJson(configPath);
      const servers =
        (data[serverKey] as Record<string, unknown>) ?? {};
      if (!(entryKey in servers)) return `  → not configured, skip`;
      delete servers[entryKey];
      data[serverKey] = servers;
      writeJson(configPath, data);
      return `  → removed from ${configPath}`;
    },
  };
}

// ---------------------------------------------------------------------------
// Client definitions
// ---------------------------------------------------------------------------

function defineClients(): ClientDef[] {
  const clients: ClientDef[] = [];

  // ── Claude Code (uses CLI) ──────────────────────────────────────────
  clients.push({
    id: "claude-code",
    name: "Claude Code",
    configPath: () => null, // managed via CLI
    detect: () => commandExists("claude"),
    install() {
      try {
        execFileSync(
          "claude",
          [
            "mcp",
            "add",
            "--scope",
            "user",
            "tanstack",
            "--",
            "npx",
            "-y",
            "@g7aro/tanstack-mcp",
          ],
          { stdio: "pipe" },
        );
        return "  → registered via `claude mcp add --scope user`";
      } catch (e) {
        return `  → FAILED: ${(e as Error).message}`;
      }
    },
    uninstall() {
      try {
        execFileSync("claude", ["mcp", "remove", "--scope", "user", "tanstack"], {
          stdio: "pipe",
        });
        return "  → removed via `claude mcp remove --scope user`";
      } catch {
        return "  → not configured or already removed";
      }
    },
  });

  // ── Codex (OpenAI CLI — uses CLI) ───────────────────────────────────
  clients.push({
    id: "codex",
    name: "Codex (OpenAI)",
    configPath: () => null,
    detect: () => commandExists("codex"),
    install() {
      try {
        execFileSync(
          "codex",
          ["mcp", "add", "tanstack", "--", "npx", "-y", "@g7aro/tanstack-mcp"],
          { stdio: "pipe" },
        );
        return "  → registered via `codex mcp add`";
      } catch (e) {
        return `  → FAILED: ${(e as Error).message}`;
      }
    },
    uninstall() {
      try {
        execFileSync("codex", ["mcp", "remove", "tanstack"], {
          stdio: "pipe",
        });
        return "  → removed via `codex mcp remove`";
      } catch {
        return "  → not configured or already removed";
      }
    },
  });

  // ── Cursor ──────────────────────────────────────────────────────────
  {
    const configPath = expandPath(".cursor", "mcp.json");
    const { install, uninstall } = jsonInstaller(configPath, "mcpServers", "tanstack");
    clients.push({
      id: "cursor",
      name: "Cursor",
      configPath: () => configPath,
      detect: () => dirExists(expandPath(".cursor")),
      install,
      uninstall,
    });
  }

  // ── Windsurf ────────────────────────────────────────────────────────
  {
    const configPath = expandPath(".windsurf", "mcp.json");
    const { install, uninstall } = jsonInstaller(configPath, "mcpServers", "tanstack");
    clients.push({
      id: "windsurf",
      name: "Windsurf",
      configPath: () => configPath,
      detect: () => dirExists(expandPath(".windsurf")),
      install,
      uninstall,
    });
  }

  // ── Trae (ByteDance) ───────────────────────────────────────────────
  {
    const configPath = expandPath(".trae", "mcp.json");
    const { install, uninstall } = jsonInstaller(configPath, "mcpServers", "tanstack");
    clients.push({
      id: "trae",
      name: "Trae",
      configPath: () => configPath,
      detect: () => dirExists(expandPath(".trae")),
      install,
      uninstall,
    });
  }

  // ── Antigravity (Google) ────────────────────────────────────────────
  {
    const configPath = expandPath(".gemini", "antigravity", "mcp_config.json");
    const { install, uninstall } = jsonInstaller(configPath, "mcpServers", "tanstack");
    clients.push({
      id: "antigravity",
      name: "Antigravity",
      configPath: () => configPath,
      detect: () => dirExists(expandPath(".gemini", "antigravity")),
      install,
      uninstall,
    });
  }

  // ── OpenCode ────────────────────────────────────────────────────────
  {
    const configPath = expandPath(".config", "opencode", "opencode.json");
    clients.push({
      id: "opencode",
      name: "OpenCode",
      configPath: () => configPath,
      detect: () =>
        dirExists(expandPath(".config", "opencode")) ||
        commandExists("opencode"),
      install() {
        const data = readJson(configPath);
        const mcp = (data["mcp"] as Record<string, unknown>) ?? {};
        mcp["tanstack"] = {
          type: "local",
          command: ["npx", "-y", "@g7aro/tanstack-mcp"],
          enabled: true,
        };
        data["mcp"] = mcp;
        writeJson(configPath, data);
        return `  → wrote ${configPath}`;
      },
      uninstall() {
        if (!existsSync(configPath))
          return `  → ${configPath} not found, skip`;
        const data = readJson(configPath);
        const mcp = (data["mcp"] as Record<string, unknown>) ?? {};
        if (!("tanstack" in mcp)) return "  → not configured, skip";
        delete mcp["tanstack"];
        data["mcp"] = mcp;
        writeJson(configPath, data);
        return `  → removed from ${configPath}`;
      },
    });
  }

  // ── Zed ─────────────────────────────────────────────────────────────
  {
    const configPath = IS_WIN
      ? join(process.env["APPDATA"] ?? expandPath("AppData", "Roaming"), "Zed", "settings.json")
      : expandPath(".config", "zed", "settings.json");
    clients.push({
      id: "zed",
      name: "Zed",
      configPath: () => configPath,
      detect: () => existsSync(configPath) || commandExists("zed"),
      install() {
        const data = readJson(configPath);
        const servers =
          (data["context_servers"] as Record<string, unknown>) ?? {};
        servers["tanstack"] = {
          command: {
            path: "npx",
            args: ["-y", "@g7aro/tanstack-mcp"],
            env: null,
          },
          settings: {},
        };
        data["context_servers"] = servers;
        writeJson(configPath, data);
        return `  → wrote ${configPath}`;
      },
      uninstall() {
        if (!existsSync(configPath))
          return `  → ${configPath} not found, skip`;
        const data = readJson(configPath);
        const servers =
          (data["context_servers"] as Record<string, unknown>) ?? {};
        if (!("tanstack" in servers)) return "  → not configured, skip";
        delete servers["tanstack"];
        data["context_servers"] = servers;
        writeJson(configPath, data);
        return `  → removed from ${configPath}`;
      },
    });
  }

  // ── VS Code / Copilot ──────────────────────────────────────────────
  {
    const configPath = IS_MAC
      ? expandPath("Library", "Application Support", "Code", "User", "settings.json")
      : IS_WIN
        ? join(
            process.env["APPDATA"] ?? expandPath("AppData", "Roaming"),
            "Code",
            "User",
            "settings.json",
          )
        : expandPath(".config", "Code", "User", "settings.json");
    clients.push({
      id: "vscode",
      name: "VS Code (Copilot)",
      configPath: () => configPath,
      detect: () => existsSync(configPath) || commandExists("code"),
      install() {
        const data = readJson(configPath);
        const servers =
          (data["mcp"] as Record<string, unknown>) ?? {};
        const inputs = (servers["inputs"] ?? []) as unknown[];
        const existing =
          (servers["servers"] as Record<string, unknown>) ?? {};
        existing["tanstack"] = {
          type: "stdio",
          command: "npx",
          args: ["-y", "@g7aro/tanstack-mcp"],
        };
        servers["servers"] = existing;
        servers["inputs"] = inputs;
        data["mcp"] = servers;
        writeJson(configPath, data);
        return `  → wrote ${configPath}`;
      },
      uninstall() {
        if (!existsSync(configPath))
          return `  → ${configPath} not found, skip`;
        const data = readJson(configPath);
        const servers = (data["mcp"] as Record<string, unknown>) ?? {};
        const existing =
          (servers["servers"] as Record<string, unknown>) ?? {};
        if (!("tanstack" in existing)) return "  → not configured, skip";
        delete existing["tanstack"];
        servers["servers"] = existing;
        data["mcp"] = servers;
        writeJson(configPath, data);
        return `  → removed from ${configPath}`;
      },
    });
  }

  return clients;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function printUsage(): void {
  console.log(`
@g7aro/tanstack-mcp — MCP server installer

Usage:
  npx @g7aro/tanstack-mcp --install              Interactive — pick clients
  npx @g7aro/tanstack-mcp --install --all         Install into all detected
  npx @g7aro/tanstack-mcp --install claude codex   Install into specific clients
  npx @g7aro/tanstack-mcp --uninstall             Remove from all clients

Supported clients:
  claude-code  cursor  windsurf  trae  antigravity
  opencode  zed  codex  vscode
`);
}

async function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function runInstaller(args: string[]): Promise<void> {
  const isUninstall = args.includes("--uninstall");
  const isAll = args.includes("--all");
  const specificIds = args.filter((a) => !a.startsWith("--"));

  const allClients = defineClients();
  const detected = allClients.filter((c) => c.detect());

  if (detected.length === 0) {
    console.log("No supported AI coding clients detected on this machine.");
    console.log("Supported: " + allClients.map((c) => c.id).join(", "));
    return;
  }

  // ── Uninstall ────────────────────────────────────────────────────────
  if (isUninstall) {
    console.log("\nRemoving tanstack MCP server from all clients...\n");
    for (const client of allClients) {
      console.log(`${client.name}:`);
      console.log(client.uninstall());
    }
    console.log("\nDone.");
    return;
  }

  // ── Determine targets ────────────────────────────────────────────────
  let targets: ClientDef[];

  if (specificIds.length > 0) {
    targets = specificIds
      .map((id) => allClients.find((c) => c.id === id || c.id.startsWith(id)))
      .filter((c): c is ClientDef => c !== undefined);
    if (targets.length === 0) {
      console.error(
        `No matching clients for: ${specificIds.join(", ")}`,
      );
      printUsage();
      process.exit(1);
    }
  } else if (isAll) {
    targets = detected;
  } else {
    // Interactive selection
    console.log("\nDetected AI coding clients:\n");
    detected.forEach((c, i) => {
      console.log(`  ${i + 1}. ${c.name} (${c.id})`);
    });
    console.log(`  a. All of the above`);
    console.log();

    const answer = await prompt(
      "Install into which clients? (numbers separated by spaces, or 'a' for all): ",
    );

    if (answer.toLowerCase() === "a") {
      targets = detected;
    } else {
      const indices = answer
        .split(/[\s,]+/)
        .map(Number)
        .filter((n) => n >= 1 && n <= detected.length);
      targets = indices.map((i) => detected[i - 1]);
    }

    if (targets.length === 0) {
      console.log("No clients selected.");
      return;
    }
  }

  // ── Install ──────────────────────────────────────────────────────────
  console.log("\nInstalling tanstack MCP server...\n");
  for (const client of targets) {
    console.log(`${client.name}:`);
    console.log(client.install());
  }
  console.log("\nDone! Restart your clients for the changes to take effect.");
}
