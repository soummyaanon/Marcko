"use client"

import { useEffect, useRef, useState } from "react"
import { useTier } from "@/components/pro-gate"
import { AIOverlay } from "./ai-overlay"

export type SlashAction =
  | "generate_section"
  | "mermaid"
  | "table"
  | "code"
  | "summarize"

export type AISlashMenuProps = {
  trigger: { rect: DOMRect; context: string } | null
  onInsert: (text: string) => void
  onDismiss: () => void
}

const ACTIONS: { kind: SlashAction; label: string }[] = [
  { kind: "generate_section", label: "Generate section" },
  { kind: "mermaid", label: "Mermaid diagram" },
  { kind: "table", label: "Table" },
  { kind: "code", label: "Code snippet" },
  { kind: "summarize", label: "Summarize selection" },
]

export function AISlashMenu({ trigger, onInsert, onDismiss }: AISlashMenuProps) {
  const tier = useTier()
  const [open, setOpen] = useState(false)
  const [instructions, setInstructions] = useState("")
  const [streamed, setStreamed] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  async function run(action: SlashAction) {
    if (!tier.isPro) {
      window.location.href = "/pricing"
      return
    }
    if (!trigger) return

    setOpen(true)
    setStreamed("")
    setError(null)
    setLoading(true)

    const ctl = new AbortController()
    abortRef.current = ctl

    try {
      const res = await fetch("/api/ai/inline", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          action,
          selection: "",
          context: trigger.context,
          options: instructions ? { instructions } : undefined,
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
    onInsert(streamed)
    cleanup()
  }

  function discard() {
    abortRef.current?.abort()
    cleanup()
    onDismiss()
  }

  function cleanup() {
    setOpen(false)
    setInstructions("")
    setStreamed("")
    setError(null)
    setLoading(false)
  }

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  if (!trigger) return null
  return (
    <>
      <div
        role="menu"
        className="fixed z-40 w-64 rounded-xl border border-zinc-200 bg-white p-2 shadow"
        style={{ top: trigger.rect.bottom + 6, left: trigger.rect.left }}
      >
        <input
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Optional instructions…"
          className="mb-2 w-full rounded-md border border-zinc-200 px-2 py-1 text-xs"
        />
        {ACTIONS.map((a) => (
          <button
            key={a.kind}
            onClick={() => run(a.kind)}
            disabled={loading}
            className="block w-full rounded-md px-2 py-1 text-left text-xs hover:bg-zinc-100 disabled:opacity-50"
          >
            {a.label}
            {!tier.isPro && (
              <span className="ml-1 rounded-full bg-zinc-900 px-1 text-[8px] text-white">PRO</span>
            )}
          </button>
        ))}
      </div>
      <AIOverlay
        isOpen={open}
        text={streamed}
        loading={loading}
        error={error}
        anchor={open ? { top: trigger.rect.bottom + 6, left: trigger.rect.left + 280 } : null}
        onAccept={accept}
        onDiscard={discard}
      />
    </>
  )
}
