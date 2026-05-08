"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Code2,
  Copy,
  ExternalLink,
  Loader2,
  Menu,
  Monitor,
  Moon,
  Plus,
  RotateCw,
  Settings2,
  Sparkles,
  Sun,
  Trash2,
  Wand2,
  X,
} from "lucide-react"
import { useTheme } from "next-themes"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { copyTextToClipboard } from "@/lib/clipboard"

type QuestionType = "short_text" | "long_text" | "rating" | "single_choice"

type FeedbackQuestion = {
  id: string
  type: QuestionType
  label: string
  required?: boolean
  placeholder?: string
  options?: string[]
}

type WidgetSummary = {
  id: string
  publicKey: string
  name: string
  triggerLabel: string
  accent: string
  questions: FeedbackQuestion[]
  createdAt: string
  updatedAt: string
  responseCount: number
  lastResponseAt: string | null
}

type ResponseRow = {
  id: string
  widgetId: string
  answers: Record<string, unknown>
  pageUrl: string | null
  userAgent: string | null
  submittedAt: string
}

type TabKey = "settings" | "questions" | "embed" | "responses"

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  short_text: "Short text",
  long_text: "Long text",
  rating: "Rating",
  single_choice: "Choice",
}

const newId = () => Math.random().toString(36).slice(2, 10)

const buildSnippet = (origin: string, key: string) =>
  `<script src="${origin}/widget.js" data-key="${key}"></script>`

const buildManualSnippet = (origin: string, key: string) =>
  `<!-- Marcko Feedback (works in Electron / strict CSP) -->
<script>
  (function(){var s=document.createElement('script');s.src='${origin}/widget.js';s.async=true;s.dataset.key='${key}';document.body.appendChild(s);})();
</script>`

const buildCustomTriggerSnippet = (origin: string, key: string) =>
  `<!-- Suppress the floating button; trigger from your own UI -->
<script src="${origin}/widget.js" data-key="${key}" data-trigger="custom"></script>

<!-- Option A · any element with this attribute opens the widget on click -->
<button data-marcko-feedback>Send feedback</button>

<!-- Option B · open programmatically from your own code -->
<script>
  document.querySelector('#my-help-link').addEventListener('click', function () {
    window.MarckoFeedback.open()
  })

  // Listen for successful submissions
  window.addEventListener('marcko:submit', function (e) {
    console.log('feedback submitted', e.detail.answers)
  })
</script>`

const buildReactSnippet = (origin: string, key: string) =>
  `// components/MarckoFeedback.tsx
"use client"
import { useEffect } from "react"

export function MarckoFeedback() {
  useEffect(() => {
    if (document.querySelector('script[data-marcko-feedback-loader]')) return
    const s = document.createElement("script")
    s.src = "${origin}/widget.js"
    s.async = true
    s.dataset.key = "${key}"
    s.dataset.marckoFeedbackLoader = "1"
    document.body.appendChild(s)
  }, [])
  return null
}

// app/layout.tsx — render once, anywhere
// <MarckoFeedback />`

