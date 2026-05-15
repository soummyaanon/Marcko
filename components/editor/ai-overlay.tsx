"use client"

import { useEffect } from "react"
import { Check, X, Loader2 } from "lucide-react"

export type AIOverlayProps = {
  isOpen: boolean
  text: string
  loading: boolean
  error: string | null
  anchor: { top: number; left: number } | null
  onAccept: () => void
  onDiscard: () => void
}

export function AIOverlay(props: AIOverlayProps) {
  const { isOpen, text, loading, error, anchor, onAccept, onDiscard } = props

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!isOpen) return
      if (e.key === "Escape") {
        e.preventDefault()
        onDiscard()
      }
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        if (!loading && !error) onAccept()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [isOpen, loading, error, onAccept, onDiscard])

  if (!isOpen || !anchor) return null
  return (
    <div
      role="dialog"
      aria-label="AI suggestion"
      className="fixed z-50 max-w-md rounded-xl border border-zinc-200 bg-white p-3 shadow-lg"
      style={{ top: anchor.top, left: anchor.left }}
    >
      <pre className="whitespace-pre-wrap text-sm text-zinc-800">{text}</pre>
      {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
      <div className="mt-2 flex items-center justify-end gap-2">
        {loading && <Loader2 className="size-4 animate-spin text-zinc-400" />}
        <button
          onClick={onDiscard}
          className="rounded-md border border-zinc-200 px-2 py-1 text-xs"
          aria-label="Discard (Esc)"
        >
          <X className="size-4" />
        </button>
        <button
          onClick={onAccept}
          disabled={loading || !!error || !text}
          className="rounded-md bg-zinc-900 px-2 py-1 text-xs text-white disabled:opacity-40"
          aria-label="Accept (Cmd/Ctrl+Enter)"
        >
          <Check className="size-4" />
        </button>
      </div>
    </div>
  )
}
