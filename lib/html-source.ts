export const looksLikeHtmlDocument = (content: string): boolean => {
  const trimmed = content.trimStart()
  if (!trimmed.startsWith("<")) return false
  const lower = trimmed.toLowerCase()
  return (
    lower.startsWith("<!doctype") ||
    lower.startsWith("<html") ||
    /<\s*(html|head|body|style|script|link|meta)[\s>]/i.test(trimmed)
  )
}

export const wrapAsHtmlDocument = (content: string): string => {
  const trimmed = content.trimStart().toLowerCase()
  if (trimmed.startsWith("<!doctype") || trimmed.startsWith("<html")) {
    return content
  }

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  html, body { margin: 0; padding: 0; }
  body {
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    color: #111;
    background: #fff;
    padding: 16px;
    box-sizing: border-box;
  }
  *, *::before, *::after { box-sizing: border-box; }
  @media (prefers-color-scheme: dark) {
    body { background: #0b0b0b; color: #f5f5f5; }
  }
</style>
</head>
<body>
${content}
</body>
</html>`
}
