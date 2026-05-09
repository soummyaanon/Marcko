"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Bot,
  Check,
  Copy,
  GitBranch,
  GripVertical,
  Link as LinkIcon,
  Loader2,
  Monitor,
  Moon,
  Pencil,
  Sun,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { OpenAI } from "@/components/logo/openai";
import { ClaudeAI } from "@/components/logo/claude";
import { PerplexityAI } from "@/components/logo/perplexity";

type Theme = "light" | "dark" | "system";

type Position = { x: number; y: number };

type VersionEntry = { version: number; createdAt: string };

interface FloatingReaderDockProps {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;

  hasShareLink: boolean;
  onCopyLink: () => void;
  copiedLink: boolean;

  onCopyContent: () => void;
  copiedContent: boolean;

  onOpenInApp?: (provider: "chatgpt" | "claude" | "perplexity") => void;

  versions?: VersionEntry[];
  activeVersion?: number | null;
  latestVersion?: number | null;
  isSwitchingVersion?: number | null;
  onSelectVersion?: (version: number) => void;

  primaryAction:
    | { kind: "back-to-editor"; onClick: () => void }
    | { kind: "edit-owned"; href: string }
    | { kind: "new-document"; href: string };
}

const STORAGE_KEY = "marcko-reader-dock-position";
const MARGIN = 16;

function clampToViewport(pos: Position, dockSize: { w: number; h: number }) {
  if (typeof window === "undefined") return pos;
  const maxX = window.innerWidth - dockSize.w - MARGIN;
  const maxY = window.innerHeight - dockSize.h - MARGIN;
  return {
    x: Math.min(Math.max(pos.x, MARGIN), Math.max(MARGIN, maxX)),
    y: Math.min(Math.max(pos.y, MARGIN), Math.max(MARGIN, maxY)),
  };
}

