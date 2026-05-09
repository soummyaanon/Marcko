"use client";

import { useEffect, useState } from "react";
import {
  Share2,
  Link as LinkIcon,
  Check,
  Loader2,
  GitBranch,
  Globe,
  Lock,
  Pencil,
  Share,
  Copy,
  ShieldCheck,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { copyTextToClipboard } from "@/lib/clipboard";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { toast } from "sonner";

interface MarckoTopbarProps {
  onShare: (visibility: "public" | "private") => Promise<string>;
  onShareAuthRequired: () => void;
  onUpdateShare?: (docId: string, content: string) => Promise<string>;
  onLoadVersion?: (docId: string, version: number) => Promise<void>;
  editingDocumentId?: string | null;
  editorContent?: string;
  shareTriggerToken?: number;
  shareWarning?: string | null;
  documentTitle?: string | null;
  isAuthenticated: boolean;
}

const isAuthRequiredError = (error: unknown): boolean => {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: string }).code === "AUTH_REQUIRED"
  );
};

const formatHistoryDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
};

export function MarckoTopbar({
  onShare,
  onShareAuthRequired,
  onUpdateShare,
  onLoadVersion,
  editingDocumentId,
  editorContent = "",
  shareTriggerToken = 0,
  shareWarning,
  documentTitle,
  isAuthenticated,
}: MarckoTopbarProps) {
  const [isSharing, setIsSharing] = useState(false);
  const [showVisibilityPicker, setShowVisibilityPicker] = useState(false);
  const [pendingVisibility, setPendingVisibility] = useState<
    "public" | "private"
  >("public");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [copied, setCopied] = useState(false);
  const [versions, setVersions] = useState<
    { version: number; createdAt: string }[]
  >([]);
  const [activeVersion, setActiveVersion] = useState<number | null>(null);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [isSwitchingVersion, setIsSwitchingVersion] = useState<number | null>(
    null,
  );

  useEffect(() => {
    if (!editingDocumentId) {
      setVersions([]);
      setActiveVersion(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setIsLoadingVersions(true);
      try {
        const response = await fetch(
          `/api/share/versions?id=${encodeURIComponent(editingDocumentId)}`,
          { cache: "no-store" },
        );
        if (!response.ok || cancelled) return;
        const data = (await response.json()) as {
          versions?: { version: number; createdAt: string }[];
          latest?: number | null;
        };
        if (cancelled) return;
        const list = Array.isArray(data.versions) ? data.versions : [];
        setVersions(list);
        setActiveVersion(
          typeof data.latest === "number"
            ? data.latest
            : list.length > 0
              ? list[list.length - 1].version
              : null,
        );
      } finally {
        if (!cancelled) setIsLoadingVersions(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [editingDocumentId]);

  const handleSelectVersion = async (version: number) => {
    if (!editingDocumentId || !onLoadVersion) return;
    if (version === activeVersion) return;
    setIsSwitchingVersion(version);
    try {
      await onLoadVersion(editingDocumentId, version);
      setActiveVersion(version);
    } catch {
      toast.error("Unable to load that version.");
    } finally {
      setIsSwitchingVersion(null);
    }
  };

  const refreshVersions = async (docId: string) => {
    try {
      const response = await fetch(
        `/api/share/versions?id=${encodeURIComponent(docId)}`,
        { cache: "no-store" },
      );
      if (!response.ok) return;
      const data = (await response.json()) as {
        versions?: { version: number; createdAt: string }[];
        latest?: number | null;
      };
      const list = Array.isArray(data.versions) ? data.versions : [];
      setVersions(list);
      setActiveVersion(
        typeof data.latest === "number"
          ? data.latest
          : list.length > 0
            ? list[list.length - 1].version
            : null,
      );
    } catch {
      // ignore
    }
  };

  const handleShare = async () => {
    setIsSharing(true);
    try {
      const url = await onShare(pendingVisibility);
      setShareUrl(url);
      setShowVisibilityPicker(false);
      const ok = await copyTextToClipboard(url);
      if (ok) {
        setCopied(true);
        toast.success("Link copied to clipboard");
        setTimeout(() => setCopied(false), 1800);
      }
      setShowDialog(true);
    } catch (error) {
      if (isAuthRequiredError(error)) {
        onShareAuthRequired();
        return;
      }
      console.error("Failed to share:", error);
      toast.error("Couldn't share document");
    } finally {
      setIsSharing(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingDocumentId || !onUpdateShare) return;
    setIsSharing(true);
    try {
      const url = await onUpdateShare(editingDocumentId, editorContent);
      setShareUrl(url);
      void refreshVersions(editingDocumentId);
      const ok = await copyTextToClipboard(url);
      if (ok) {
        setCopied(true);
        toast.success("Updated link copied");
        setTimeout(() => setCopied(false), 1800);
      }
      setShowDialog(true);
    } catch {
      toast.error("Couldn't update document");
    } finally {
      setIsSharing(false);
    }
  };

  useEffect(() => {
    if (shareTriggerToken > 0) {
      void handleShare();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareTriggerToken]);

  const openSharePicker = () => {
    if (!isAuthenticated) {
      onShareAuthRequired();
      return;
    }
    setPendingVisibility("public");
    setShowVisibilityPicker(true);
  };

  const copyShareLink = async () => {
    if (!shareUrl) return;
    const ok = await copyTextToClipboard(shareUrl);
    if (ok) {
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 1800);
    }
  };

  const shareToApps = async () => {
    if (!shareUrl) return;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "Shared document",
          text: "Check this out",
          url: shareUrl,
        });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    }
    void copyShareLink();
  };

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-1.5 bg-background/85 px-3 backdrop-blur md:px-5">
        <SidebarTrigger className="size-8 text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground md:hidden" />

        <div className="flex min-w-0 flex-1 items-center">
          <div className="flex min-w-0 items-center gap-2">
            <span className="relative inline-flex h-1.5 w-1.5 shrink-0">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500/50 dot-pulse" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            <h2 className="truncate font-display text-[18px] italic leading-none text-foreground">
              {documentTitle?.trim() || (editingDocumentId ? "Untitled" : "Draft")}
            </h2>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <span
            className="hidden items-center gap-1 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground/70 lg:inline-flex"
            aria-hidden
          >
            <ShieldCheck className="size-3" />
            E2E
          </span>

          {editingDocumentId && versions.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isLoadingVersions}
                  className="h-8 gap-1.5 rounded-md px-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground"
                >
                  <GitBranch className="size-3.5" />
                  <span className="hidden sm:inline">
                    {isLoadingVersions
                      ? "…"
                      : activeVersion === null
                        ? "Versions"
                        : `v${activeVersion}`}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Versions
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {[...versions].reverse().map((entry) => {
                  const isLatest =
                    entry.version === versions[versions.length - 1].version;
                  const isActive = entry.version === activeVersion;
                  return (
                    <DropdownMenuItem
                      key={entry.version}
                      onClick={() => void handleSelectVersion(entry.version)}
                      disabled={isSwitchingVersion !== null}
                      className="flex items-center justify-between gap-2"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          v{entry.version}
                          {entry.version === 0 ? " (original)" : ""}
                          {isLatest ? " · latest" : ""}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatHistoryDate(entry.createdAt)}
                        </span>
                      </div>
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

          <Button
            onClick={
              editingDocumentId && onUpdateShare
                ? () => void handleUpdate()
                : openSharePicker
            }
            disabled={
              isSharing ||
              Boolean(editingDocumentId && !editorContent?.trim())
            }
            className="h-8 gap-1.5 rounded-md bg-foreground px-3 text-[11px] font-medium tracking-wide text-background hover:bg-foreground/90"
            size="sm"
          >
            {isSharing ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span className="hidden sm:inline">
                  {editingDocumentId ? "Updating" : "Sharing"}
                </span>
              </>
            ) : editingDocumentId && onUpdateShare ? (
              <>
                <Pencil className="size-3.5" />
                <span className="hidden sm:inline">Update</span>
              </>
            ) : (
              <>
                <Share2 className="size-3.5" />
                <span className="hidden sm:inline">Share</span>
              </>
            )}
          </Button>
        </div>
      </header>

      {shareWarning ? (
        <div className="border-b border-amber-500/30 bg-amber-100/80 px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-amber-900 md:px-5 dark:bg-amber-900/25 dark:text-amber-100">
          {shareWarning}
        </div>
      ) : null}

      <Dialog
        open={showVisibilityPicker}
        onOpenChange={setShowVisibilityPicker}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl italic font-normal">
              Share this document
            </DialogTitle>
            <DialogDescription className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80">
              Choose who can view it.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => setPendingVisibility("public")}
              className={cn(
                "group flex items-center gap-3 rounded-md border p-3 text-left transition-colors",
                pendingVisibility === "public"
                  ? "border-foreground bg-foreground/[0.04]"
                  : "border-border/70 hover:bg-foreground/[0.02]",
              )}
            >
              <Globe className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div>
                <p className="text-sm font-medium">Public</p>
                <p className="text-xs text-muted-foreground">
                  Anyone with the link can view.
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setPendingVisibility("private")}
              className={cn(
                "group flex items-center gap-3 rounded-md border p-3 text-left transition-colors",
                pendingVisibility === "private"
                  ? "border-foreground bg-foreground/[0.04]"
                  : "border-border/70 hover:bg-foreground/[0.02]",
              )}
            >
              <Lock className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="text-sm font-medium">Private</p>
                <p className="text-xs text-muted-foreground">
                  Only signed-in users can view.
                </p>
              </div>
            </button>
          </div>
          <Button
            onClick={handleShare}
            disabled={isSharing}
            className="w-full gap-2"
          >
            {isSharing ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Generating
              </>
            ) : (
              <>
                <Share2 className="size-4" />
                Generate link
              </>
            )}
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl italic font-normal">
              {editingDocumentId ? "Document updated" : "Link ready"}
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed text-muted-foreground">
              {editingDocumentId
                ? "Your changes are saved. The same link now serves the latest content."
                : "Anyone with this link can view your document. Encrypted at rest."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <LinkIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                readOnly
                value={shareUrl || ""}
                className="pl-9 font-mono text-xs"
              />
            </div>
            <Button
              onClick={copyShareLink}
              size="sm"
              variant="outline"
              className="shrink-0 gap-1.5"
            >
              {copied ? (
                <>
                  <Check className="size-4" /> Copied
                </>
              ) : (
                <>
                  <Copy className="size-4" /> Copy
                </>
              )}
            </Button>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full gap-1.5"
            onClick={() => void shareToApps()}
            disabled={!shareUrl}
          >
            <Share className="size-4" />
            Share via apps
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
