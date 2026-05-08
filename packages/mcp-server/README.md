# marcko-mcp

Publish drafts straight from any MCP-compatible AI client — **Claude, Cursor, Windsurf, ChatGPT, and more** — into your **Marcko** library. No copy-paste.

## Install

First, generate `MARCKO_API_KEY` from your Marcko account → **Connect AI agents**.

### Claude Code (CLI) — one-liner

```bash
claude mcp add marcko --scope user --env MARCKO_API_KEY=mk_PASTE_YOUR_KEY -- npx -y marcko-mcp@latest
```

Marcko will be available the next time you open a Claude Code session.

### Universal MCP config (Claude Desktop, Cursor, Windsurf, Cline, Continue, Zed, ChatGPT, …)

Drop the same JSON block into your client's MCP config file and restart it:

```json
{
  "mcpServers": {
    "marcko": {
      "command": "npx",
      "args": ["-y", "marcko-mcp@latest"],
      "env": {
        "MARCKO_API_KEY": "mk_..."
      }
    }
  }
}
```

| Client | Config file |
|---|---|
| Claude Desktop (macOS) | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Claude Desktop (Windows) | `%AppData%\Claude\claude_desktop_config.json` |
| Cursor | `~/.cursor/mcp.json` |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` |
| Cline / Continue / Zed | See each client's MCP settings UI |
| ChatGPT (GPT‑5 / Codex / Operator) | Add via the connector UI with the same `command` / `args` / `env` fields |

## Tool

### `publish_to_marcko`

Publish a markdown (or HTML/CSS/JS-in-fence) document to the signed-in user's Marcko library.
Returns the share URL.

**Input**

| Field | Type | Required | Default |
|---|---|---|---|
| `content` | string | yes | — |
| `title` | string | no | — |
| `visibility` | `"public"` \| `"private"` | no | `"public"` |

## Environment

| Var | Default |
|---|---|
| `MARCKO_API_KEY` | — (required) |
| `MARCKO_BASE_URL` | `https://marcko.bixai.dev` |

## Develop

```bash
pnpm install
pnpm --filter marcko-mcp build
node dist/index.js
```