export function FloatingReaderDock({
  theme,
  onThemeChange,
  hasShareLink,
  onCopyLink,
  copiedLink,
  onCopyContent,
  copiedContent,
  onOpenInApp,
  versions = [],
  activeVersion = null,
  latestVersion = null,
  isSwitchingVersion = null,
  onSelectVersion,
  primaryAction,
}: FloatingReaderDockProps) {
  const dockRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef<{ dx: number; dy: number } | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Initial position from storage or default to bottom-right
  useEffect(() => {
    setMounted(true);
    let saved: Position | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Position;
        if (
          typeof parsed.x === "number" &&
          typeof parsed.y === "number" &&
          Number.isFinite(parsed.x) &&
          Number.isFinite(parsed.y)
        ) {
          saved = parsed;
        }
      }
    } catch {
      // ignore
    }

    if (saved) {
      setPosition(saved);
    } else {
      // default: bottom-right with margin
      const w = dockRef.current?.offsetWidth ?? 360;
      const h = dockRef.current?.offsetHeight ?? 44;
      setPosition({
        x: window.innerWidth - w - MARGIN,
        y: window.innerHeight - h - MARGIN,
      });
    }
  }, []);

  // Re-clamp on viewport resize
  useEffect(() => {
    const handle = () => {
      setPosition((prev) => {
        if (!prev || !dockRef.current) return prev;
        return clampToViewport(prev, {
          w: dockRef.current.offsetWidth,
          h: dockRef.current.offsetHeight,
        });
      });
    };
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);

  const persist = useCallback((pos: Position) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
    } catch {
      // ignore
    }
  }, []);

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!dockRef.current) return;
    const rect = dockRef.current.getBoundingClientRect();
    dragOffsetRef.current = {
      dx: event.clientX - rect.left,
      dy: event.clientY - rect.top,
    };
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDragging || !dragOffsetRef.current || !dockRef.current) return;
    const next = clampToViewport(
      {
        x: event.clientX - dragOffsetRef.current.dx,
        y: event.clientY - dragOffsetRef.current.dy,
      },
      {
        w: dockRef.current.offsetWidth,
        h: dockRef.current.offsetHeight,
      },
    );
    setPosition(next);
  };

  const onPointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    dragOffsetRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (position) persist(position);
  };

  const ThemeIcon =
    theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;

  return (
    <TooltipProvider delayDuration={200}>
      <div
        ref={dockRef}
        className={cn(
          "fixed z-40 select-none",
          mounted ? "opacity-100" : "opacity-0",
          "transition-opacity duration-200",
        )}
        style={{
          left: position?.x ?? 0,
          top: position?.y ?? 0,
          touchAction: "none",
        }}
      >
        <div
          className={cn(
            "flex items-center gap-0.5 rounded-full border border-border/50 bg-background/85 p-1 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.18)] backdrop-blur-xl",
            isDragging && "cursor-grabbing shadow-[0_12px_40px_-10px_rgba(0,0,0,0.3)]",
          )}
        >
          <button
            type="button"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className={cn(
              "inline-flex size-8 cursor-grab items-center justify-center rounded-full text-muted-foreground/50 hover:bg-foreground/[0.04] hover:text-foreground/80",
              isDragging && "cursor-grabbing text-foreground",
            )}
            aria-label="Drag dock"
          >
            <GripVertical className="size-3.5" />
          </button>

          <span className="mx-0.5 h-5 w-px bg-border/40" aria-hidden />

          {hasShareLink && onOpenInApp ? (
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 rounded-full text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground"
                    >
                      <Bot className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-[10px] uppercase tracking-[0.16em]">
                  Open with AI
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="center" side="top">
                <DropdownMenuItem onClick={() => onOpenInApp("chatgpt")}>
                  <OpenAI className="mr-2 size-4" />
                  ChatGPT
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onOpenInApp("claude")}>
                  <ClaudeAI className="mr-2 size-4" />
                  Claude
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onOpenInApp("perplexity")}>
                  <PerplexityAI className="mr-2 size-4" />
                  Perplexity
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}

          {hasShareLink ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onCopyLink}
                  className="size-8 rounded-full text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground"
                >
                  {copiedLink ? (
                    <Check className="size-4" />
                  ) : (
                    <LinkIcon className="size-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[10px] uppercase tracking-[0.16em]">
                {copiedLink ? "Copied" : "Copy link"}
              </TooltipContent>
            </Tooltip>
          ) : null}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onCopyContent}
                className="size-8 rounded-full text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground"
              >
                {copiedContent ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px] uppercase tracking-[0.16em]">
              {copiedContent ? "Copied" : "Copy markdown"}
            </TooltipContent>
          </Tooltip>

          {versions.length > 1 && onSelectVersion ? (
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 rounded-full text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground"
                    >
                      <GitBranch className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-[10px] uppercase tracking-[0.16em]">
                  {activeVersion === null ? "Versions" : `v${activeVersion}`}
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="center" side="top" className="w-56">
                <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Versions
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {[...versions].reverse().map((entry) => {
                  const isLatest = entry.version === latestVersion;
                  const isActive = entry.version === activeVersion;
                  return (
                    <DropdownMenuItem
                      key={entry.version}
                      onClick={() => onSelectVersion(entry.version)}
                      disabled={isSwitchingVersion !== null}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="text-sm">
                        v{entry.version}
                        {entry.version === 0 ? " (original)" : ""}
                        {isLatest ? " · latest" : ""}
                      </span>
                      {isSwitchingVersion === entry.version ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : isActive ? (
                        <Check className="size-3.5" />
                      ) : null}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}

          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-full text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground"
                  >
                    <ThemeIcon className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[10px] uppercase tracking-[0.16em]">
                Theme
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="center" side="top">
              <DropdownMenuItem onClick={() => onThemeChange("light")}>
                <Sun className="mr-2 size-4" /> Light
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onThemeChange("dark")}>
                <Moon className="mr-2 size-4" /> Dark
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onThemeChange("system")}>
                <Monitor className="mr-2 size-4" /> System
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <span className="mx-0.5 h-5 w-px bg-border/40" aria-hidden />

          {primaryAction.kind === "back-to-editor" ? (
            <Button
              size="sm"
              onClick={primaryAction.onClick}
              className="h-8 gap-1.5 rounded-full bg-foreground px-3 text-[11px] font-medium text-background hover:bg-foreground/90"
            >
              <ArrowLeft className="size-3.5" />
              <span>Back</span>
            </Button>
          ) : primaryAction.kind === "edit-owned" ? (
            <Button
              asChild
              size="sm"
              className="h-8 gap-1.5 rounded-full bg-foreground px-3 text-[11px] font-medium text-background hover:bg-foreground/90"
            >
              <a href={primaryAction.href}>
                <Pencil className="size-3.5" />
                <span>Edit</span>
              </a>
            </Button>
          ) : (
            <Button
              asChild
              size="sm"
              className="h-8 gap-1.5 rounded-full bg-foreground px-3 text-[11px] font-medium text-background hover:bg-foreground/90"
            >
              <a href={primaryAction.href}>
                <Pencil className="size-3.5" />
                <span>New</span>
              </a>
            </Button>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
