"use client"

import { useMemo, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import remarkBreaks from "remark-breaks"
import rehypeKatex from "rehype-katex"
import rehypeHighlight from "rehype-highlight"
import rehypeRaw from "rehype-raw"
import { Check, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { markdownComponentsWithMermaid } from "@/components/markdown-components"
import { normalizeMarkdownImageHtml } from "@/lib/markdown"

interface MarkdownPreviewProps {
  content: string
  showCopyButton?: boolean
  onOpenPreview?: () => void
}

export function MarkdownPreview({
  content,
  showCopyButton = true,
  onOpenPreview,
}: MarkdownPreviewProps) {
  const previewRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)
  const normalizedContent = useMemo(() => normalizeMarkdownImageHtml(content), [content])

  const copyRenderedContent = async () => {
    if (previewRef.current) {
      try {
        const selection = window.getSelection()
        const range = document.createRange()
        range.selectNodeContents(previewRef.current)
        selection?.removeAllRanges()
        selection?.addRange(range)
        
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([previewRef.current.innerHTML], { type: "text/html" }),
            "text/plain": new Blob([previewRef.current.innerText], { type: "text/plain" }),
          }),
        ])
        
        selection?.removeAllRanges()
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch {
        await navigator.clipboard.writeText(previewRef.current.innerText)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center justify-between border-b border-border bg-muted/30 px-4">
        <div className="flex items-center gap-2">
          {onOpenPreview ? (
            <TooltipProvider delayDuration={120}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onOpenPreview}
                    className="h-8 gap-2 border border-primary/30 bg-primary/10 px-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
                  >
                    <svg
                      className="h-4 w-4 text-primary"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                    <span className="font-semibold text-primary">Preview</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Open full preview</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <>
              <svg
                className="h-4 w-4 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
              <span className="text-sm font-medium text-foreground">Preview</span>
            </>
          )}
        </div>
        {showCopyButton && (
          <Button
            variant="ghost"
            size="sm"
            onClick={copyRenderedContent}
            className="h-8 gap-1.5 text-xs"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copy Content
              </>
            )}
          </Button>
        )}
      </div>
      <div className="flex-1 overflow-auto min-h-0">
        <div
          ref={previewRef}
          className="markdown-content py-4 pr-4 pl-10"
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]}
            rehypePlugins={[rehypeKatex, rehypeHighlight, rehypeRaw]}
            components={markdownComponentsWithMermaid}
          >
            {normalizedContent}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  )
}
