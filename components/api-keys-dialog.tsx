"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Check,
  Copy,
  Key,
  Loader2,
  Plus,
  ShieldCheck,
  Trash2,
  TriangleAlert,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { copyTextToClipboard } from "@/lib/clipboard"

type ApiKeyItem = {
  id: string
  label: string
  last4: string
  createdAt: string
  lastUsedAt: string | null
}

interface ApiKeysDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const formatDate = (value: string | null) => {
  if (!value) return "never"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString()
}

export function ApiKeysDialog({ open, onOpenChange }: ApiKeysDialogProps) {
  const [items, setItems] = useState<ApiKeyItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [label, setLabel] = useState("Claude Desktop")
  const [creating, setCreating] = useState(false)
  const [revealedKey, setRevealedKey] = useState<{ key: string; label: string } | null>(null)
  const [copiedKey, setCopiedKey] = useState(false)
  const [copiedSnippet, setCopiedSnippet] = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)

  const claudeSnippet = useMemo(() => {
    const key = revealedKey?.key ?? "mk_PASTE_YOUR_KEY"
    return `{
  "mcpServers": {
    "marcko": {
      "command": "npx",
      "args": ["-y", "marcko-mcp@latest"],
      "env": {
        "MARCKO_API_KEY": "${key}"
      }
    }
  }
}`
  }, [revealedKey])

  const loadKeys = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/keys", { cache: "no-store" })
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { message?: string } | null
        throw new Error(data?.message ?? "Unable to load keys")
      }
      const data = (await response.json()) as { items?: ApiKeyItem[] }
      setItems(Array.isArray(data.items) ? data.items : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load keys")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return
    setRevealedKey(null)
    setCopiedKey(false)
    setCopiedSnippet(false)
    void loadKeys()
  }, [open])

  const createKey = async () => {
    setCreating(true)
    setError(null)
    try {
      const response = await fetch("/api/keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label }),
      })
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { message?: string } | null
        throw new Error(data?.message ?? "Unable to create key")
      }
      const data = (await response.json()) as {
        id: string
        label: string
        last4: string
        createdAt: string
        plainKey: string
      }
      setRevealedKey({ key: data.plainKey, label: data.label })
      setItems((prev) => [
        {
          id: data.id,
          label: data.label,
          last4: data.last4,
          createdAt: data.createdAt,
          lastUsedAt: null,
        },
        ...prev,
      ])
      setLabel("Claude Desktop")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create key")
    } finally {
      setCreating(false)
    }
  }

  const revokeKey = async (id: string) => {
    if (!window.confirm("Revoke this API key? Anything using it will stop working immediately.")) return
    setRevokingId(id)
    try {
      const response = await fetch(`/api/keys?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      })
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { message?: string } | null
        throw new Error(data?.message ?? "Unable to revoke key")
      }
      setItems((prev) => prev.filter((item) => item.id !== id))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to revoke key")
    } finally {
      setRevokingId(null)
    }
  }

  const copyKey = async () => {
    if (!revealedKey) return
    const ok = await copyTextToClipboard(revealedKey.key)
    if (ok) {
      setCopiedKey(true)
      toast.success("Key copied")
      setTimeout(() => setCopiedKey(false), 1800)
    } else {
      toast.error("Unable to copy key")
    }
  }

  const copySnippet = async () => {
    const ok = await copyTextToClipboard(claudeSnippet)
    if (ok) {
      setCopiedSnippet(true)
      toast.success("Snippet copied")
      setTimeout(() => setCopiedSnippet(false), 1800)
    } else {
      toast.error("Unable to copy snippet")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(680px,calc(100dvh-2rem))] w-full max-w-[calc(100vw-2rem)] flex-col gap-4 overflow-hidden p-5 sm:max-w-2xl">
        <DialogHeader className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-primary" />
            <DialogTitle className="font-display text-[22px] italic leading-none">
              Connect Claude Desktop
            </DialogTitle>
          </div>
          <DialogDescription className="text-[12px] leading-relaxed">
            Generate a Marcko API key, paste it into Claude Desktop, and publish drafts straight from chat —
            no copy-paste required.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-[11px] leading-relaxed text-emerald-800 dark:text-emerald-200">
          <div className="flex items-start gap-1.5">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Keys are hashed before they leave the form. We never store the plaintext — copy it now or revoke
              and create a new one.
            </span>
          </div>
        </div>

        {/* Reveal */}
        {revealedKey ? (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.18em] text-primary">
              <TriangleAlert className="h-3.5 w-3.5" />
              Shown once · {revealedKey.label}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 truncate rounded-md bg-background/80 px-2 py-1.5 font-mono text-[12px] text-foreground">
                {revealedKey.key}
              </code>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-[11px]"
                onClick={copyKey}
              >
                {copiedKey ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedKey ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
        ) : null}

        {/* Snippet */}
        <div className="rounded-lg border border-border bg-card/50 p-3">
          <div className="flex items-center justify-between">
            <span className="eyebrow">Claude Desktop config</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-[11px]"
              onClick={copySnippet}
            >
              {copiedSnippet ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedSnippet ? "Copied" : "Copy snippet"}
            </Button>
          </div>
          <pre className="mt-2 max-h-44 overflow-auto rounded-md bg-background/70 p-2 font-mono text-[11px] leading-relaxed text-foreground">
            <code>{claudeSnippet}</code>
          </pre>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Paste into <code className="font-mono">~/Library/Application Support/Claude/claude_desktop_config.json</code> on macOS
            (or the Windows equivalent), then restart Claude Desktop.
          </p>
        </div>

        {/* Create */}
        <div className="rounded-lg border border-border bg-card/50 p-3">
          <span className="eyebrow">Create a key</span>
          <div className="mt-2 flex items-center gap-2">
            <Input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Label (e.g. Claude Desktop)"
              className="h-9 text-[12px]"
              maxLength={80}
            />
            <Button
              onClick={createKey}
              disabled={creating || label.trim().length === 0}
              size="sm"
              className="h-9 gap-1.5 rounded-full bg-foreground px-4 text-[12px] font-semibold text-background hover:bg-foreground/90"
            >
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Create
            </Button>
          </div>
        </div>

        {/* Existing keys */}
        <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden">
          <span className="eyebrow">Active keys</span>
          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-[11px] text-destructive">
              {error}
            </div>
          ) : null}
          {loading ? (
            <div className="flex items-center justify-center py-4 text-[11px] text-muted-foreground">
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              Loading keys…
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-md border border-border bg-muted/30 p-3 text-[11px] text-muted-foreground">
              No active keys yet — create one above.
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-2.5 py-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Key className="h-3 w-3 shrink-0 text-primary" />
                      <span className="truncate text-[12px] font-medium">{item.label}</span>
                      <code className="font-mono text-[10px] text-muted-foreground/80">
                        ····{item.last4}
                      </code>
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] text-muted-foreground/80">
                      created {formatDate(item.createdAt)} · last used {formatDate(item.lastUsedAt)}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 text-[11px]"
                    onClick={() => revokeKey(item.id)}
                    disabled={revokingId === item.id}
                  >
                    {revokingId === item.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                    Revoke
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
