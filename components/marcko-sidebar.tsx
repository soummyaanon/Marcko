"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Pencil,
  MessageSquare,
  Key,
  History,
  Sun,
  Moon,
  Monitor,
  LogOut,
  Trash2,
  Loader2,
  Globe,
  Lock,
  ExternalLink,
  Copy,
  Check,
  ChevronsUpDown,
  Github,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { copyTextToClipboard } from "@/lib/clipboard";
import { ApiKeysDialog } from "@/components/api-keys-dialog";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
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

interface MarckoSidebarProps {
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
  onEditDocument?: (id: string) => void;
  activeDocumentId?: string | null;
}

const formatRelative = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const diff = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "just now";
  if (diff < hour) return `${Math.floor(diff / minute)}m`;
  if (diff < day) return `${Math.floor(diff / hour)}h`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export function MarckoSidebar({
  theme,
  onThemeChange,
  isAuthenticated,
  isAuthLoading,
  onSignIn,
  onSignOut,
  onDeleteAccount,
  userName,
  userEmail,
  userImage,
  onEditDocument,
  activeDocumentId,
}: MarckoSidebarProps) {
  const router = useRouter();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;

  const [showApiKeysDialog, setShowApiKeysDialog] = useState(false);
  const [history, setHistory] = useState<ShareHistoryItem[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const loadHistory = async () => {
    if (!isAuthenticated) return;
    setIsLoadingHistory(true);
    setHistoryError(null);
    try {
      const response = await fetch("/api/share?limit=10", {
        method: "GET",
        cache: "no-store",
      });
      if (!response.ok) {
        const err = (await response.json().catch(() => null)) as
          | { message?: string }
          | null;
        throw new Error(err?.message || "Failed to load history");
      }
      const data = (await response.json()) as ShareHistoryResponse;
      setHistory(Array.isArray(data.items) ? data.items : []);
    } catch (error) {
      console.error("Failed to load shares:", error);
      setHistoryError("Could not load recent documents.");
      setHistory([]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      setHistory([]);
      setHistoryError(null);
      return;
    }
    void loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const closeMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  const handleEditClick = (id: string) => {
    if (onEditDocument) {
      onEditDocument(id);
    } else {
      router.push(`/?edit=${encodeURIComponent(id)}`);
    }
    closeMobile();
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await onSignOut();
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
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const copyLink = async (id: string, url: string) => {
    const ok = await copyTextToClipboard(url);
    if (ok) {
      setCopiedId(id);
      toast.success("Link copied");
      setTimeout(() => setCopiedId(null), 1800);
    } else {
      toast.error("Couldn't copy");
    }
  };

  const revoke = async (id: string) => {
    if (
      !window.confirm(
        "Revoke this shared link? It will no longer be accessible.",
      )
    ) {
      return;
    }
    setRevokingId(id);
    try {
      const response = await fetch(`/api/share?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to revoke");
      setHistory((prev) => prev.filter((i) => i.id !== id));
      toast.success("Link revoked");
    } catch {
      toast.error("Couldn't revoke");
    } finally {
      setRevokingId(null);
    }
  };

  const avatarText = (() => {
    const source = (userName || userEmail || "U").trim();
    return source.slice(0, 2).toUpperCase();
  })();

  const isEditorActive = !activeDocumentId;
  const themeIcon =
    theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  const ThemeIcon = themeIcon;

  return (
    <>
      <Sidebar
        collapsible="icon"
        className="border-r-0 group-data-[side=left]:border-r-0 bg-sidebar"
      >
        <SidebarHeader className="px-3 py-4">
          <Link
            href="/"
            onClick={closeMobile}
            className="group/brand flex items-center gap-2.5 outline-none"
          >
            <span
              aria-hidden
              className="relative flex h-2 w-2 shrink-0 items-center justify-center"
            >
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-40 dot-pulse" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span
              className={cn(
                "flex flex-col leading-none transition-opacity duration-200",
                collapsed && "opacity-0",
              )}
            >
              <span className="font-display text-[22px] italic tracking-tight text-foreground">
                Marcko
              </span>
              <span className="mt-1 font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground/80">
                Editorial · v2
              </span>
            </span>
          </Link>
        </SidebarHeader>

        <SidebarContent className="gap-0">
          <SidebarGroup className="px-2 pt-3">
            <SidebarGroupLabel className="px-2 font-mono text-[9px] uppercase tracking-[0.24em] text-muted-foreground/70">
              Workspace
            </SidebarGroupLabel>
            <SidebarGroupContent className="mt-1">
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isEditorActive}
                    tooltip="Editor"
                    className={cn(
                      "group/item h-9 rounded-md px-2.5 font-normal text-sm text-sidebar-foreground/80 hover:bg-foreground/[0.04] hover:text-sidebar-foreground",
                      "data-[active=true]:bg-foreground/[0.06] data-[active=true]:font-medium data-[active=true]:text-sidebar-foreground",
                      "relative",
                    )}
                  >
                    <Link href="/" onClick={closeMobile}>
                      <Pencil className="size-4 text-muted-foreground/70 group-hover/item:text-foreground group-data-[active=true]/item:text-foreground" />
                      <span>Editor</span>
                      {isEditorActive ? (
                        <span
                          aria-hidden
                          className="absolute inset-y-1.5 left-0 w-px bg-foreground"
                        />
                      ) : null}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    tooltip="Feedback widgets"
                    className="group/item h-9 rounded-md px-2.5 font-normal text-sm text-sidebar-foreground/80 hover:bg-foreground/[0.04] hover:text-sidebar-foreground"
                  >
                    <Link href="/feedback" onClick={closeMobile}>
                      <MessageSquare className="size-4 text-muted-foreground/70 group-hover/item:text-foreground" />
                      <span>Feedback</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => {
                      if (!isAuthenticated) {
                        onSignIn();
                        return;
                      }
                      setShowApiKeysDialog(true);
                      closeMobile();
                    }}
                    tooltip="Connect AI agents"
                    className="group/item h-9 rounded-md px-2.5 font-normal text-sm text-sidebar-foreground/80 hover:bg-foreground/[0.04] hover:text-sidebar-foreground"
                  >
                    <Key className="size-4 text-muted-foreground/70 group-hover/item:text-foreground" />
                    <span>AI Connect</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => {
                      if (!isAuthenticated) {
                        onSignIn();
                        return;
                      }
                      void loadHistory();
                      setShowHistoryDialog(true);
                      closeMobile();
                    }}
                    tooltip="Document history"
                    className="group/item h-9 rounded-md px-2.5 font-normal text-sm text-sidebar-foreground/80 hover:bg-foreground/[0.04] hover:text-sidebar-foreground"
                  >
                    <History className="size-4 text-muted-foreground/70 group-hover/item:text-foreground" />
                    <span>History</span>
                    {isAuthenticated && history.length > 0 ? (
                      <span className="ml-auto font-mono text-[10px] tracking-wide text-muted-foreground/60">
                        {history.length}
                      </span>
                    ) : null}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="gap-2 p-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    tooltip="Theme"
                    className="h-9 rounded-md px-2.5 font-normal text-[12px] text-sidebar-foreground/80 hover:bg-foreground/[0.04] hover:text-sidebar-foreground"
                  >
                    <ThemeIcon className="size-4 text-muted-foreground/70" />
                    <span className="capitalize">{theme}</span>
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  side="top"
                  className="w-40"
                >
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
            </SidebarMenuItem>

            {isAuthenticated ? (
              <SidebarMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton
                      size="lg"
                      tooltip={userName || userEmail || "Account"}
                      className="h-12 rounded-md px-2 hover:bg-foreground/[0.04]"
                    >
                      <span className="flex size-7 shrink-0 overflow-hidden rounded-full border border-border/70 bg-muted/50">
                        {userImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={userImage}
                            alt={userName || "User"}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center font-mono text-[10px] font-semibold text-foreground/80">
                            {avatarText}
                          </span>
                        )}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col items-start">
                        <span className="w-full truncate text-[12px] font-medium text-sidebar-foreground">
                          {userName || "Account"}
                        </span>
                        {userEmail ? (
                          <span className="w-full truncate text-[10px] text-muted-foreground/70">
                            {userEmail}
                          </span>
                        ) : null}
                      </span>
                      <ChevronsUpDown className="size-3.5 text-muted-foreground/60" />
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    side="top"
                    align="start"
                    className="w-56"
                  >
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
                      onClick={() => setShowHistoryDialog(true)}
                      className="gap-2"
                    >
                      <History className="size-4" />
                      Manage shared links
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="gap-2">
                      <a
                        href="https://github.com/soummyaanon/Marcko"
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Github className="size-4" />
                        Star on GitHub
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleSignOut}
                      disabled={isSigningOut || isDeletingAccount}
                      className="gap-2"
                    >
                      {isSigningOut ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <LogOut className="size-4" />
                      )}
                      Log out
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleDeleteAccount}
                      disabled={isSigningOut || isDeletingAccount}
                      variant="destructive"
                      className="gap-2"
                    >
                      {isDeletingAccount ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                      Delete account
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            ) : (
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={onSignIn}
                  disabled={isAuthLoading}
                  tooltip="Sign in"
                  className="h-9 justify-center rounded-md bg-foreground/[0.06] px-3 text-[12px] font-medium text-foreground hover:bg-foreground hover:text-background"
                >
                  {isAuthLoading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <span className="font-mono uppercase tracking-[0.18em]">
                      Sign in
                    </span>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
          </SidebarMenu>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      <ApiKeysDialog
        open={showApiKeysDialog}
        onOpenChange={setShowApiKeysDialog}
      />

      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="flex max-h-[min(560px,calc(100dvh-2rem))] w-full max-w-[calc(100vw-2rem)] flex-col overflow-hidden gap-0 p-0 sm:max-w-lg">
          <DialogHeader className="px-6 pb-3 pt-6">
            <DialogTitle className="font-display text-2xl italic font-normal leading-none">
              Shared documents
            </DialogTitle>
            <DialogDescription className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
              Reopen, copy, or revoke any link.
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-3">
            {isLoadingHistory ? (
              <div className="flex items-center justify-center py-10 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/80">
                <Loader2 className="mr-2 size-3.5 animate-spin" />
                Loading
              </div>
            ) : history.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground/80">
                No shared documents yet.
              </div>
            ) : (
              <ul className="flex flex-col">
                {history.map((item) => {
                  const isPrivate = item.visibility === "private";
                  return (
                    <li
                      key={item.id}
                      className="group/row relative flex items-center gap-3 rounded-md px-4 py-3 transition-colors hover:bg-foreground/[0.04]"
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "mt-1.5 inline-flex h-1.5 w-1.5 shrink-0 self-start rounded-full",
                          isPrivate
                            ? "bg-amber-500/80"
                            : "bg-emerald-500/80",
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-[13px] text-foreground">
                          {item.preview || "Untitled"}
                        </p>
                        <p className="mt-0.5 inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground/70">
                          <span>{formatRelative(item.updatedAt)}</span>
                          <span className="opacity-50">·</span>
                          <span className="inline-flex items-center gap-1">
                            {isPrivate ? (
                              <Lock className="size-2.5" />
                            ) : (
                              <Globe className="size-2.5" />
                            )}
                            {item.visibility}
                          </span>
                        </p>
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover/row:opacity-100 focus-within:opacity-100">
                        <Button
                          asChild
                          size="icon"
                          variant="ghost"
                          className="size-7 text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
                          title="Open"
                        >
                          <a
                            href={item.shareUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ExternalLink className="size-3.5" />
                          </a>
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
                          onClick={() => void copyLink(item.id, item.shareUrl)}
                          title="Copy link"
                        >
                          {copiedId === item.id ? (
                            <Check className="size-3.5" />
                          ) : (
                            <Copy className="size-3.5" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
                          onClick={() => {
                            handleEditClick(item.id);
                            setShowHistoryDialog(false);
                          }}
                          title="Edit"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => void revoke(item.id)}
                          disabled={revokingId === item.id}
                          title="Revoke"
                        >
                          {revokingId === item.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="size-3.5" />
                          )}
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
