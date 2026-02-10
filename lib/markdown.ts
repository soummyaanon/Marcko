const CENTERED_IMAGE_BLOCK_REGEX =
  /<p\b[^>]*\balign\s*=\s*(?:"center"|'center'|center)[^>]*>\s*<img\s+([^>]*?)\/?>\s*<\/p>/gi

const getAttr = (attrs: string, attrName: string): string => {
  const attrRegex = new RegExp(
    attrName + "\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s\"'=<>`]+))",
    "i",
  )
  const match = attrs.match(attrRegex)
  return (match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim()
}

const toMarkdownImage = (attrs: string): string | null => {
  const src = getAttr(attrs, "src")
  if (!src) return null

  const alt = getAttr(attrs, "alt").replace(/\r?\n/g, " ")
  return `![${alt}](<${src}>)`
}

export const normalizeMarkdownImageHtml = (content: string): string => {
  return content.replace(CENTERED_IMAGE_BLOCK_REGEX, (match, attrs: string) => {
    const markdownImage = toMarkdownImage(attrs)
    return markdownImage ?? match
  })
}
