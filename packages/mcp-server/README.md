# marcko-mcp

Publish drafts straight from **Claude Desktop** into your **Marcko** library — no copy-paste.

## Install

Generate `MARCKO_API_KEY` from your Marcko account → **Connect Claude Desktop**.

### Claude Code (CLI) — one-liner

```bash
claude mcp add marcko --scope user --env MARCKO_API_KEY=mk_PASTE_YOUR_KEY -- npx -y marcko-mcp@latest
```

Marcko will be available the next time you open a Claude Code session.

### Claude Desktop (JSON config)

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or the Windows equivalent:

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

Restart Claude Desktop.

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
