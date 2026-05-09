import { afterEach, describe, expect, it } from "vitest"

import { normalizeMarkdownImageHtml } from "@/lib/markdown"
import {
  expandMarckoInlineImagesInMarkdown,
  MARCKO_INLINE_IMAGE_URL_RE,
  registerMarckoInlineImage,
  shortenDataImageMarkdownUrls,
} from "@/lib/markdown-inline-images"

const clearRegistry = () => {
  ;(globalThis as Record<string, unknown>).__marckoInlineImageUrls = {}
}

afterEach(() => {
  clearRegistry()
})

describe("normalizeMarkdownImageHtml", () => {
  it('converts a centered <p><img></p> block into markdown image syntax', () => {
    const html = `<p align="center"><img src="https://x/y.png" alt="hi" /></p>`
    expect(normalizeMarkdownImageHtml(html)).toBe(`![hi](<https://x/y.png>)`)
  })

  it("strips newlines from alt text to prevent breaking out of the alt attribute", () => {
    const html = `<p align="center"><img src="https://x/y.png" alt="line\nbreak" /></p>`
    expect(normalizeMarkdownImageHtml(html)).toBe(`![line break](<https://x/y.png>)`)
  })

  it("leaves the original block intact when src is missing", () => {
    const html = `<p align="center"><img alt="orphan"></p>`
    expect(normalizeMarkdownImageHtml(html)).toBe(html)
  })

  it("does NOT touch arbitrary unrelated HTML", () => {
    const html = `<script>alert(1)</script><p>not centered <img></p>`
    expect(normalizeMarkdownImageHtml(html)).toBe(html)
  })

  it("does not run on non-center alignments", () => {
    const html = `<p align="left"><img src="x" /></p>`
    expect(normalizeMarkdownImageHtml(html)).toBe(html)
  })

  it("handles single-quoted and unquoted attribute values", () => {
    const single = `<p align='center'><img src='https://x/y.png' alt='hi' /></p>`
    const unquoted = `<p align=center><img src=https://x/y.png alt=hi /></p>`
    expect(normalizeMarkdownImageHtml(single)).toBe(`![hi](<https://x/y.png>)`)
    expect(normalizeMarkdownImageHtml(unquoted)).toBe(`![hi](<https://x/y.png>)`)
  })
})

describe("MARCKO_INLINE_IMAGE_URL_RE", () => {
  it("accepts ids of >= 8 url-safe chars", () => {
    expect(MARCKO_INLINE_IMAGE_URL_RE.test("marcko-inline:abcd1234")).toBe(true)
    expect(MARCKO_INLINE_IMAGE_URL_RE.test("marcko-inline:Z_-Z_-Z_-A")).toBe(true)
  })

  it("rejects short ids and disallowed characters", () => {
    expect(MARCKO_INLINE_IMAGE_URL_RE.test("marcko-inline:short")).toBe(false)
    expect(MARCKO_INLINE_IMAGE_URL_RE.test("marcko-inline:has space!!")).toBe(false)
    expect(MARCKO_INLINE_IMAGE_URL_RE.test("marcko-inline:abc/def123")).toBe(false)
    expect(MARCKO_INLINE_IMAGE_URL_RE.test("not-marcko:abcd1234")).toBe(false)
  })
})

describe("expandMarckoInlineImagesInMarkdown", () => {
  it("substitutes registered ids with their data URL", () => {
    const id = "abcdefgh1234"
    registerMarckoInlineImage(id, "data:image/png;base64,AAAA")
    const md = `before ![alt](marcko-inline:${id}) after`
    const out = expandMarckoInlineImagesInMarkdown(md)
    expect(out).toContain("![alt](<data:image/png;base64,AAAA>)")
  })

  it("leaves unregistered ids alone (no broken-image leak)", () => {
    const md = `![alt](marcko-inline:notregistered12)`
    expect(expandMarckoInlineImagesInMarkdown(md)).toBe(md)
  })

  it("strips newlines from alt text on expansion", () => {
    const id = "abcdefgh5678"
    registerMarckoInlineImage(id, "data:image/png;base64,BBBB")
    const md = `![multi\nline](marcko-inline:${id})`
    const out = expandMarckoInlineImagesInMarkdown(md)
    expect(out).toContain("![multi line](<data:image/png;base64,BBBB>)")
  })

  it("does not match marcko-inline ids with disallowed characters", () => {
    const md = `![](marcko-inline:has space!!)`
    expect(expandMarckoInlineImagesInMarkdown(md)).toBe(md)
  })
})

describe("shortenDataImageMarkdownUrls", () => {
  it("shortens long data URLs but keeps short ones", () => {
    const big = "data:image/png;base64," + "A".repeat(500)
    const md = `![alt](<${big}>)\n![other](data:image/png;base64,short)`
    const out = shortenDataImageMarkdownUrls(md)
    expect(out).toContain("(short:")
    expect(out).toContain("data:image/png;base64,short")
    expect(out).not.toContain("A".repeat(500))
  })

  it("preserves alt text when shortening", () => {
    const big = "data:image/png;base64," + "Z".repeat(500)
    const md = `![my image](<${big}>)`
    const out = shortenDataImageMarkdownUrls(md)
    expect(out.startsWith("![my image]")).toBe(true)
  })
})
