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

  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = "auto"
      textarea.style.height = `${textarea.scrollHeight}px`
    }
  }, [value])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault()
      const start = e.currentTarget.selectionStart
      const end = e.currentTarget.selectionEnd
      const newValue = value.substring(0, start) + "  " + value.substring(end)
      onChange(newValue)
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

    onChange(newText)
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

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-1 border-b border-border bg-muted/30 px-2 overflow-x-auto">
        <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => handleFormat("**", "**", "bold text")}
            title="Bold"
        >
            <Bold className="h-4 w-4" />
        </Button>
        <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => handleFormat("*", "*", "italic text")}
            title="Italic"
        >
            <Italic className="h-4 w-4" />
        </Button>
        <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => handleFormat("~~", "~~", "strikethrough text")}
            title="Strikethrough"
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
            title="Inline Code"
        >
            <Code className="h-4 w-4" />
        </Button>
        <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => handleFormat("[", "](url)", "link text")}
            title="Link"
        >
            <LinkIcon className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-auto">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-full min-h-full w-full resize-none bg-background py-4 pr-4 pl-4 font-mono text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
          placeholder="Start writing markdown here..."
          spellCheck={false}
        />
      </div>
    </div>
  )
}
