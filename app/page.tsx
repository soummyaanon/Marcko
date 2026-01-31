"use client"

import { useState, useEffect, useCallback } from "react"
import { MarkdownEditor } from "@/components/markdown-editor"
import { MarkdownPreview } from "@/components/markdown-preview"
import { EditorToolbar } from "@/components/editor-toolbar"
import { createClient } from "@/lib/supabase/client"
import { nanoid } from "nanoid"
import { Github, Star } from "lucide-react"

const DEFAULT_MARKDOWN = `# Welcome to Marcko

A professional markdown editor with **real-time preview** and sharing capabilities.

## Features

- **Side-by-side editing**: Write markdown and see the preview instantly
- **Full markdown support**: Headers, lists, code blocks, and more
- **Share your work**: Generate a unique URL to share with others
- **Copy content**: Easily copy rendered content or share links

## Code Examples

Inline code: \`const greeting = "Hello, World!"\`

Code block with syntax highlighting:

\`\`\`javascript
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

console.log(fibonacci(10)); // 55
\`\`\`

## Lists

### Unordered List
- First item
- Second item
  - Nested item
  - Another nested item
- Third item

### Ordered List
1. First step
2. Second step
3. Third step

## Blockquotes

> "The best way to predict the future is to invent it."
> — Alan Kay

## Tables

| Feature | Status |
|---------|--------|
| Editor | Complete |
| Preview | Complete |
| Sharing | Complete |

## Links and Images

Visit [GitHub](https://github.com) for more resources.

---

Start editing to see the magic happen!
`

export default function Home() {
  const [markdown, setMarkdown] = useState(DEFAULT_MARKDOWN)
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system")
  const supabase = createClient()

  useEffect(() => {
    const savedContent = localStorage.getItem("marcko-content")
    if (savedContent) {
      setMarkdown(savedContent)
    }
  }, [])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      localStorage.setItem("marcko-content", markdown)
    }, 500)
    return () => clearTimeout(timeoutId)
  }, [markdown])

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

  const handleShare = useCallback(async (): Promise<string> => {
    const id = nanoid(10)
    
    const { error } = await supabase
      .from("documents")
      .insert({
        id,
        content: markdown,
      })

    if (error) {
      throw new Error("Failed to save document")
    }

    const shareUrl = `${window.location.origin}/share/${id}`
    return shareUrl
  }, [markdown, supabase])

  return (
    <div className="fixed inset-0 flex flex-col bg-background overflow-hidden">
      <EditorToolbar 
        onShare={handleShare} 
        theme={theme} 
        onThemeChange={setTheme} 
      />
      
      <main className="flex flex-1 flex-col overflow-hidden md:flex-row">
        <div className="flex h-1/2 flex-col border-b border-border md:h-full md:w-1/2 md:border-b-0 md:border-r">
          <MarkdownEditor value={markdown} onChange={setMarkdown} />
        </div>
        
        <div className="flex h-1/2 flex-col md:h-full md:w-1/2">
          <MarkdownPreview content={markdown} />
        </div>
      </main>

      <footer className="border-t border-border bg-muted/30 px-4 py-2 md:px-6"> 
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 sm:flex-row">
          <div className="flex flex-col items-center gap-1 sm:items-start">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Created by</span>
              <a
                href="https://github.com/soummyaanon"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 font-medium text-foreground hover:underline"
              >
                <Github className="h-3 w-3" />
                soummyaanon
              </a>
            </div>
          </div>

          <a
            href="https://github.com/soummyaanon/Marcko"
            target="_blank"
            rel="noreferrer"
            className="group flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium transition-colors hover:bg-muted"
          >
            <Github className="h-3.5 w-3.5" />
            <span>Star on GitHub</span>
            <span className="flex items-center gap-1 border-l border-border pl-2 text-muted-foreground group-hover:text-foreground">
              <Star className="h-3 w-3" />
            </span>
          </a>
        </div>
      </footer>
    </div>
  )
}
