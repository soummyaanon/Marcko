"use client";

import { useEffect, useState } from "react";
import {
  Share2,
  Link,
  Check,
  Loader2,
  FileText,
  Moon,
  Sun,
  Monitor,
  LogOut,
  Trash2,
  History,
  GitBranch,
  ExternalLink,
  ShieldCheck,
  Globe,
  Lock,
  Pencil,
  Share,
  Copy,
  Key,
} from "lucide-react";
import { ApiKeysDialog } from "@/components/api-keys-dialog";
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
import { toast } from "sonner";
import { copyTextToClipboard } from "@/lib/clipboard";

interface EditorToolbarProps {
  onShare: (visibility: "public" | "private") => Promise<string>;
  onShareAuthRequired: () => void;
  onUpdateShare?: (docId: string, content: string) => Promise<string>;
  onEditDocument?: (docId: string) => void;
  onLoadVersion?: (docId: string, version: number) => Promise<void>;
  editingDocumentId?: string | null;
  editorContent?: string;
  theme: "light" | "dark" | "system";
  onThemeChange: (theme: "light" | "dark" | "system") => void;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  onSignIn: () => void;
  onSignOut: () => Promise<void>;
  onDeleteAccount: () => Promise<void>;
  userName?: string | null;
  userEmail?: string | null;
  userImage?: string | null;
  shareTriggerToken?: number;
  shareWarning?: string | null;
}

type ShareHistoryItem = {
  id: string;
  preview: string;
  createdAt: string;
  updatedAt: string;
  shareUrl: string;
  visibility: "public" | "private";
};

type ShareHistoryResponse = {
  items?: ShareHistoryItem[];
};

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
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleString();
};