const formatRelative = (iso: string | null): string => {
  if (!iso) return "no responses yet"
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return "—"
  const diff = Date.now() - then
  if (diff < 60_000) return "just now"
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`
  if (diff < 7 * 86_400_000) return `${Math.round(diff / 86_400_000)}d ago`
  return new Date(iso).toLocaleDateString()
}

const accentSwatches = ["#111111", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"]

export function FeedbackDashboard() {
  const [origin, setOrigin] = useState("https://marcko.bixai.dev")
  const [items, setItems] = useState<WidgetSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin)
  }, [])

  const loadList = useCallback(async () => {
    setLoading(true)
    setError(null)
    setAuthError(false)
    try {
      const res = await fetch("/api/feedback/widgets", { cache: "no-store" })
      if (res.status === 401) {
        setAuthError(true)
        setItems([])
        return
      }
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? "Failed to load")
      const data = (await res.json()) as { items?: WidgetSummary[] }
      const list = Array.isArray(data.items) ? data.items : []
      setItems(list)
      setSelectedId((current) => current ?? list[0]?.id ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadList()
  }, [loadList])

  const selected = useMemo(
    () => (selectedId ? items.find((w) => w.id === selectedId) ?? null : null),
    [items, selectedId],
  )

  const upsertWidgetInList = (next: WidgetSummary) => {
    setItems((prev) => {
      const idx = prev.findIndex((w) => w.id === next.id)
      if (idx === -1) return [next, ...prev]
      const copy = prev.slice()
      copy[idx] = { ...prev[idx], ...next }
      return copy
    })
  }

  const handleCreate = async () => {
    try {
      const res = await fetch("/api/feedback/widgets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Untitled widget" }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { message?: string } | null
        throw new Error(data?.message ?? "Failed to create")
      }
      const widget = (await res.json()) as WidgetSummary
      const summary: WidgetSummary = { ...widget, responseCount: 0, lastResponseAt: null }
      setItems((prev) => [summary, ...prev])
      setSelectedId(summary.id)
      setSidebarOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create widget")
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this widget? Responses will be removed too.")) return
    try {
      const res = await fetch(`/api/feedback/widgets/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { message?: string } | null
        throw new Error(data?.message ?? "Failed to delete")
      }
      setItems((prev) => {
        const next = prev.filter((w) => w.id !== id)
        if (selectedId === id) setSelectedId(next[0]?.id ?? null)
        return next
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete")
    }
  }

  if (authError) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-6">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card/60 p-8 text-center backdrop-blur">
          <span className="eyebrow">Marcko · Feedback</span>
          <h1 className="mt-3 font-display text-[34px] italic leading-tight text-foreground">
            Sign in to listen.
          </h1>
          <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
            Marcko Feedback uses the same Google sign-in as the editor.
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-full bg-foreground px-4 text-[12px] font-semibold text-background transition hover:bg-foreground/90"
          >
            Go to editor
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-[100dvh] overflow-hidden bg-background text-foreground">
      {/* Mobile top bar */}
      <header className="flex items-center justify-between gap-3 border-b border-border bg-background px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition hover:text-foreground"
          aria-label="Open widgets"
        >
          <Menu className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2 truncate">
          <span className="eyebrow">Marcko · Feedback</span>
          {selected ? (
            <>
              <span className="text-muted-foreground">/</span>
              <span className="truncate font-display text-[16px] italic">{selected.name}</span>
            </>
          ) : null}
        </div>
        <Button
          size="sm"
          onClick={handleCreate}
          className="h-9 shrink-0 gap-1 rounded-full bg-foreground px-3 text-[12px] font-semibold text-background hover:bg-foreground/90"
        >
          <Plus className="h-3.5 w-3.5" />
          New
        </Button>
      </header>

      <div className="grid h-full grid-cols-1 lg:grid-cols-[300px_1fr]">
        {/* Sidebar */}
        <Sidebar
          items={items}
          loading={loading}
          selectedId={selectedId}
          onSelect={(id) => {
            setSelectedId(id)
            setSidebarOpen(false)
          }}
          onCreate={handleCreate}
          mobileOpen={sidebarOpen}
          onCloseMobile={() => setSidebarOpen(false)}
        />

        {/* Main pane */}
        <main className="flex h-full min-h-0 flex-col overflow-hidden">
          {error ? (
            <div className="m-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-[12px] text-destructive">
              {error}
            </div>
          ) : null}

          {loading && !selected ? (
            <div className="flex flex-1 items-center justify-center text-[12px] text-muted-foreground">
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              Loading workspace…
            </div>
          ) : selected ? (
            <WidgetWorkspace
              key={selected.id}
              origin={origin}
              widget={selected}
              onChange={upsertWidgetInList}
              onDelete={handleDelete}
              onReload={loadList}
            />
          ) : (
            <EmptyState onCreate={handleCreate} />
          )}
        </main>
      </div>
    </div>
  )
}

