import type { McpHttpServerConfig, McpServerConfig, McpStdioServerConfig } from './types.js';

/**
 * Default per-tool-call timeout for MCP servers. OpenCode's built-in default
 * is 5_000 ms (DEFAULT_TIMEOUT in its mcp/index.ts), which trips on any
 * non-trivial remote tool — Tavily search/extract/crawl, GitHub search,
 * Context7 lookup, etc. routinely take 10–60s. We pass the timeout through
 * to OpenCode's `mcp[name].timeout`, which it applies to both `tools/list`
 * and `tools/call`. OpenCode also passes `resetTimeoutOnProgress: true`, so
 * servers that emit progress notifications can run longer than this cap.
 *
 * Operator override: set MCP_TOOL_TIMEOUT in the host env (same var Claude
 * Code reads) to raise or lower the cap without editing source. Shared with
 * the claude provider so a single knob controls both.
 */
const DEFAULT_MCP_TIMEOUT_MS = Number(process.env.MCP_TOOL_TIMEOUT) || 120_000;

/** OpenCode `mcp` entry shape (local stdio server). */
export type OpenCodeMcpLocal = {
  type: 'local';
  command: string[];
  environment?: Record<string, string>;
  enabled: true;
  timeout: number;
};

/** OpenCode `mcp` entry shape (remote HTTP server). */
export type OpenCodeMcpRemote = {
  type: 'remote';
  url: string;
  headers?: Record<string, string>;
  enabled: true;
  timeout: number;
};

export type OpenCodeMcpEntry = OpenCodeMcpLocal | OpenCodeMcpRemote;

function isRemote(cfg: McpServerConfig): cfg is McpHttpServerConfig {
  return cfg.type === 'http' || cfg.type === 'sse';
}

/**
 * Map NanoClaw v2 MCP definitions (same shape as Claude Agent SDK) into
 * OpenCode config `mcp` field. Supports stdio (local) and http/sse (remote).
 */
export function mcpServersToOpenCodeConfig(
  servers: Record<string, McpServerConfig> | undefined,
): Record<string, OpenCodeMcpEntry> {
  const out: Record<string, OpenCodeMcpEntry> = {};
  if (!servers) return out;
  for (const [name, cfg] of Object.entries(servers) as Array<[string, McpServerConfig]>) {
    if (isRemote(cfg)) {
      out[name] = {
        type: 'remote',
        url: cfg.url,
        ...(cfg.headers && Object.keys(cfg.headers).length > 0 ? { headers: cfg.headers } : {}),
        enabled: true,
        timeout: DEFAULT_MCP_TIMEOUT_MS,
      };
      continue;
    }
    const stdio: McpStdioServerConfig = cfg;
    const env = stdio.env;
    out[name] = {
      type: 'local',
      command: [stdio.command, ...(stdio.args ?? [])],
      ...(env && Object.keys(env).length > 0 ? { environment: env } : {}),
      enabled: true,
      timeout: DEFAULT_MCP_TIMEOUT_MS,
    };
  }
  return out;
}
