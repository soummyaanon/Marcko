"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import remarkBreaks from "remark-breaks"
import rehypeKatex from "rehype-katex"
import rehypeHighlight from "rehype-highlight"
import rehypeRaw from "rehype-raw"
import "katex/dist/katex.min.css"
import { Github, Lock, Star } from "lucide-react"

import { FloatingReaderDock } from "@/components/floating-reader-dock"
import { markdownComponentsWithMermaid, markdownUrlTransform } from "@/components/markdown-components"
import { normalizeMarkdownImageHtml } from "@/lib/markdown"
import { expandMarckoInlineImagesInMarkdown } from "@/lib/markdown-inline-images"

type SharedBy = { type: "guest" } | { type: "user"; name: string }

interface SharedDocumentViewProps {
  content: string
  documentId?: string
  onBackToEditor?: () => void
  sharedBy?: SharedBy
  visibility?: "public" | "private"
  isOwner?: boolean
}

export function SharedDocumentView({
  content,
  documentId,
  onBackToEditor,
  sharedBy,
  visibility,
  isOwner = false,
}: SharedDocumentViewProps) {
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system")
  const [copiedContent, setCopiedContent] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [displayedContent, setDisplayedContent] = useState(content)
  const [versions, setVersions] = useState<{ version: number; createdAt: string }[]>([])
  const [activeVersion, setActiveVersion] = useState<number | null>(null)
  const [latestVersion, setLatestVersion] = useState<number | null>(null)
  const [isSwitchingVersion, setIsSwitchingVersion] = useState<number | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setDisplayedContent(content)
  }, [content])

  useEffect(() => {
    if (!documentId) {
      setVersions([])
      setActiveVersion(null)
      setLatestVersion(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const response = await fetch(
          `/api/share/versions?id=${encodeURIComponent(documentId)}`,
          { cache: "no-store" },
        )
        if (!response.ok || cancelled) return
        const data = (await response.json()) as {
          versions?: { version: number; createdAt: string }[]
          latest?: number | null
        }
        if (cancelled) return
        const list = Array.isArray(data.versions) ? data.versions : []
        setVersions(list)
        const latest =
          typeof data.latest === "number"
            ? data.latest
            : list.length > 0
              ? list[list.length - 1].version
              : null
        setLatestVersion(latest)
        setActiveVersion(latest)
      } catch (error) {
        if (!cancelled) console.error("Failed to load versions:", error)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [documentId])

  const handleSelectVersion = async (version: number) => {
    if (!documentId || version === activeVersion) return
    setIsSwitchingVersion(version)
    try {
      const response = await fetch(
        `/api/share/versions?id=${encodeURIComponent(documentId)}&version=${encodeURIComponent(String(version))}`,
        { cache: "no-store" },
      )
      if (!response.ok) throw new Error("Failed to load version")
      const data = (await response.json()) as { content?: string }
      if (typeof data.content === "string") {
        setDisplayedContent(data.content)
        setActiveVersion(version)
      }
    } catch (error) {
      console.error("Failed to load version:", error)
    } finally {
      setIsSwitchingVersion(null)
    }
  }

  const normalizedContent = useMemo(
    () =>
      expandMarckoInlineImagesInMarkdown(normalizeMarkdownImageHtml(displayedContent)),
    [displayedContent],
  )
  const hasShareLink = Boolean(documentId)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    
    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
      root.classList.toggle("dark", systemTheme)
    } else {
      root.classList.toggle("dark", theme === "dark")
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const handleChange = (e: MediaQueryListEvent) => {
      if (theme === "system") {
        root.classList.toggle("dark", e.matches)
      }
    }
    mediaQuery.addEventListener("change", handleChange)
    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [theme])



  const copyContent = async () => {
    try {
      await navigator.clipboard.writeText(displayedContent)
      setCopiedContent(true)
      setTimeout(() => setCopiedContent(false), 2000)
    } catch (err) {
      console.error("Failed to copy content", err)
    }
  }

  const openInApp = async (agent: "chatgpt" | "claude" | "perplexity") => {
    if (!documentId) return

    let shareUrl = `${window.location.origin}/share/${documentId}`

    // For private documents, generate a temporary access token so the AI can
    // bypass the authentication gate.
    if (visibility === "private") {
      try {
        const res = await fetch("/api/share/access-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId }),
        })
        if (res.ok) {
          const data = (await res.json()) as { token?: string }
          if (data.token) {
            shareUrl += `?token=${encodeURIComponent(data.token)}`
          }
        }
      } catch {
        // Fall back to plain URL – the AI won't be able to read it but at
        // least the link is still shared.
      }
    }

    await navigator.clipboard.writeText(shareUrl)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)

    let url = ""
    const encodedUrl = encodeURIComponent(`Here is a document I want to discuss: ${shareUrl}`)

    switch (agent) {
      case "chatgpt":
        url = `https://chatgpt.com/?q=${encodedUrl}`
        break
      case "claude":
        url = `https://claude.ai/new?q=${encodedUrl}`
        break
      case "perplexity":
        url = `https://www.perplexity.ai/search?q=${encodedUrl}`
        break
    }

    window.open(url, "_blank")
  }

  const copyLink = async () => {
    if (!documentId) return
    const url = `${window.location.origin}/share/${documentId}`
    await navigator.clipboard.writeText(url)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const dockPrimaryAction = onBackToEditor
    ? { kind: "back-to-editor" as const, onClick: onBackToEditor }
    : isOwner && documentId
      ? { kind: "edit-owned" as const, href: `/?edit=${encodeURIComponent(documentId)}` }
      : { kind: "new-document" as const, href: "/" }

  return (
    <div className="relative flex min-h-screen flex-col bg-background">

      <main className="flex-1 px-4 py-8 md:px-6">
        <article className="mx-auto max-w-3xl">
          {sharedBy ? (
            <p className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
              <span>Shared by {sharedBy.type === "guest" ? "guest" : sharedBy.name}</span>
              {visibility === "private" ? (
                <span className="inline-flex items-center gap-0.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                  <Lock className="h-2.5 w-2.5" />
                  Private
                </span>
              ) : null}
            </p>
          ) : null}
          <div
            ref={contentRef}
            className="markdown-content"
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]}
              rehypePlugins={[rehypeKatex, rehypeHighlight, rehypeRaw]}
              components={markdownComponentsWithMermaid}
              urlTransform={markdownUrlTransform}
            >
              {normalizedContent}
            </ReactMarkdown>
          </div>
        </article>
      </main>

      <footer className="border-t border-border bg-muted/30 px-4 py-6 md:px-6">
        <div className="mx-auto flex max-w-3xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex flex-col items-center gap-1 sm:items-start">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Created by</span>
              <a
                href="https://github.com/soummyaanon"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 font-medium text-foreground hover:underline"
              >
                <Github className="h-3.5 w-3.5" />
                soummyaanon
              </a>
            </div>
          </div>



          <a
            href="https://github.com/soummyaanon/Marcko"
            target="_blank"
            rel="noreferrer"
            className="group flex items-center gap-2 rounded-full border border-border bg-background px-4 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
          >
            <Github className="h-4 w-4" />
            <span>Star on GitHub</span>
            <span className="flex items-center gap-1 border-l border-border pl-2 text-muted-foreground group-hover:text-foreground">
              <Star className="h-3.5 w-3.5" />
            </span>
          </a>
        </div>
      </footer>

      {mounted ? (
        <FloatingReaderDock
          theme={theme}
          onThemeChange={setTheme}
          hasShareLink={hasShareLink}
          onCopyLink={copyLink}
          copiedLink={copiedLink}
          onCopyContent={copyContent}
          copiedContent={copiedContent}
          onOpenInApp={hasShareLink ? openInApp : undefined}
          versions={versions}
          activeVersion={activeVersion}
          latestVersion={latestVersion}
          isSwitchingVersion={isSwitchingVersion}
          onSelectVersion={(v) => void handleSelectVersion(v)}
          primaryAction={dockPrimaryAction}
        />
      ) : null}
    </div>
  )
}
