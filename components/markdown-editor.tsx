"use client"

import React from "react"

import { useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { 
  Bold, 
  Italic, 
  Strikethrough, 
  Heading1, 
  List, 
  ListOrdered, 
  Quote, 
  Code, 
  Link as LinkIcon 
} from "lucide-react"

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
}

export function MarkdownEditor({ value, onChange }: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  
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

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-1 border-b border-border bg-muted/30 px-2 overflow-x-auto">
        <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => handleFormat("**", "**", "bold text")}
            title="Bold (Cmd+B)"
        >
            <Bold className="h-4 w-4" />
        </Button>
        <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => handleFormat("*", "*", "italic text")}
            title="Italic (Cmd+I)"
        >
            <Italic className="h-4 w-4" />
        </Button>
        <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => handleFormat("~~", "~~", "strikethrough text")}
            title="Strikethrough (Cmd+Shift+S)"
        >
            <Strikethrough className="h-4 w-4" />
        </Button>
        <div className="mx-1 h-4 w-[1px] bg-border" />
        <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => handleFormat("### ", "", "Heading 3")}
            title="Heading"
        >
            <Heading1 className="h-4 w-4" />
        </Button>
        <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => handleFormat("- ", "", "list item")}
            title="Bullet List"
        >
            <List className="h-4 w-4" />
        </Button>
        <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => handleFormat("1. ", "", "list item")}
            title="Ordered List"
        >
            <ListOrdered className="h-4 w-4" />
        </Button>
        <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => handleFormat("> ", "", "quote")}
            title="Quote"
        >
            <Quote className="h-4 w-4" />
        </Button>
        <div className="mx-1 h-4 w-[1px] bg-border" />
        <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => handleFormat("`", "`", "code")}
            title="Inline Code (Cmd+Shift+C)"
        >
            <Code className="h-4 w-4" />
        </Button>
        <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => handleFormat("[", "](url)", "link text")}
            title="Link (Cmd+K)"
        >
            <LinkIcon className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-auto">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          className="h-full min-h-full w-full resize-none bg-background py-4 pr-4 pl-4 font-mono text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
          placeholder="Start writing markdown here..."
          spellCheck={false}
        />
      </div>
    </div>
  )
}