function Sidebar({
  items,
  loading,
  selectedId,
  onSelect,
  onCreate,
  mobileOpen,
  onCloseMobile,
}: {
  items: WidgetSummary[]
  loading: boolean
  selectedId: string | null
  onSelect: (id: string) => void
  onCreate: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
}) {
  const content = (
    <div className="flex h-full flex-col gap-5 border-r border-border bg-muted/30 p-5">
      <div className="space-y-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to editor
        </Link>
        <div>
          <span className="eyebrow">Marcko</span>
          <h2 className="font-display text-[26px] italic leading-none text-foreground">
            Feedback
          </h2>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            Embed widgets. Read responses.
          </p>
        </div>
        <Button
          onClick={onCreate}
          size="sm"
          className="h-9 w-full gap-1.5 rounded-full bg-foreground text-[12px] font-semibold text-background hover:bg-foreground/90"
        >
          <Plus className="h-3.5 w-3.5" />
          New widget
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="eyebrow">Widgets · {items.length}</span>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-0.5">
          {loading && items.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-background/50 p-4 text-center">
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                No widgets yet.<br />Create one to get started.
              </p>
            </div>
          ) : (
            items.map((widget) => (
              <button
                key={widget.id}
                type="button"
                onClick={() => onSelect(widget.id)}
                className={`group flex items-center gap-3 rounded-lg px-2.5 py-2 text-left transition ${
                  selectedId === widget.id
                    ? "bg-background shadow-[inset_0_0_0_1px_hsl(var(--border))]"
                    : "hover:bg-background/60"
                }`}
              >
                <span
                  className={`relative h-2 w-2 shrink-0 rounded-full transition ${
                    selectedId === widget.id ? "scale-110" : "opacity-70 group-hover:opacity-100"
                  }`}
                  style={{ background: widget.accent }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate font-display text-[15px] italic leading-tight ${
                      selectedId === widget.id ? "text-foreground" : "text-foreground/80"
                    }`}
                  >
                    {widget.name}
                  </span>
                  <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-muted-foreground">
                    {widget.responseCount} {widget.responseCount === 1 ? "reply" : "replies"} ·{" "}
                    {formatRelative(widget.lastResponseAt)}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="space-y-2 border-t border-border pt-4">
        <ThemeToggle />
        <div className="space-y-1">
          <SidebarLink href="/widget.js" icon={<Code2 className="h-3 w-3" />} label="Widget source" external />
          <SidebarLink
            href="https://www.npmjs.com/package/marcko-mcp"
            icon={<ExternalLink className="h-3 w-3" />}
            label="MCP package"
            external
          />
          <SidebarLink href="/" icon={<Settings2 className="h-3 w-3" />} label="Editor settings" />
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop */}
      <aside className="hidden h-full lg:block">{content}</aside>

      {/* Mobile sheet */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
            onClick={onCloseMobile}
            aria-hidden
          />
          <div className="relative ml-0 mr-auto h-full w-[80vw] max-w-[320px] animate-in slide-in-from-left">
            {content}
            <button
              type="button"
              onClick={onCloseMobile}
              className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="Close sidebar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}

function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const current = mounted ? theme ?? "system" : "system"
  const options: { value: string; icon: React.ReactNode; label: string }[] = [
    { value: "light", icon: <Sun className="h-3 w-3" />, label: "Light" },
    { value: "dark", icon: <Moon className="h-3 w-3" />, label: "Dark" },
    { value: "system", icon: <Monitor className="h-3 w-3" />, label: "System" },
  ]

  return (
    <div className="space-y-1">
      <span className="eyebrow">Theme</span>
      <div
        role="radiogroup"
        className="grid grid-cols-3 gap-0.5 rounded-full border border-border bg-background/60 p-0.5 text-[11px]"
      >
        {options.map((opt) => {
          const active = current === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={opt.label}
              onClick={() => setTheme(opt.value)}
              className={`inline-flex items-center justify-center gap-1 rounded-full px-2 py-1 transition ${
                active
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.icon}
              <span className="hidden sm:inline">{opt.label}</span>
            </button>
          )
        })}
      </div>
      {mounted && resolvedTheme && current === "system" ? (
        <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-muted-foreground">
          using {resolvedTheme}
        </span>
      ) : null}
    </div>
  )
}

