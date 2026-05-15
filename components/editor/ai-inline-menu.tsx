"use client"

import { useEffect, useRef, useState } from "react"
import { useTier } from "@/components/pro-gate"
import { AIOverlay } from "./ai-overlay"

type Action =
  | { kind: "rewrite" | "expand" | "shorten" | "grammar" }
  | { kind: "translate"; targetLanguage: string }
  | { kind: "tone"; tone: "casual" | "formal" | "technical" | "friendly" }

export type Selection = {
  text: string
  context: string
  rect: DOMRect
}

export type AIInlineMenuProps = {
  selection: Selection | null
  onApply: (replacement: string) => void
  onDismiss: () => void
}

export function AIInlineMenu({ selection, onApply, onDismiss }: AIInlineMenuProps) {
  const tier = useTier()
  const [overlayAnchor, setOverlayAnchor] = useState<{ top: number; left: number } | null>(null)
  const [streamed, setStreamed] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  async function run(action: Action) {
    if (!tier.isPro) {
      window.location.href = "/pricing"
      return
    }
    if (!selection) return

    setOverlayAnchor({ top: selection.rect.bottom + 8, left: selection.rect.left })
    setStreamed("")
    setError(null)
    setLoading(true)

    const ctl = new AbortController()
    abortRef.current = ctl

    const options =
      action.kind === "translate"
        ? { targetLanguage: action.targetLanguage }
        : action.kind === "tone"
          ? { tone: action.tone }
          : undefined

    try {
      const res = await fetch("/api/ai/inline", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          action: action.kind,
          selection: selection.text,
          context: selection.context,
          options,
        }),
        signal: ctl.signal,
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? `Request failed (${res.status})`)
        setLoading(false)
        return
      }
      const reader = res.body?.getReader()
      if (!reader) {
        setError("No response body.")
        setLoading(false)
        return
      }
      const decoder = new TextDecoder()
      let buf = ""
      // For toTextStreamResponse, each chunk is plain text.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        setStreamed(buf)
      }
      setLoading(false)
    } catch (e) {
      if ((e as { name?: string }).name === "AbortError") return
      setError("Network error.")
      setLoading(false)
    }
  }

  function accept() {
    if (!streamed) return
    onApply(streamed)
    cleanup()
  }

  function discard() {
    abortRef.current?.abort()
    cleanup()
    onDismiss()
  }

  function cleanup() {
    setOverlayAnchor(null)
    setStreamed("")
    setError(null)
    setLoading(false)
  }

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  if (!selection) return null

  return (
    <>
      <div
        role="menu"
        className="fixed z-40 flex gap-1 rounded-full border border-zinc-200 bg-white px-2 py-1 shadow"
        style={{ top: selection.rect.top - 40, left: selection.rect.left }}
      >
        {(["rewrite", "expand", "shorten", "grammar"] as const).map((kind) => (
          <button
            key={kind}
            onClick={() => run({ kind })}
            disabled={loading}
            className="rounded-full px-2 py-1 text-xs hover:bg-zinc-100 disabled:opacity-50"
          >
            {kind}
            {!tier.isPro && (
              <span className="ml-1 rounded-full bg-zinc-900 px-1 text-[8px] text-white">PRO</span>
            )}
          </button>
        ))}
        <button
          onClick={() => run({ kind: "translate", targetLanguage: "Spanish" })}
          disabled={loading}
          className="rounded-full px-2 py-1 text-xs hover:bg-zinc-100 disabled:opacity-50"
        >
          translate
        </button>
      </div>
      <AIOverlay
        isOpen={overlayAnchor !== null}
        text={streamed}
        loading={loading}
        error={error}
        anchor={overlayAnchor}
        onAccept={accept}
        onDiscard={discard}
      />
    </>
  )
}
