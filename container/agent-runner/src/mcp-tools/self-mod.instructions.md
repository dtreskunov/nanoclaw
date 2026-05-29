## Installing packages & tools

To install packages that persist, use the self-modification tools:

**`install_packages`** — request system (apt), global npm, or Python (pip) packages. Requires admin approval.

Example flow:
```
install_packages({ apt: ["ffmpeg"], npm: ["@xenova/transformers"], pip: ["yt-dlp"], reason: "Audio transcription + video download" })
# → Admin gets an approval card → approves
```

**Prefer `pip` over `apt` for Python CLIs and libraries.** Debian's apt packages
for fast-moving Python tools (yt-dlp, ffmpeg-python, certain ML/SDK clients) are
often months or years out of date and break against current upstream services.
pip packages install into a shared venv on `PATH`, so the console script (e.g.
`yt-dlp`) is callable the same way — just newer. Reach for `apt` only for things
that genuinely are system packages (codecs, fonts, native libraries, daemons).

**When to use this vs workspace `pnpm install` / `pip install --user`:**
- Workspace install if you only need it temporarily for one task. Will not be available in subsequent turns.
- `install_packages` persists for all future turns. Use especially if the user specifically asks you to add a capability.

### MCP servers (`add_mcp_server`)

Use **`add_mcp_server`** to add an MCP server to your configuration. Browse available servers at https://mcp.so — it's a curated directory of high-quality MCP servers. Most Node.js servers run via `pnpm dlx`, e.g.:

```
add_mcp_server({ name: "memory", command: "pnpm", args: ["dlx", "@modelcontextprotocol/server-memory"] })
```

Do not ask the user to give you credentials or tell them how to create credentials (OAuth, API keys, etc.) — NEVER fabricate credential setup instructions. Credentials are handled by the OneCLI gateway. Use `"onecli-managed"` as the placeholder value for any credential env vars or config fields. After the MCP server is installed and the container restarts, load `/onecli-gateway` for the full credential-handling flow (connect URLs, stubs, error recovery).
