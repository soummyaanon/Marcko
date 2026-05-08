"use client"

import * as React from "react"
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
  Workflow,
  Globe,
  Image as ImageIcon,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Pencil,
} from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type DockAction = {
  id: string
  label: string
  shortcut?: string
  icon: React.ComponentType<{ className?: string }>
  onClick: () => void
  emphasis?: boolean
}

interface FloatingActionDockProps {
  onBold: () => void
  onItalic: () => void
  onStrike: () => void
  onHeading: () => void
  onBulletList: () => void
  onOrderedList: () => void
  onQuote: () => void
  onInlineCode: () => void
  onLink: () => void
  onMermaid: () => void
  onLiveBlock: () => void
  onUploadImage: () => void
}

const COLLAPSE_KEY = "marcko-dock-collapsed"

export function FloatingActionDock({
  onBold,
  onItalic,
  onStrike,
  onHeading,
  onBulletList,
  onOrderedList,
  onQuote,
  onInlineCode,
  onLink,
  onMermaid,
  onLiveBlock,
  onUploadImage,
}: FloatingActionDockProps) {
  const [collapsed, setCollapsed] = React.useState(false)

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(COLLAPSE_KEY)
      if (stored === "1") setCollapsed(true)
    } catch {
      /* ignore */
    }
  }, [])

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0")
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const formatting: DockAction[] = [
    { id: "bold", label: "Bold", shortcut: "⌘B", icon: Bold, onClick: onBold },
    { id: "italic", label: "Italic", shortcut: "⌘I", icon: Italic, onClick: onItalic },
    { id: "strike", label: "Strike", shortcut: "⇧⌘S", icon: Strikethrough, onClick: onStrike },
  ]

  const blocks: DockAction[] = [
    { id: "heading", label: "Heading", icon: Heading1, onClick: onHeading },
    { id: "ul", label: "Bulleted list", icon: List, onClick: onBulletList },
    { id: "ol", label: "Numbered list", icon: ListOrdered, onClick: onOrderedList },
    { id: "quote", label: "Quote", icon: Quote, onClick: onQuote },
  ]

  const inserts: DockAction[] = [
    { id: "code", label: "Inline code", shortcut: "⇧⌘C", icon: Code, onClick: onInlineCode },
    { id: "link", label: "Link", shortcut: "⌘K", icon: LinkIcon, onClick: onLink },
    { id: "mermaid", label: "Mermaid diagram", shortcut: "⇧⌘M", icon: Workflow, onClick: onMermaid },
    { id: "image", label: "Insert image", icon: ImageIcon, onClick: onUploadImage },
  ]

  const Group = ({ items }: { items: DockAction[] }) => (
    <div className="flex items-center gap-0.5">
      {items.map((a) => (
        <Tooltip key={a.id}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={a.onClick}
              aria-label={a.label}
              className="group relative flex h-9 w-9 items-center justify-center rounded-full text-foreground/70 transition-all hover:bg-foreground/[0.06] hover:text-foreground active:scale-[0.94]"
            >
              <a.icon className="h-[15px] w-[15px]" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="font-mono text-[10px] tracking-wide">
            <span>{a.label}</span>
            {a.shortcut ? (
              <span className="ml-2 opacity-60">{a.shortcut}</span>
            ) : null}
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  )

  if (collapsed) {
    return (
      <div className="pointer-events-none absolute inset-x-0 bottom-4 z-30 flex justify-center px-4">
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={toggleCollapsed}
                aria-label="Show editorial dock"
                className="pointer-events-auto dock-enter glass-surface group flex h-10 items-center gap-2 rounded-full px-3.5 text-[11px] font-medium tracking-wide text-foreground/80 transition-all hover:text-foreground"
              >
                <Pencil className="h-3.5 w-3.5 text-primary" />
                <span className="font-mono uppercase tracking-[0.18em] text-[10px]">
                  Compose
                </span>
                <ChevronUp className="h-3.5 w-3.5 opacity-70 transition-transform group-hover:-translate-y-0.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="font-mono text-[10px] tracking-wide">
              Reopen the editorial dock
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    )
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-30 flex justify-center px-4">
      <TooltipProvider delayDuration={150}>
        <div
          className="pointer-events-auto dock-enter glass-surface flex items-center gap-1 rounded-full px-2 py-1.5"
          role="toolbar"
          aria-label="Editorial actions"
        >
          {/* Eyebrow brand chip */}
          <div className="hidden md:flex items-center gap-1.5 pr-2 pl-2 border-r border-border/60">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-60 dot-pulse" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
            </span>
            <span className="eyebrow">Compose</span>
          </div>

          <Group items={formatting} />
          <span className="mx-0.5 h-5 w-px bg-border/70" />
          <Group items={blocks} />
          <span className="mx-0.5 h-5 w-px bg-border/70" />
          <Group items={inserts} />

          {/* Featured Live HTML/CSS/JS button */}
          <span className="mx-1 h-5 w-px bg-border/70" />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onLiveBlock}
                aria-label="Insert Live HTML / CSS / JS"
                className="group relative flex h-9 items-center gap-1.5 rounded-full bg-primary px-3 text-[11px] font-semibold tracking-wide text-primary-foreground shadow-[0_4px_16px_-6px_color-mix(in_oklab,var(--primary)_60%,transparent)] transition-all hover:brightness-110 active:scale-[0.97]"
              >
                <Globe className="h-[14px] w-[14px]" />
                <span className="hidden sm:inline">Live</span>
                <Sparkles className="h-3 w-3 opacity-80" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="font-mono text-[10px] tracking-wide">
              Insert HTML · CSS · JS sandbox
            </TooltipContent>
          </Tooltip>

          {/* Collapse handle */}
          <span className="mx-1 h-5 w-px bg-border/70" />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={toggleCollapsed}
                aria-label="Hide dock"
                className="group flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
              >
                <ChevronDown className="h-4 w-4 transition-transform group-hover:translate-y-0.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="font-mono text-[10px] tracking-wide">
              Hide dock
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>
  )
}
