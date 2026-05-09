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
import { markdownComponentsWithMermaid, markdownUrlTransform } from "@/components/markdown-components"
import { normalizeMarkdownImageHtml } from "@/lib/markdown"
import { expandMarckoInlineImagesInMarkdown } from "@/lib/markdown-inline-images"
import { looksLikeHtmlDocument, wrapAsHtmlDocument } from "@/lib/html-source"

interface MarkdownPreviewProps {
  content: string
  showCopyButton?: boolean
  onOpenPreview?: () => void
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>
  onScroll?: React.UIEventHandler<HTMLDivElement>
}

export function MarkdownPreview({
  content,
  showCopyButton = true,
  onOpenPreview,
  scrollContainerRef,
  onScroll,
}: MarkdownPreviewProps) {
  const previewRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)
  const normalizedContent = useMemo(
    () =>
      expandMarckoInlineImagesInMarkdown(normalizeMarkdownImageHtml(content)),
    [content],
  )

  const isHtmlSource = useMemo(() => looksLikeHtmlDocument(content), [content])
  const htmlSrcDoc = useMemo(
    () => (isHtmlSource ? wrapAsHtmlDocument(content) : ""),
    [isHtmlSource, content],
  )

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
      <div className="flex h-10 items-center justify-between border-b border-border/70 bg-muted/30 px-2 backdrop-blur-sm">
        <div className="flex items-center gap-1 min-w-0">
          {onOpenPreview ? (
            <TooltipProvider delayDuration={120}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onOpenPreview}
                    aria-label="Open distraction-free preview"
                    className="group flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-primary"
                  >
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="font-mono text-[10px]">
                  Open distraction-free preview
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}
        </div>
        {showCopyButton && (
          <TooltipProvider delayDuration={120}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={copyRenderedContent}
                  className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
                  aria-label="Copy rendered content"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="font-mono text-[10px]">
                {copied ? "Copied" : "Copy rendered content"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <div
        ref={scrollContainerRef}
        onScroll={onScroll}
        className="flex-1 overflow-auto min-h-0"
      >
        {isHtmlSource ? (
          <div ref={previewRef} className="h-full w-full">
            <iframe
              title="HTML preview"
              srcDoc={htmlSrcDoc}
              sandbox="allow-scripts allow-popups allow-forms allow-modals"
              className="h-full min-h-[calc(100vh-3rem)] w-full border-0 bg-white"
            />
          </div>
        ) : (
          <div
            ref={previewRef}
            className="markdown-content py-4 pr-4 pl-10"
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
        )}
      </div>
    </div>
  )
}
