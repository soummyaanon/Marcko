"use client"

import React from "react"

import { useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { normalizeMarkdownImageHtml } from "@/lib/markdown"
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
  Workflow
} from "lucide-react"

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
}

export function MarkdownEditor({ value, onChange }: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mermaidTemplate = "graph TD\n    A[Write Markdown] --> B[Live Preview]"
  
  // History state
  const [history, setHistory] = React.useState<string[]>([value])
  const [historyIndex, setHistoryIndex] = React.useState(0)
  
  // Ref to track if we're ignoring updates (e.g. during undo/redo) to prevent double history
  const ignoreHistoryUpdate = useRef(false)
  const lastHistoryValue = useRef(value)

  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = "auto"
      textarea.style.height = `${textarea.scrollHeight}px`
    }
  }, [value])

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
      const newValue = value.substring(0, start) + "  " + value.substring(end)
      updateValue(newValue, true)
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

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = value.substring(start, end)
    
    let newText = ""
    let newCursorPos = 0

    if (selectedText) {
      newText = value.substring(0, start) + prefix + selectedText + suffix + value.substring(end)
      newCursorPos = start + prefix.length + selectedText.length + suffix.length
    } else {
      newText = value.substring(0, start) + prefix + placeholder + suffix + value.substring(end)
      newCursorPos = start + prefix.length + placeholder.length
    }

    updateValue(newText, true)
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
  
  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
      const newValue = (e.target as HTMLTextAreaElement).value
      onChange(newValue)
      
      // Heuristic: Save history on space, enter, or if length diff is large (paste)
      const diff = Math.abs(newValue.length - history[historyIndex].length)
      if (diff > 5 || newValue.endsWith(' ') || newValue.endsWith('\n')) {
          // We don't want to save EVERY space, but maybe good enough for now?
          // Actually, let's just use a debounced saver?
      }
      
      // Better: Just use a timeout to save history 1s after last type
  }
  
  // We need a ref to access the latest params in the timeout
  const latestValueRef = useRef(value)
  useEffect(() => { latestValueRef.current = value }, [value])
  const latestHistoryIndexRef = useRef(historyIndex)
  useEffect(() => { latestHistoryIndexRef.current = historyIndex }, [historyIndex])
  const latestHistoryRef = useRef(history)
  useEffect(() => { latestHistoryRef.current = history }, [history])

  const debounceTimer = useRef<NodeJS.Timeout>(null)

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value
      onChange(newValue)
      
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      
      debounceTimer.current = setTimeout(() => {
          // Save to history after 1s of inactivity
           const currentIndex = latestHistoryIndexRef.current
           const currentHistory = latestHistoryRef.current
           // Only add if different from current head
           if (newValue !== currentHistory[currentIndex]) {
               setHistory(prev => {
                   const newH = prev.slice(0, currentIndex + 1)
                   newH.push(newValue)
                   return newH
               })
               setHistoryIndex(prev => prev + 1)
           }
      }, 1000)
  }

  const handleFileUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleMarkdownFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const isMarkdownFile =
      file.name.toLowerCase().endsWith(".md") ||
      file.type === "text/markdown" ||
      file.type === "text/x-markdown" ||
      file.type === "text/plain"

    if (!isMarkdownFile) {
      e.target.value = ""
      return
    }

    try {
      const fileContent = await file.text()
      const normalizedContent = normalizeMarkdownImageHtml(fileContent)
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
          accept=".md,text/markdown,text/x-markdown,text/plain"
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
            label="Link (Cmd+K)"
            onClick={() => handleFormat("[", "](url)", "link text")}
          >
            <LinkIcon className="h-4 w-4" />
          </ToolbarButton>
          <div className="mx-1 h-4 w-[1px] bg-border" />
          <ToolbarButton
            label="Upload Markdown (.md)"
            onClick={handleFileUploadClick}
          >
            <Upload className="h-4 w-4" />
          </ToolbarButton>
        </TooltipProvider>
      </div>
      <div className="flex-1 overflow-auto">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          className="h-full min-h-full w-full resize-none bg-background py-4 pr-4 pl-4 font-mono text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
          placeholder="Start writing markdown here... Use ```mermaid blocks for diagrams."
          spellCheck={false}
        />
      </div>
    </div>
  )
}