export function EditorToolbar({
  onShare,
  onShareAuthRequired,
  onUpdateShare,
  onEditDocument,
  onLoadVersion,
  editingDocumentId,
  editorContent = "",
  theme,
  onThemeChange,
  isAuthenticated,
  isAuthLoading,
  onSignIn,
  onSignOut,
  onDeleteAccount,
  userName = null,
  userEmail = null,
  userImage = null,
  shareTriggerToken = 0,
  shareWarning = null,
}: EditorToolbarProps) {
  const [isSharing, setIsSharing] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [historyItems, setHistoryItems] = useState<ShareHistoryItem[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [copiedHistoryId, setCopiedHistoryId] = useState<string | null>(null);
  const [revokingHistoryId, setRevokingHistoryId] = useState<string | null>(
    null,
  );
  const [showVisibilityPicker, setShowVisibilityPicker] = useState(false);
  const [pendingVisibility, setPendingVisibility] = useState<
    "public" | "private"
  >("public");
  const [togglingVisibilityId, setTogglingVisibilityId] = useState<
    string | null
  >(null);
  const [versions, setVersions] = useState<
    { version: number; createdAt: string }[]
  >([]);
  const [activeVersion, setActiveVersion] = useState<number | null>(null);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [isSwitchingVersion, setIsSwitchingVersion] = useState<number | null>(
    null,
  );
  const [showApiKeysDialog, setShowApiKeysDialog] = useState(false);

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
      } catch (error) {
        if (!cancelled) console.error("Failed to load versions:", error);
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
    } catch (error) {
      console.error("Failed to load version:", error);
      toast.error("Unable to load that version.");
    } finally {
      setIsSwitchingVersion(null);
    }
  };

  const handleShare = async () => {
    setIsSharing(true);
    try {
      const url = await onShare(pendingVisibility);
      setShareUrl(url);
      setShowVisibilityPicker(false);

      // Copy before opening the dialog — Radix focus scope makes the document unfocused,
      // which causes navigator.clipboard.writeText to throw NotAllowedError.
      const copiedOk = await copyTextToClipboard(url);
      if (copiedOk) {
        setCopied(true);
        toast.success("Link copied to clipboard");
        setTimeout(() => setCopied(false), 2000);
      } else {
        toast.message("Link ready", {
          description: "Use the Copy button below to copy the URL.",
        });
      }

      setShowDialog(true);
    } catch (error) {
      if (isAuthRequiredError(error)) {
        onShareAuthRequired();
        return;
      }
      console.error("Failed to share:", error);
    } finally {
      setIsSharing(false);
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
    } catch (error) {
      console.error("Failed to refresh versions:", error);
    }
  };

  const handleUpdate = async () => {
    if (!editingDocumentId || !onUpdateShare) return;
    setIsSharing(true);
    try {
      const url = await onUpdateShare(editingDocumentId, editorContent);
      setShareUrl(url);
      void refreshVersions(editingDocumentId);

      const copiedOk = await copyTextToClipboard(url);
      if (copiedOk) {
        setCopied(true);
        toast.success("Updated link copied to clipboard");
        setTimeout(() => setCopied(false), 2000);
      } else {
        toast.message("Link updated", {
          description: "Use the Copy button below to copy the URL.",
        });
      }

      setShowDialog(true);
    } catch (error) {
      console.error("Failed to update document:", error);
    } finally {
      setIsSharing(false);
    }
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await onSignOut();
    } catch (error) {
      console.error("Failed to sign out:", error);
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (
      !window.confirm("Delete your account permanently? This cannot be undone.")
    ) {
      return;
    }

    setIsDeletingAccount(true);
    try {
      await onDeleteAccount();
    } catch (error) {
      console.error("Failed to delete account:", error);
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const avatarText = (() => {
    const source = (userName || userEmail || "U").trim();
    if (!source) return "U";
    return source.slice(0, 2).toUpperCase();
  })();

  useEffect(() => {
    if (shareTriggerToken > 0) {
      // Auto-triggered share (post-OAuth redirect) — skip picker, use pending visibility
      void handleShare();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareTriggerToken]);

  const openSharePicker = () => {
    setPendingVisibility("public");
    setShowVisibilityPicker(true);
  };

  const toggleVisibility = async (
    id: string,
    current: "public" | "private",
  ) => {
    const next = current === "public" ? "private" : "public";
    setTogglingVisibilityId(id);
    try {
      const response = await fetch("/api/share", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, visibility: next }),
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(errorData?.message || "Failed to update visibility");
      }

      setHistoryItems((previous) =>
        previous.map((item) =>
          item.id === id ? { ...item, visibility: next } : item,
        ),
      );
    } catch (error) {
      console.error("Failed to toggle visibility:", error);
      setHistoryError("Unable to update visibility right now.");
    } finally {
      setTogglingVisibilityId(null);
    }
  };

  const copyShareLink = async () => {
    if (!shareUrl) return;

    const ok = await copyTextToClipboard(shareUrl);
    if (ok) {
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error("Unable to copy the link");
    }
  };

  const shareToApps = async () => {
    if (!shareUrl) return;

    const shareData = {
      title: "Shared document",
      text: "Check this out",
      url: shareUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        console.error("Failed to open native share sheet:", error);
      }
    }

    const ok = await copyTextToClipboard(shareUrl);
    if (ok) {
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error("Unable to share or copy the link");
    }
  };

  const loadHistory = async () => {
    if (!isAuthenticated) return;

    setIsHistoryLoading(true);
    setHistoryError(null);

    try {
      const response = await fetch("/api/share?limit=25", {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(errorData?.message || "Failed to load share history");
      }

      const data = (await response.json()) as ShareHistoryResponse;
      setHistoryItems(Array.isArray(data.items) ? data.items : []);
    } catch (error) {
      console.error("Failed to load share history:", error);
      setHistoryItems([]);
      setHistoryError("Unable to load history right now.");
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const handleHistoryToggle = () => {
    if (!isAuthenticated) {
      onSignIn();
      return;
    }

    const nextOpenState = !showHistoryDialog;
    setShowHistoryDialog(nextOpenState);

    if (nextOpenState) {
      void loadHistory();
    }
  };

  const copyHistoryLink = async (url: string, id: string) => {
    const ok = await copyTextToClipboard(url);
    if (ok) {
      setCopiedHistoryId(id);
      setTimeout(() => setCopiedHistoryId(null), 2000);
    } else {
      toast.error("Unable to copy the link");
    }
  };

  const revokeHistoryLink = async (id: string) => {
    if (
      !window.confirm(
        "Revoke this shared link? People with this URL will no longer be able to view it.",
      )
    ) {
      return;
    }

    setRevokingHistoryId(id);
    try {
      const response = await fetch(`/api/share?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(errorData?.message || "Failed to revoke shared link");
      }

      setHistoryItems((previous) => previous.filter((item) => item.id !== id));
      if (copiedHistoryId === id) {
        setCopiedHistoryId(null);
      }
    } catch (error) {
      console.error("Failed to revoke shared link:", error);
      setHistoryError("Unable to revoke this link right now.");
    } finally {
      setRevokingHistoryId(null);
    }
  };

  useEffect(() => {
    if (isAuthenticated) return;
    setShowHistoryDialog(false);
    setHistoryItems([]);
    setHistoryError(null);
    setCopiedHistoryId(null);
  }, [isAuthenticated]);

  return (
    <>
      <header className="relative flex items-center justify-between border-b border-border/70 bg-background/80 px-4 py-3 backdrop-blur-md md:px-6">
        <div className="pointer-events-none absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

        <div className="flex items-center gap-3 min-w-0">
          {/* Editorial wordmark */}
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-b from-primary to-primary/80 shadow-[0_2px_8px_-2px_color-mix(in_oklab,var(--primary)_45%,transparent)]">
              <FileText className="h-4 w-4 text-primary-foreground" />
              <span className="absolute -right-0.5 -top-0.5 inline-flex h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-background dot-pulse" />
            </div>
            <div className="leading-tight">
              <div className="flex items-baseline gap-1.5">
                <h1 className="font-display text-[22px] italic leading-none text-foreground">
                  Marcko
                </h1>
                <span className="hidden eyebrow sm:inline">Editorial · v2</span>
              </div>
              <p className="mt-0.5 hidden text-[10px] tracking-wide text-muted-foreground/90 sm:block">
                A secure markdown workstation
              </p>
            </div>
          </div>

          <span className="hidden h-6 w-px bg-border/70 md:inline-block" />

          {/* Document state pill */}
          <div className="hidden md:flex items-center gap-1.5 rounded-full border border-border/80 bg-card/40 px-2.5 py-1 text-[10px] font-medium tracking-wide text-muted-foreground">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-50 dot-pulse" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            <span className="font-mono uppercase tracking-[0.18em] text-foreground/80">
              {editingDocumentId ? "Editing" : "Draft"}
            </span>
            <span className="text-muted-foreground/60">·</span>
            <span className="font-mono">autosaved</span>
          </div>

          <div className="hidden items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700 lg:flex dark:text-emerald-300">
            <ShieldCheck className="h-3 w-3" />
            <span>Enterprise · E2E</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
              >
                {theme === "light" && <Sun className="h-4 w-4" />}
                {theme === "dark" && <Moon className="h-4 w-4" />}
                {theme === "system" && <Monitor className="h-4 w-4" />}
                <span className="sr-only">Toggle theme</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onThemeChange("light")}>
                <Sun className="mr-2 h-4 w-4" />
                Light
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onThemeChange("dark")}>
                <Moon className="mr-2 h-4 w-4" />
                Dark
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onThemeChange("system")}>
                <Monitor className="mr-2 h-4 w-4" />
                System
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            onClick={handleHistoryToggle}
            variant="ghost"
            className="h-9 gap-1.5 rounded-full px-3 text-[12px] text-muted-foreground hover:text-foreground"
            size="sm"
            disabled={isAuthLoading}
          >
            <History className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">History</span>
          </Button>

          {editingDocumentId && versions.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={isLoadingVersions}
                >
                  <GitBranch className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {isLoadingVersions
                      ? "Loading..."
                      : activeVersion === null
                        ? "Versions"
                        : `v${activeVersion}`}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-xs">
                  Document versions
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {[...versions].reverse().map((entry) => {
                  const isLatest = entry.version === versions[versions.length - 1].version;
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
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : isActive ? (
                        <Check className="h-3.5 w-3.5" />
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
              isSharing || Boolean(editingDocumentId && !editorContent?.trim())
            }
            className="h-9 gap-1.5 rounded-full bg-foreground px-4 text-[12px] font-semibold tracking-wide text-background shadow-[0_4px_18px_-6px_color-mix(in_oklab,var(--foreground)_55%,transparent)] hover:bg-foreground/90"
            size="sm"
          >
            {isSharing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="hidden sm:inline">
                  {editingDocumentId ? "Updating..." : "Sharing..."}
                </span>
              </>
            ) : editingDocumentId && onUpdateShare ? (
              <>
                <Pencil className="h-4 w-4" />
                <span className="hidden sm:inline">Update</span>
              </>
            ) : (
              <>
                <Share2 className="h-4 w-4" />
                <span className="hidden sm:inline">Share</span>
              </>
            )}
          </Button>
          {isAuthLoading ? (
            <Button variant="outline" size="sm" disabled className="gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Checking...</span>
            </Button>
          ) : isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 overflow-hidden rounded-full border border-border p-0"
                >
                  {userImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={userImage}
                      alt={userName || "User"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-xs font-semibold">{avatarText}</span>
                  )}
                  <span className="sr-only">Open account menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="space-y-0.5">
                  <p className="truncate text-sm font-medium">
                    {userName || "Account"}
                  </p>
                  {userEmail ? (
                    <p className="truncate text-xs font-normal text-muted-foreground">
                      {userEmail}
                    </p>
                  ) : null}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setShowApiKeysDialog(true)}
                  className="gap-2"
                >
                  <Key />
                  <div className="flex flex-col">
                    <span>Connect AI agents</span>
                    <span className="text-[10px] text-muted-foreground">
                      MCP · Claude · Cursor · ChatGPT
                    </span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  disabled={isSigningOut || isDeletingAccount}
                  className="gap-2"
                >
                  {isSigningOut ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LogOut />
                  )}
                  <span>Log out</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleDeleteAccount}
                  disabled={isSigningOut || isDeletingAccount}
                  variant="destructive"
                  className="gap-2"
                >
                  {isDeletingAccount ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 />
                  )}
                  <span>Delete account</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="outline" size="sm" onClick={onSignIn}>
              <span>Log in</span>
            </Button>
          )}
        </div>
      </header>
      {shareWarning ? (
        <div className="border-b border-amber-500/30 bg-amber-100 px-4 py-2 text-xs text-amber-900 md:px-6 dark:bg-amber-900/30 dark:text-amber-100">
          {shareWarning}
        </div>
      ) : null}

      <Dialog
        open={showVisibilityPicker}
        onOpenChange={setShowVisibilityPicker}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Share visibility</DialogTitle>
            <DialogDescription>
              Choose who can view this shared document.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setPendingVisibility("public")}
              className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                pendingVisibility === "public"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              <Globe className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div>
                <p className="text-sm font-medium">Public</p>
                <p className="text-xs text-muted-foreground">
                  Anyone with the link can view
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setPendingVisibility("private")}
              className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                pendingVisibility === "private"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              <Lock className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="text-sm font-medium">Private</p>
                <p className="text-xs text-muted-foreground">
                  Only signed-in users can view
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
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Share2 className="h-4 w-4" />
                Generate Link
              </>
            )}
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingDocumentId ? "Document updated" : "Share your document"}
            </DialogTitle>
            <DialogDescription>
              {editingDocumentId
                ? "Your changes have been saved. The same link now shows the updated content."
                : "Anyone with this link can view your rendered markdown document. Shared documents are stored to keep links working."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Link className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input readOnly value={shareUrl || ""} className="pl-9 pr-4" />
            </div>
            <Button
              onClick={copyShareLink}
              size="sm"
              variant="outline"
              className="shrink-0 gap-1.5"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy
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
            <Share className="h-4 w-4" />
            Share via apps
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showHistoryDialog}
        onOpenChange={(open) => {
          setShowHistoryDialog(open);
          if (open && isAuthenticated) {
            void loadHistory();
          }
        }}
      >
        <DialogContent className="flex max-h-[min(400px,calc(100dvh-2rem))] w-full max-w-[calc(100vw-2rem)] flex-col overflow-hidden p-4 sm:max-w-lg sm:p-5">
          <DialogHeader className="min-w-0 shrink-0 gap-1 pr-8 sm:pr-10">
            <DialogTitle className="break-words text-base">
              Your share history
            </DialogTitle>
            <DialogDescription className="break-words text-xs">
              Reopen or revoke shared links.
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
            <div className="shrink-0 rounded-md border border-amber-500/30 bg-amber-100/70 px-2.5 py-1.5 text-[11px] text-amber-900 dark:bg-amber-900/20 dark:text-amber-100">
              Links are stored for history. Revoke anytime.
            </div>
            {isHistoryLoading ? (
              <div className="flex shrink-0 items-center justify-center py-4 text-xs text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading your shares...
              </div>
            ) : historyError ? (
              <div className="shrink-0 space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-2.5">
                <p className="text-xs text-destructive">{historyError}</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void loadHistory()}
                  className="h-7 text-xs"
                >
                  Retry
                </Button>
              </div>
            ) : historyItems.length === 0 ? (
              <div className="shrink-0 rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                No shared documents yet.
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto overflow-x-hidden pr-1">
                {historyItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex min-w-0 shrink-0 flex-col gap-1.5 overflow-hidden rounded-md border border-border bg-background p-2"
                  >
                    <div className="min-w-0 overflow-hidden">
                      <div className="flex items-center gap-1.5">
                        <a
                          href={item.shareUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="block break-all text-[11px] text-primary underline-offset-2 hover:underline"
                        >
                          {item.shareUrl}
                        </a>
                        <span
                          className={`inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                            item.visibility === "private"
                              ? "border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                              : "border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          }`}
                        >
                          {item.visibility === "private" ? (
                            <Lock className="h-2.5 w-2.5" />
                          ) : (
                            <Globe className="h-2.5 w-2.5" />
                          )}
                          {item.visibility === "private" ? "Private" : "Public"}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                        {item.preview || "No preview"}
                      </p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {formatHistoryDate(item.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="h-7 gap-1 text-xs"
                      >
                        <a
                          href={item.shareUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="gap-1"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Open
                        </a>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1 text-xs"
                        onClick={() =>
                          void copyHistoryLink(item.shareUrl, item.id)
                        }
                      >
                        {copiedHistoryId === item.id ? (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Link className="h-3.5 w-3.5" />
                            Copy
                          </>
                        )}
                      </Button>
                      {onEditDocument ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          onClick={() => {
                            onEditDocument(item.id);
                            setShowHistoryDialog(false);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Update
                        </Button>
                      ) : null}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1 text-xs"
                        onClick={() =>
                          void toggleVisibility(item.id, item.visibility)
                        }
                        disabled={togglingVisibilityId === item.id}
                      >
                        {togglingVisibilityId === item.id ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Updating
                          </>
                        ) : item.visibility === "private" ? (
                          <>
                            <Globe className="h-3.5 w-3.5" />
                            Make Public
                          </>
                        ) : (
                          <>
                            <Lock className="h-3.5 w-3.5" />
                            Make Private
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1 text-xs"
                        onClick={() => void revokeHistoryLink(item.id)}
                        disabled={revokingHistoryId === item.id}
                      >
                        {revokingHistoryId === item.id ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Revoking
                          </>
                        ) : (
                          <>
                            <Trash2 className="h-3.5 w-3.5" />
                            Revoke
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ApiKeysDialog
        open={showApiKeysDialog}
        onOpenChange={setShowApiKeysDialog}
      />
    </>
  );
}
