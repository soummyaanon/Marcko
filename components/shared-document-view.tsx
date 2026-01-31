"use client"

import { useState, useEffect, useRef } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import remarkBreaks from "remark-breaks"
import rehypeKatex from "rehype-katex"
import rehypeHighlight from "rehype-highlight"
import "katex/dist/katex.min.css"
import { Check, Copy, FileText, Moon, Sun, Monitor, Link, Pencil, Github, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface SharedDocumentViewProps {
  content: string
  documentId: string
}

export function SharedDocumentView({ content, documentId }: SharedDocumentViewProps) {
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system")
  const [copiedContent, setCopiedContent] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)



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
    if (contentRef.current) {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([contentRef.current.innerHTML], { type: "text/html" }),
            "text/plain": new Blob([contentRef.current.innerText], { type: "text/plain" }),
          }),
        ])
        setCopiedContent(true)
        setTimeout(() => setCopiedContent(false), 2000)
      } catch {
        await navigator.clipboard.writeText(contentRef.current.innerText)
        setCopiedContent(true)
        setTimeout(() => setCopiedContent(false), 2000)
      }
    }
  }

  const copyLink = async () => {
    const url = `${window.location.origin}/share/${documentId}`
    await navigator.clipboard.writeText(url)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:px-6">
        <div className="flex items-center gap-3">
          <a href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <FileText className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Marcko</h1>
              <p className="hidden text-xs text-muted-foreground sm:block">Shared Document</p>
            </div>
          </a>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                {theme === "light" && <Sun className="h-4 w-4" />}
                {theme === "dark" && <Moon className="h-4 w-4" />}
                {theme === "system" && <Monitor className="h-4 w-4" />}
                <span className="sr-only">Toggle theme</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTheme("light")}>
                <Sun className="mr-2 h-4 w-4" />
                Light
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("dark")}>
                <Moon className="mr-2 h-4 w-4" />
                Dark
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("system")}>
                <Monitor className="mr-2 h-4 w-4" />
                System
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="sm"
            onClick={copyLink}
            className="gap-1.5"
          >
            {copiedLink ? (
              <>
                <Check className="h-4 w-4" />
                <span className="hidden sm:inline">Copied</span>
              </>
            ) : (
              <>
                <Link className="h-4 w-4" />
                <span className="hidden sm:inline">Copy Link</span>
              </>
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={copyContent}
            className="gap-1.5"
          >
            {copiedContent ? (
              <>
                <Check className="h-4 w-4" />
                <span className="hidden sm:inline">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                <span className="hidden sm:inline">Copy</span>
              </>
            )}
          </Button>

          <Button asChild size="sm" className="gap-1.5">
            <a href="/">
              <Pencil className="h-4 w-4" />
              <span className="hidden sm:inline">New Document</span>
            </a>
          </Button>
        </div>
      </header>

      <main className="flex-1 px-4 py-8 md:px-6">
        <article className="mx-auto max-w-3xl">
          <div
            ref={contentRef}
            className="markdown-content"
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]}
              rehypePlugins={[rehypeKatex, rehypeHighlight]}
            >
              {content}
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
    </div>
  )
}