function SidebarLink({
  href,
  icon,
  label,
  external,
}: {
  href: string
  icon: React.ReactNode
  label: string
  external?: boolean
}) {
  return (
    <Link
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] text-muted-foreground transition hover:bg-background/50 hover:text-foreground"
    >
      <span>{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {external ? <ExternalLink className="h-3 w-3 opacity-60" /> : null}
    </Link>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="max-w-lg text-center">
        <span className="eyebrow">Empty workspace</span>
        <h2 className="mt-3 font-display text-[40px] italic leading-tight text-foreground sm:text-[48px]">
          Create your first widget.
        </h2>
        <p className="mx-auto mt-3 max-w-md text-[13px] leading-relaxed text-muted-foreground">
          A starter widget ships with a rating + comment question.
          Customize anything, drop one line into your app, watch responses roll in.
        </p>
        <Button
          onClick={onCreate}
          className="mt-6 h-10 gap-1.5 rounded-full bg-foreground px-5 text-[13px] font-semibold text-background hover:bg-foreground/90"
        >
          <Wand2 className="h-3.5 w-3.5" />
          New widget
        </Button>
      </div>
    </div>
  )
}

function WidgetWorkspace({
  origin,
  widget,
  onChange,
  onDelete,
  onReload,
}: {
  origin: string
  widget: WidgetSummary
  onChange: (next: WidgetSummary) => void
  onDelete: (id: string) => void
  onReload: () => void
}) {
  const [tab, setTab] = useState<TabKey>("settings")
  const [name, setName] = useState(widget.name)
  const [triggerLabel, setTriggerLabel] = useState(widget.triggerLabel)
  const [accent, setAccent] = useState(widget.accent)
  const [questions, setQuestions] = useState<FeedbackQuestion[]>(widget.questions)
  const [responses, setResponses] = useState<ResponseRow[]>([])
  const [loadingResponses, setLoadingResponses] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setName(widget.name)
    setTriggerLabel(widget.triggerLabel)
    setAccent(widget.accent)
    setQuestions(widget.questions)
  }, [widget])

  const dirty =
    name !== widget.name ||
    triggerLabel !== widget.triggerLabel ||
    accent !== widget.accent ||
    JSON.stringify(questions) !== JSON.stringify(widget.questions)

  const loadResponses = useCallback(async () => {
    setLoadingResponses(true)
    try {
      const res = await fetch(`/api/feedback/widgets/${widget.id}`, { cache: "no-store" })
      if (!res.ok) throw new Error("Failed to load")
      const data = (await res.json()) as { responses?: ResponseRow[] }
      setResponses(Array.isArray(data.responses) ? data.responses : [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load responses")
    } finally {
      setLoadingResponses(false)
    }
  }, [widget.id])

  useEffect(() => {
    void loadResponses()
  }, [loadResponses])

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/feedback/widgets/${widget.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, triggerLabel, accent, questions }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { message?: string } | null
        throw new Error(data?.message ?? "Failed to save")
      }
      const updated = (await res.json()) as WidgetSummary
      onChange({ ...widget, ...updated })
      toast.success("Saved")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Workspace header */}
      <header className="flex flex-col gap-3 border-b border-border bg-background/80 px-5 py-4 backdrop-blur sm:px-8 sm:py-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <span className="eyebrow inline-flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: widget.accent }}
                aria-hidden
              />
              {widget.responseCount} {widget.responseCount === 1 ? "response" : "responses"} ·{" "}
              {formatRelative(widget.lastResponseAt)}
            </span>
            <h1 className="truncate font-display text-[32px] italic leading-tight text-foreground sm:text-[40px]">
              {name || "Untitled widget"}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-[12px]"
              onClick={() => onDelete(widget.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
            <Button
              size="sm"
              disabled={saving || !dirty}
              onClick={save}
              className="h-9 gap-1.5 rounded-full bg-foreground px-4 text-[12px] font-semibold text-background hover:bg-foreground/90 disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              {dirty ? "Save changes" : "Saved"}
            </Button>
          </div>
        </div>

        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "settings", label: "Settings" },
            { id: "questions", label: `Questions · ${questions.length}` },
            { id: "embed", label: "Embed" },
            { id: "responses", label: `Responses · ${responses.length}` },
          ]}
        />
      </header>

      {/* Tab content */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8 sm:py-8">
        {tab === "settings" ? (
          <SettingsPanel
            name={name}
            setName={setName}
            triggerLabel={triggerLabel}
            setTriggerLabel={setTriggerLabel}
            accent={accent}
            setAccent={setAccent}
            widget={widget}
          />
        ) : tab === "questions" ? (
          <QuestionsPanel questions={questions} setQuestions={setQuestions} />
        ) : tab === "embed" ? (
          <EmbedPanel origin={origin} publicKey={widget.publicKey} />
        ) : (
          <ResponsesPanel
            responses={responses}
            questions={widget.questions}
            loading={loadingResponses}
            onRefresh={() => {
              void loadResponses()
              void onReload()
            }}
          />
        )}
      </div>
    </div>
  )
}

