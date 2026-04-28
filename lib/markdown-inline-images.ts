export const MARCKO_INLINE_IMAGE_URL_RE =
  /^marcko-inline:([a-zA-Z0-9_-]{8,})$/

/** Global-ish registry so preview URL transform can resolve pasted image tokens. */
const globalKey = '__marckoInlineImageUrls' as const

export type InlineImageRegistry = Record<string, string>

function getRegistry (): InlineImageRegistry {
  if (typeof globalThis === 'undefined') return {}
  const g = globalThis as unknown as { [globalKey]?: InlineImageRegistry }
  if (!g[globalKey]) g[globalKey] = {}
  return g[globalKey]!
}

export function registerMarckoInlineImage (id: string, dataUrl: string): void {
  const reg = getRegistry()
  reg[id] = dataUrl
}

export function getMarckoInlineImageUrl (id: string): string | undefined {
  return getRegistry()[id]
}

/** Expands ![](marcko-inline:id) (and angled form) using the in-memory image registry → full data URLs. */
const MARCKO_INLINE_MD_RE =
  /!\[([^\]]*)]\(\s*<?(marcko-inline:([a-zA-Z0-9_-]{8,}))>?\s*\)/gi

export function expandMarckoInlineImagesInMarkdown (markdown: string): string {
  return markdown.replace(
    MARCKO_INLINE_MD_RE,
    (match, alt: string, _full: string, id: string) => {
      const dataUrl = getMarckoInlineImageUrl(id)
      if (!dataUrl) return match
      const safeAlt = alt.replace(/\r?\n/g, ' ')
      return `![${safeAlt}](<${dataUrl}>)`
    },
  )
}

/**
 * Compress long pasted image lines in the editor textarea (canonical markdown still holds full URLs).
 */
export function shortenDataImageMarkdownUrls (markdown: string): string {
  return markdown.replace(
    /!\[([^\]]*)\]\(<(data:image\/[^>]+)>\)|!\[([^\]]*)\]\((data:image\/[^)]+)\)/g,
    (
      match,
      altAngle: string | undefined,
      urlAngle: string | undefined,
      altPlain: string | undefined,
      urlPlain: string | undefined,
    ) => {
      const alt = (altAngle ?? altPlain ?? '').trim()
      const url = urlAngle ?? urlPlain
      if (!url || url.length <= 140) return match
      const label = alt || 'image'
      return `![${label}](<(short:${url.slice(0, 96)}…)>)`
    },
  )
}
