"use client"

import React from "react"
import { nanoid } from "nanoid"

import { useRef, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { normalizeMarkdownImageHtml } from "@/lib/markdown"
import {
  getMarckoInlineImageUrl,
  registerMarckoInlineImage,
  shortenDataImageMarkdownUrls,
} from "@/lib/markdown-inline-images"
import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  List,
  ListOrdered,
  Quote,
  Code,
  Link as LinkIcon,
  Upload,
  Workflow,
  RotateCcw,
  RefreshCw,
  Globe
} from "lucide-react"

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  defaultContent?: string
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>
  onScroll?: React.UIEventHandler<HTMLDivElement>
}

export function MarkdownEditor({
  value,
  onChange,
  defaultContent,
  scrollContainerRef,
  onScroll,
}: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mermaidTemplate = "graph TD\n    A[Write Markdown] --> B[Live Preview]"
  const htmlTemplate = `<div class="card">
  <h2>Hello, Marcko!</h2>
  <button id="btn">Click me</button>
</div>
<style>
  .card { font-family: system-ui; padding: 16px; border-radius: 12px; background: #f5f5f5; }
  .card h2 { margin: 0 0 8px; }
  button { padding: 6px 12px; border-radius: 6px; border: 0; background: #111; color: #fff; cursor: pointer; }
</style>
<script>
  document.getElementById('btn').addEventListener('click', () => {
    document.querySelector('h2').textContent = 'Clicked!'
  });
</script>`
  const [isDraggingImage, setIsDraggingImage] = React.useState(false)

  const displayMarkdown = useMemo(
    () => shortenDataImageMarkdownUrls(value),
    [value],
  )

  /** Migrate pasted huge base64 image lines once into compact marcko-inline tokens (+ registry). */
  const migrateLegacyHugeDataUrls = useRef(false)
  useEffect(() => {
    if (migrateLegacyHugeDataUrls.current) return

    let migrated = value
    let changed = false

    const migrateNext = (): void => {
      const match = migrated.match(
        /!\[([^\]]*)\]\(\s*(?:<(data:image\/[^>]+)>|(data:image\/[^)]+))\s*\)/i,
      )
      if (!match) return
      const full = match[0]
      const alt = (match[1] ?? '').trim()
      const rawUrl = (match[2] ?? match[3] ?? '').trim()
      if (rawUrl.length < 220) return

      const id = nanoid(10)
      registerMarckoInlineImage(id, rawUrl)
      const token = alt ? `![${alt}](marcko-inline:${id})` : `![image](marcko-inline:${id})`
      migrated = migrated.replace(full, token)
      changed = true
      migrateNext()
    }

    migrateNext()
    if (!changed || migrated === value) return

    migrateLegacyHugeDataUrls.current = true
    onChange(migrated)
  }, [value, onChange])

  const displayToCanonicalMarkdown = (editedDisplay: string): string => {
    return editedDisplay.replace(
      /!\[([^\]]*)\]\(\s*marcko-inline:([a-zA-Z0-9_-]{8,})\s*\)/gi,
      (match, alt: string, id: string) => {
        const dataUrl = getMarckoInlineImageUrl(id)
        if (!dataUrl) return match
        const safeAlt = alt.replace(/\r?\n/g, " ")
        return `![${safeAlt}](<${dataUrl}>)`
      },
    )
  }

  // History state
  const [history, setHistory] = React.useState<string[]>([value])
  const [historyIndex, setHistoryIndex] = React.useState(0)

  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = "auto"
      textarea.style.height = `${textarea.scrollHeight}px`
    }
  }, [displayMarkdown])

  // Update history when value changes externally or via typing (debounced or managed)
  // Since this component is controlled, we mostly rely on our own internal triggers for "significant" history points,
  // but we can also check for major divergences. For simplicity in this controlled environment,
  // we'll rely on our specific change handlers to push history, rather than a global effect on 'value'.

  const addToHistory = (newValue: string) => {
    // If the value hasn't effectively changed, don't add
    if (newValue === history[historyIndex]) return

    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(newValue)
    setHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
  }

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevValue = history[historyIndex - 1]
      setHistoryIndex(historyIndex - 1)
      onChange(prevValue)
    }
  }

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextValue = history[historyIndex + 1]
      setHistoryIndex(historyIndex + 1)
      onChange(nextValue)
    }
  }

  // Wrapper for changes that should record history
  const updateValue = (newValue: string, recordHistory = true) => {
    onChange(newValue)
    if (recordHistory) {
      addToHistory(newValue)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Shortcuts
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey) {
      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault()
          handleFormat("**", "**", "bold text")
          return
        case 'i':
          e.preventDefault()
          handleFormat("*", "*", "italic text")
          return
        case 'k':
          e.preventDefault()
          handleFormat("[", "](url)", "link text")
          return
        case 'z':
          e.preventDefault()
          handleUndo()
          return
      }
    }

    if ((e.metaKey || e.ctrlKey) && e.shiftKey) {
      switch (e.key.toLowerCase()) {
        case 'z':
          e.preventDefault()
          handleRedo()
          return
        case 's':
          e.preventDefault()
          handleFormat("~~", "~~", "strikethrough text")
          return
        case 'c':
          e.preventDefault()
          handleFormat("`", "`", "code")
          return
        case 'm':
          e.preventDefault()
          handleFormat("```mermaid\n", "\n```", mermaidTemplate)
          return
      }
    }

    if (e.key === "Tab") {
      e.preventDefault()
      const start = e.currentTarget.selectionStart
      const end = e.currentTarget.selectionEnd
      const currentDisplay = e.currentTarget.value
      const newDisplay =
        currentDisplay.substring(0, start) + "  " + currentDisplay.substring(end)
      const canonical = displayToCanonicalMarkdown(newDisplay)
      updateValue(canonical, true)
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2
        }
      }, 0)
    }
  }

  const handleFormat = (
    prefix: string,
    suffix: string = "",
    placeholder: string = "text"
  ) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const current = textarea.value
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = current.substring(start, end)

    let newText = ""
    let newCursorPos = 0

    if (selectedText) {
      newText = current.substring(0, start) + prefix + selectedText + suffix + current.substring(end)
      newCursorPos = start + prefix.length + selectedText.length + suffix.length
    } else {
      newText = current.substring(0, start) + prefix + placeholder + suffix + current.substring(end)
      newCursorPos = start + prefix.length + placeholder.length
    }

    updateValue(displayToCanonicalMarkdown(newText), true)
    textarea.focus()

    // We need to wait for the value to update before setting selection
    setTimeout(() => {
      textarea.selectionStart = newCursorPos
      textarea.selectionEnd = newCursorPos
      // If it was a placeholder insertion (no selection), select the placeholder text so user can type over it
      if (!selectedText) {
        textarea.selectionStart = start + prefix.length
        textarea.selectionEnd = start + prefix.length + placeholder.length
      }
    }, 0)
  }

  // Handle regular typing with a simple debounce strategy for history could be complex.
  // For now, we'll let normal onChange flow, but we might miss "typing" history points if we don't hook into it.
  // A simple way effectively catch "pauses" is hard without a debounce hook. 
  // For this iteration, we will just pass onChange directly for typing, 
  // but capture history on space/enter/paste?
  // Let's stick to updating purely on specific actions for now, OR wrap onChange to save every X seconds?
  // User asked for "cmd+z" which usually implies typing history too.

  // Let's implementing a simple "save on pause" logic?
  // Or simpler: Save on every change but CAP the history size? No, too many state updates.
  // Let's save on ' ' (space) and Enter for now as a heuristic for "finished a word/line".

  // We need a ref to access the latest params in the timeout
  const latestValueRef = useRef(value)
  useEffect(() => { latestValueRef.current = value }, [value])
  const latestHistoryIndexRef = useRef(historyIndex)
  useEffect(() => { latestHistoryIndexRef.current = historyIndex }, [historyIndex])
  const latestHistoryRef = useRef(history)
  useEffect(() => { latestHistoryRef.current = history }, [history])

  const debounceTimer = useRef<NodeJS.Timeout>(null)

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newDisplay = e.target.value
    const canonical = displayToCanonicalMarkdown(newDisplay)
    onChange(canonical)

    if (debounceTimer.current) clearTimeout(debounceTimer.current)

    debounceTimer.current = setTimeout(() => {
      // Save to history after 1s of inactivity
      const currentIndex = latestHistoryIndexRef.current
      const currentHistory = latestHistoryRef.current
      const headCanonical = currentHistory[currentIndex] ?? ""
      // Only add if different from current head
      if (canonical !== headCanonical) {
        setHistory(prev => {
          const newH = prev.slice(0, currentIndex + 1)
          newH.push(canonical)
          return newH
        })
        setHistoryIndex(prev => prev + 1)
      }
    }, 1000)
  }

  const handleFileUploadClick = () => {
    fileInputRef.current?.click()
  }

  const getImageAltText = (file: File, index: number) => {
    const name = file.name.replace(/\.[^/.]+$/, "").trim()
    return name || `pasted image ${index + 1}`
  }

  const readImageAsMarkdown = (file: File, index: number) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = () => {
        if (typeof reader.result !== "string") {
          reject(new Error("Failed to read image file"))
          return
        }

        const id = nanoid(10)
        registerMarckoInlineImage(id, reader.result)

        resolve(
          `![${getImageAltText(file, index)}](marcko-inline:${id})`,
        )
      }

      reader.onerror = () => reject(reader.error ?? new Error("Failed to read image file"))
      reader.readAsDataURL(file)
    })
  }

  const insertMarkdownAtCursor = (markdownSnippet: string) => {
    const textarea = textareaRef.current
    const current = textarea?.value ?? displayMarkdown
    const start = textarea?.selectionStart ?? current.length
    const end = textarea?.selectionEnd ?? current.length
    const before = current.substring(0, start)
    const after = current.substring(end)
    const prefix = before && !before.endsWith("\n") ? "\n\n" : ""
    const suffix = after && !after.startsWith("\n") ? "\n\n" : ""
    const nextValue = before + prefix + markdownSnippet + suffix + after
    const nextCursorPosition = start + prefix.length + markdownSnippet.length

    updateValue(displayToCanonicalMarkdown(nextValue), true)

    setTimeout(() => {
      if (!textareaRef.current) return
      textareaRef.current.focus()
      textareaRef.current.selectionStart = nextCursorPosition
      textareaRef.current.selectionEnd = nextCursorPosition
    }, 0)
  }

  const insertImageFiles = async (files: File[]) => {
    const imageFiles = files.filter((file) => file.type.startsWith("image/"))
    if (imageFiles.length === 0) return false

    try {
      const imageMarkdown = await Promise.all(imageFiles.map(readImageAsMarkdown))
      insertMarkdownAtCursor(imageMarkdown.join("\n\n"))
      return true
    } catch (error) {
      console.error("Failed to insert image", error)
      return false
    }
  }

  const getClipboardImageFiles = (dataTransfer: DataTransfer | null) => {
    if (!dataTransfer) return []

    const itemFiles = Array.from(dataTransfer.items ?? [])
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file))

    if (itemFiles.length > 0) {
      return itemFiles
    }

    return Array.from(dataTransfer.files ?? []).filter((file) => file.type.startsWith("image/"))
  }

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const imageFiles = getClipboardImageFiles(e.clipboardData)
    if (imageFiles.length === 0) return

    e.preventDefault()
    await insertImageFiles(imageFiles)
  }

  const handleDragEnter = (e: React.DragEvent<HTMLTextAreaElement>) => {
    if (getClipboardImageFiles(e.dataTransfer).length === 0) return

    e.preventDefault()
    setIsDraggingImage(true)
  }

  const handleDragOver = (e: React.DragEvent<HTMLTextAreaElement>) => {
    if (getClipboardImageFiles(e.dataTransfer).length === 0) return

    e.preventDefault()
    e.dataTransfer.dropEffect = "copy"
    setIsDraggingImage(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLTextAreaElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return

    setIsDraggingImage(false)
  }

  const handleDrop = async (e: React.DragEvent<HTMLTextAreaElement>) => {
    const imageFiles = getClipboardImageFiles(e.dataTransfer)
    if (imageFiles.length === 0) return

    e.preventDefault()
    setIsDraggingImage(false)
    await insertImageFiles(imageFiles)
  }

  const handleMarkdownFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const lowerName = file.name.toLowerCase()
    const isHtmlFile =
      lowerName.endsWith(".html") ||
      lowerName.endsWith(".htm") ||
      file.type === "text/html"

    const isCssFile =
      lowerName.endsWith(".css") || file.type === "text/css"

    const isJsFile =
      lowerName.endsWith(".js") ||
      lowerName.endsWith(".mjs") ||
      lowerName.endsWith(".cjs") ||
      file.type === "text/javascript" ||
      file.type === "application/javascript" ||
      file.type === "application/x-javascript"

    const isMarkdownFile =
      lowerName.endsWith(".md") ||
      lowerName.endsWith(".markdown") ||
      file.type === "text/markdown" ||
      file.type === "text/x-markdown" ||
      file.type === "text/plain"

    if (!isHtmlFile && !isCssFile && !isJsFile && !isMarkdownFile) {
      e.target.value = ""
      return
    }

    const wrapInFence = (lang: "html" | "css" | "js", body: string) =>
      `\`\`\`${lang}\n${body.replace(/```/g, "``​`")}\n\`\`\`\n`

    try {
      const fileContent = await file.text()
      const normalizedContent = isHtmlFile
        ? wrapInFence("html", fileContent)
        : isCssFile
          ? wrapInFence("css", fileContent)
          : isJsFile
            ? wrapInFence("js", fileContent)
            : normalizeMarkdownImageHtml(fileContent)
      updateValue(normalizedContent, true)

      if (textareaRef.current) {
        textareaRef.current.focus()
        const end = normalizedContent.length
        textareaRef.current.selectionStart = end
        textareaRef.current.selectionEnd = end
      }
    } catch (error) {
      console.error("Failed to read markdown file", error)
    } finally {
      e.target.value = ""
    }
  }

  const ToolbarButton = ({
    label,
    onClick,
    children,
  }: {
    label: string
    onClick: () => void
    children: React.ReactNode
  }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClick}
          aria-label={label}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-1 border-b border-border bg-muted/30 px-2 overflow-x-auto">
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,.markdown,.html,.htm,.css,.js,.mjs,.cjs,text/markdown,text/x-markdown,text/plain,text/html,text/css,text/javascript,application/javascript"
          className="hidden"
          onChange={handleMarkdownFileUpload}
        />
        <TooltipProvider delayDuration={150}>
          <ToolbarButton
            label="Bold (Cmd+B)"
            onClick={() => handleFormat("**", "**", "bold text")}
          >
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Italic (Cmd+I)"
            onClick={() => handleFormat("*", "*", "italic text")}
          >
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Strikethrough (Cmd+Shift+S)"
            onClick={() => handleFormat("~~", "~~", "strikethrough text")}
          >
            <Strikethrough className="h-4 w-4" />
          </ToolbarButton>
          <div className="mx-1 h-4 w-[1px] bg-border" />
          <ToolbarButton
            label="Heading"
            onClick={() => handleFormat("### ", "", "Heading 3")}
          >
            <Heading1 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Bullet List"
            onClick={() => handleFormat("- ", "", "list item")}
          >
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Ordered List"
            onClick={() => handleFormat("1. ", "", "list item")}
          >
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Quote"
            onClick={() => handleFormat("> ", "", "quote")}
          >
            <Quote className="h-4 w-4" />
          </ToolbarButton>
          <div className="mx-1 h-4 w-[1px] bg-border" />
          <ToolbarButton
            label="Inline Code (Cmd+Shift+C)"
            onClick={() => handleFormat("`", "`", "code")}
          >
            <Code className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Mermaid Diagram (Cmd+Shift+M)"
            onClick={() => handleFormat("```mermaid\n", "\n```", mermaidTemplate)}
          >
            <Workflow className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Live HTML / CSS / JS"
            onClick={() => handleFormat("```html\n", "\n```", htmlTemplate)}
          >
            <Globe className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Link (Cmd+K)"
            onClick={() => handleFormat("[", "](url)", "link text")}
          >
            <LinkIcon className="h-4 w-4" />
          </ToolbarButton>
          <div className="mx-1 h-4 w-[1px] bg-border" />
          <ToolbarButton
            label="Upload file (.md / .html / .css / .js)"
            onClick={handleFileUploadClick}
          >
            <Upload className="h-4 w-4" />
          </ToolbarButton>
          <div className="mx-1 h-4 w-[1px] bg-border" />
          <ToolbarButton
            label="Reset (clear editor)"
            onClick={() => updateValue("", true)}
          >
            <RotateCcw className="h-4 w-4" />
          </ToolbarButton>
          {defaultContent != null ? (
            <ToolbarButton
              label="Load default content"
              onClick={() => updateValue(defaultContent, true)}
            >
              <RefreshCw className="h-4 w-4" />
            </ToolbarButton>
          ) : null}
        </TooltipProvider>
      </div>
      <div ref={scrollContainerRef} onScroll={onScroll} className="relative flex-1 overflow-auto">
        {isDraggingImage ? (
          <div className="pointer-events-none absolute inset-3 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-primary/10 text-sm font-medium text-primary">
            Drop image to insert Markdown
          </div>
        ) : null}
        <textarea
          ref={textareaRef}
          value={displayMarkdown}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`h-full min-h-full w-full resize-none bg-background py-4 pr-4 pl-4 font-mono text-sm leading-relaxed text-foreground placeholder:text-muted-foreground transition-colors focus:outline-none ${isDraggingImage ? "bg-primary/5" : ""}`}
          placeholder="Start writing markdown here... Paste or drop images to insert them."
          spellCheck={false}
        />
      </div>
    </div>
  )
}