function Tabs({
  value,
  onChange,
  tabs,
}: {
  value: TabKey
  onChange: (next: TabKey) => void
  tabs: { id: TabKey; label: string }[]
}) {
  return (
    <div
      role="tablist"
      className="-mb-px flex flex-wrap items-center gap-x-1 gap-y-2 overflow-x-auto"
    >
      {tabs.map((t) => {
        const active = t.id === value
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={`group relative inline-flex items-center gap-2 px-3 py-2 text-[12px] transition ${
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.16em]">{t.label}</span>
            <span
              className={`absolute inset-x-2 -bottom-px h-px transition ${
                active ? "bg-foreground" : "bg-transparent group-hover:bg-foreground/30"
              }`}
              aria-hidden
            />
          </button>
        )
      })}
    </div>
  )
}

function PanelSection({
  title,
  description,
  children,
  action,
}: {
  title: string
  description?: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <section className="grid gap-4 border-b border-border pb-8 last:border-b-0 last:pb-0 sm:grid-cols-[220px_1fr] sm:gap-8 sm:pb-10">
      <div className="space-y-1">
        <span className="eyebrow">{title}</span>
        {description ? (
          <p className="text-[12px] leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
        {action ? <div className="pt-2">{action}</div> : null}
      </div>
      <div className="min-w-0 space-y-3">{children}</div>
    </section>
  )
}

function SettingsPanel({
  name,
  setName,
  triggerLabel,
  setTriggerLabel,
  accent,
  setAccent,
  widget,
}: {
  name: string
  setName: (next: string) => void
  triggerLabel: string
  setTriggerLabel: (next: string) => void
  accent: string
  setAccent: (next: string) => void
  widget: WidgetSummary
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <PanelSection
        title="Identity"
        description="What this collector is for. Only you see the name."
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium text-muted-foreground">Name</span>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            className="h-10 text-[14px]"
          />
        </label>
      </PanelSection>

      <PanelSection
        title="Trigger"
        description="The label on the floating button. End-users see this."
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium text-muted-foreground">Button text</span>
          <Input
            value={triggerLabel}
            onChange={(event) => setTriggerLabel(event.target.value)}
            maxLength={40}
            placeholder="Feedback"
            className="h-10 text-[14px]"
          />
        </label>
      </PanelSection>

      <PanelSection
        title="Accent"
        description="Used for the trigger button, highlights, and stars in the dialog."
      >
        <div className="flex flex-wrap items-center gap-2">
          {accentSwatches.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={color}
              onClick={() => setAccent(color)}
              className={`h-7 w-7 rounded-full border transition ${
                accent === color
                  ? "border-foreground ring-2 ring-foreground/20"
                  : "border-border hover:border-foreground/40"
              }`}
              style={{ background: color }}
            />
          ))}
          <input
            type="color"
            value={accent}
            onChange={(event) => setAccent(event.target.value)}
            className="h-8 w-8 cursor-pointer rounded-md border border-border bg-transparent p-0"
            aria-label="Custom accent"
          />
          <code className="ml-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            {accent}
          </code>
        </div>
        <div className="mt-3 rounded-xl border border-border bg-background p-4">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Preview
          </span>
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium text-white transition hover:opacity-90"
              style={{ background: accent }}
            >
              <span>{triggerLabel || "Feedback"}</span>
            </button>
            <span className="text-[11px] text-muted-foreground">
              ← that&apos;s how the button looks in your app.
            </span>
          </div>
        </div>
      </PanelSection>

      <PanelSection title="Identifier" description="Use this key in your embed snippet.">
        <code className="block overflow-x-auto rounded-md bg-background p-3 font-mono text-[12px] text-foreground">
          {widget.publicKey}
        </code>
        <p className="text-[11px] text-muted-foreground">
          Created {formatRelative(widget.createdAt)} · last updated {formatRelative(widget.updatedAt)}
        </p>
      </PanelSection>
    </div>
  )
}

function QuestionsPanel({
  questions,
  setQuestions,
}: {
  questions: FeedbackQuestion[]
  setQuestions: (next: FeedbackQuestion[]) => void
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <PanelSection
        title="Questions"
        description="Up to 12 questions per widget. Drag-to-reorder via the arrows."
        action={
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-[11px]"
            onClick={() =>
              setQuestions([
                ...questions,
                { id: newId(), type: "short_text", label: "New question", required: false },
              ])
            }
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
        }
      >
        <div className="flex flex-col gap-2">
          {questions.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center text-[12px] text-muted-foreground">
              No questions yet. Add one above to start collecting feedback.
            </p>
          ) : (
            questions.map((q, index) => (
              <QuestionCard
                key={q.id}
                question={q}
                index={index}
                total={questions.length}
                onChange={(next) =>
                  setQuestions(questions.map((x, i) => (i === index ? next : x)))
                }
                onMove={(dir) => {
                  const target = index + dir
                  if (target < 0 || target >= questions.length) return
                  const copy = questions.slice()
                  const [item] = copy.splice(index, 1)
                  copy.splice(target, 0, item)
                  setQuestions(copy)
                }}
                onRemove={() => setQuestions(questions.filter((_, i) => i !== index))}
              />
            ))
          )}
        </div>
      </PanelSection>
    </div>
  )
}

function EmbedPanel({ origin, publicKey }: { origin: string; publicKey: string }) {
  type EmbedKind = "hosted" | "manual" | "custom" | "react"
  const [kind, setKind] = useState<EmbedKind>("hosted")
  const [copied, setCopied] = useState<EmbedKind | null>(null)

  const snippets: Record<EmbedKind, { title: string; description: string; code: string }> = {
    hosted: {
      title: "Hosted script",
      description:
        "Drop into your <head> or just before </body>. Works in any web app. The widget self-injects a floating button bottom-right.",
      code: buildSnippet(origin, publicKey),
    },
    manual: {
      title: "Inline injector",
      description:
        "For Electron / strict CSP. Same hosted script, but added via an inline <script> tag so a single connect-src directive is enough.",
      code: buildManualSnippet(origin, publicKey),
    },
    custom: {
      title: "Custom trigger",
      description:
        "Suppress the floating button. Open the dialog from your own button via [data-marcko-feedback] or window.MarckoFeedback.open().",
      code: buildCustomTriggerSnippet(origin, publicKey),
    },
    react: {
      title: "React component",
      description:
        "Mount once in your layout. Idempotent — re-renders won't inject the script twice.",
      code: buildReactSnippet(origin, publicKey),
    },
  }

  const current = snippets[kind]

  const copy = async () => {
    const ok = await copyTextToClipboard(current.code)
    if (ok) {
      setCopied(kind)
      toast.success("Copied")
      setTimeout(() => setCopied((c) => (c === kind ? null : c)), 1500)
    } else {
      toast.error("Copy failed")
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PanelSection
        title="Embed"
        description="Pick a delivery style. Backend, snippet, and behavior are identical — only the integration shape changes."
      >
        <div className="flex flex-wrap gap-1 rounded-full border border-border bg-background p-1 text-[11px]">
          {(Object.keys(snippets) as EmbedKind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`rounded-full px-3 py-1.5 transition ${
                kind === k
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {snippets[k].title}
            </button>
          ))}
        </div>

        <p className="text-[12px] leading-relaxed text-muted-foreground">{current.description}</p>

        <div className="rounded-xl border border-border bg-background">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              {current.title}
            </span>
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-[11px]" onClick={copy}>
              {copied === kind ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied === kind ? "Copied" : "Copy"}
            </Button>
          </div>
          <pre className="overflow-auto p-3 font-mono text-[12px] leading-relaxed text-foreground">
            <code className="whitespace-pre">{current.code}</code>
          </pre>
        </div>
      </PanelSection>

      <PanelSection
        title="Where it works"
        description="The widget is pure browser JS, no framework lock-in."
      >
        <ul className="grid grid-cols-1 gap-2 text-[12px] sm:grid-cols-2">
          <li className="rounded-lg border border-border bg-background p-3">
            <span className="font-display text-[16px] italic leading-tight">Web apps</span>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              React, Vue, Svelte, plain HTML, WordPress, marketing sites.
            </p>
          </li>
          <li className="rounded-lg border border-border bg-background p-3">
            <span className="font-display text-[16px] italic leading-tight">Electron</span>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Use the inline injector if your CSP blocks remote &lt;script src&gt;.
            </p>
          </li>
          <li className="rounded-lg border border-border bg-background p-3">
            <span className="font-display text-[16px] italic leading-tight">Static sites</span>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Astro, Hugo, Jekyll, Next.js export — anywhere a &lt;script&gt; tag runs.
            </p>
          </li>
          <li className="rounded-lg border border-border bg-background p-3">
            <span className="font-display text-[16px] italic leading-tight">Your own UI</span>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Use the custom trigger to attach the dialog to a help menu or a slash-command.
            </p>
          </li>
        </ul>
      </PanelSection>

      <PanelSection
        title="Programmatic API"
        description="Available on window.MarckoFeedback once the script has loaded."
      >
        <pre className="overflow-auto rounded-xl border border-border bg-background p-3 font-mono text-[12px] leading-relaxed">
          <code className="whitespace-pre">{`MarckoFeedback.init({ key: "${publicKey}" })   // manual init
MarckoFeedback.open()                          // open the dialog
MarckoFeedback.close()                         // close the dialog

window.addEventListener("marcko:submit", (e) => {
  // e.detail.answers, e.detail.key
})`}</code>
        </pre>
      </PanelSection>
    </div>
  )
}

function ResponsesPanel({
  responses,
  questions,
  loading,
  onRefresh,
}: {
  responses: ResponseRow[]
  questions: FeedbackQuestion[]
  loading: boolean
  onRefresh: () => void
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <span className="eyebrow">Responses · {responses.length}</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-[11px]"
          onClick={onRefresh}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RotateCw className="h-3.5 w-3.5" />
          )}
          Refresh
        </Button>
      </div>

      {responses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-10 text-center">
          <Sparkles className="mx-auto h-5 w-5 text-muted-foreground" />
          <p className="mt-3 font-display text-[20px] italic leading-tight text-foreground">
            Quiet so far.
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Once someone submits feedback, it appears here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {responses.map((r) => (
            <ResponseCard key={r.id} response={r} questions={questions} />
          ))}
        </div>
      )}
    </div>
  )
}

