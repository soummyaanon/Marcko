# marcko-mcp

Publish drafts straight from **Claude Desktop** into your **Marcko** library — no copy-paste.

## Install

In Claude Desktop's MCP config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

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

Generate `MARCKO_API_KEY` from your Marcko account → **Connect Claude Desktop**. Restart Claude Desktop.

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
