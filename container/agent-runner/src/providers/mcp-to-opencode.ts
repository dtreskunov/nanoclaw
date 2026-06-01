import type { McpHttpServerConfig, McpServerConfig, McpStdioServerConfig } from './types.js';

/** OpenCode `mcp` entry shape (local stdio server). */
export type OpenCodeMcpLocal = {
  type: 'local';
  command: string[];
  environment?: Record<string, string>;
  enabled: true;
};

/** OpenCode `mcp` entry shape (remote HTTP server). */
export type OpenCodeMcpRemote = {
  type: 'remote';
  url: string;
  headers?: Record<string, string>;
  enabled: true;
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
    };
  }
  return out;
}