function QuestionCard({
  question,
  index,
  total,
  onChange,
  onMove,
  onRemove,
}: {
  question: FeedbackQuestion
  index: number
  total: number
  onChange: (next: FeedbackQuestion) => void
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
}) {
  const update = (patch: Partial<FeedbackQuestion>) => onChange({ ...question, ...patch })

  return (
    <div className="rounded-xl border border-border bg-background p-3 sm:p-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-30"
            aria-label="Move up"
          >
            <ChevronRight className="h-3 w-3 -rotate-90" />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-30"
            aria-label="Move down"
          >
            <ChevronRight className="h-3 w-3 rotate-90" />
          </button>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
            <Input
              value={question.label}
              onChange={(event) => update({ label: event.target.value })}
              placeholder="Question"
              className="h-9 text-[13px]"
            />
            <select
              value={question.type}
              onChange={(event) =>
                update({
                  type: event.target.value as QuestionType,
                  options:
                    event.target.value === "single_choice"
                      ? question.options ?? ["Option 1", "Option 2"]
                      : undefined,
                })
              }
              className="h-9 rounded-md border border-input bg-background px-2 text-[12px]"
            >
              {Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {question.type === "short_text" || question.type === "long_text" ? (
            <Input
              value={question.placeholder ?? ""}
              onChange={(event) => update({ placeholder: event.target.value })}
              placeholder="Placeholder (optional)"
              className="h-9 text-[12px]"
            />
          ) : null}

          {question.type === "single_choice" ? (
            <ChoiceOptions
              options={question.options ?? []}
              onChange={(opts) => update({ options: opts })}
            />
          ) : null}

          <label className="inline-flex items-center gap-2 text-[12px] text-muted-foreground">
            <input
              type="checkbox"
              checked={!!question.required}
              onChange={(event) => update({ required: event.target.checked })}
              className="accent-foreground"
            />
            Required
          </label>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-md p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
          aria-label="Remove question"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

function ChoiceOptions({
  options,
  onChange,
}: {
  options: string[]
  onChange: (next: string[]) => void
}) {
  return (
    <div className="space-y-1.5">
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={opt}
            onChange={(event) => {
              const next = options.slice()
              next[i] = event.target.value
              onChange(next)
            }}
            placeholder={`Option ${i + 1}`}
            className="h-8 text-[12px]"
            maxLength={60}
          />
          <button
            type="button"
            onClick={() => onChange(options.filter((_, idx) => idx !== i))}
            disabled={options.length <= 1}
            className="rounded-md p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
            aria-label="Remove option"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
      {options.length < 8 ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1 text-[11px]"
          onClick={() => onChange([...options, `Option ${options.length + 1}`])}
        >
          <Plus className="h-3 w-3" />
          Add option
        </Button>
      ) : null}
    </div>
  )
}

function ResponseCard({
  response,
  questions,
}: {
  response: ResponseRow
  questions: FeedbackQuestion[]
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="space-y-3">
        {questions.map((q) => {
          const value = response.answers[q.id]
          if (value === undefined || value === null || value === "") return null
          return (
            <div key={q.id} className="flex flex-col gap-0.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                {q.label}
              </span>
              <span className="text-[13px] leading-relaxed text-foreground">
                {q.type === "rating" ? (
                  <span className="inline-flex items-center gap-0.5 font-mono">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span
                        key={i}
                        className={i < Number(value) ? "text-foreground" : "text-muted-foreground/30"}
                      >
                        ★
                      </span>
                    ))}
                    <span className="ml-1 text-muted-foreground">{String(value)}/5</span>
                  </span>
                ) : (
                  String(value)
                )}
              </span>
            </div>
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-0.5 border-t border-border pt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        <span>{formatRelative(response.submittedAt)}</span>
        {response.pageUrl ? <span className="truncate">· {response.pageUrl}</span> : null}
      </div>
    </div>
  )
}
