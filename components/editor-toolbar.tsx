"use client"

import { useEffect, useState } from "react"
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
  ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

interface EditorToolbarProps {
  onShare: () => Promise<string>
  onShareAuthRequired: () => void
  theme: "light" | "dark" | "system"
  onThemeChange: (theme: "light" | "dark" | "system") => void
  isAuthenticated: boolean
  isAuthLoading: boolean
  onSignIn: () => void
  onSignOut: () => Promise<void>
  onDeleteAccount: () => Promise<void>
  userName?: string | null
  userEmail?: string | null
  userImage?: string | null
  shareTriggerToken?: number
  shareWarning?: string | null
}

type ShareHistoryItem = {
  id: string
  preview: string
  createdAt: string
  updatedAt: string
  shareUrl: string
}

type ShareHistoryResponse = {
  items?: ShareHistoryItem[]
}

const isAuthRequiredError = (error: unknown): boolean => {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: string }).code === "AUTH_REQUIRED"
  )
}

const formatHistoryDate = (value: string): string => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Unknown date"
  return date.toLocaleString()
}

export function EditorToolbar({
  onShare,
  onShareAuthRequired,
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
  const [isSharing, setIsSharing] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [showDialog, setShowDialog] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showHistoryDialog, setShowHistoryDialog] = useState(false)
  const [historyItems, setHistoryItems] = useState<ShareHistoryItem[]>([])
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)
  const [copiedHistoryId, setCopiedHistoryId] = useState<string | null>(null)

  const handleShare = async () => {
    setIsSharing(true)
    try {
      const url = await onShare()
      setShareUrl(url)
      setShowDialog(true)
    } catch (error) {
      if (isAuthRequiredError(error)) {
        onShareAuthRequired()
        return
      }
      console.error("Failed to share:", error)
    } finally {
      setIsSharing(false)
    }
  }

  const handleSignOut = async () => {
    setIsSigningOut(true)
    try {
      await onSignOut()
    } catch (error) {
      console.error("Failed to sign out:", error)
    } finally {
      setIsSigningOut(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!window.confirm("Delete your account permanently? This cannot be undone.")) {
      return
    }

    setIsDeletingAccount(true)
    try {
      await onDeleteAccount()
    } catch (error) {
      console.error("Failed to delete account:", error)
    } finally {
      setIsDeletingAccount(false)
    }
  }

  const avatarText = (() => {
    const source = (userName || userEmail || "U").trim()
    if (!source) return "U"
    return source.slice(0, 2).toUpperCase()
  })()

  useEffect(() => {
    if (shareTriggerToken > 0) {
      void handleShare()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareTriggerToken])

  const copyShareLink = async () => {
    if (shareUrl) {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const loadHistory = async () => {
    if (!isAuthenticated) return

    setIsHistoryLoading(true)
    setHistoryError(null)

    try {
      const response = await fetch("/api/share?limit=25", {
        method: "GET",
        cache: "no-store",
      })

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as { message?: string } | null
        throw new Error(errorData?.message || "Failed to load share history")
      }

      const data = (await response.json()) as ShareHistoryResponse
      setHistoryItems(Array.isArray(data.items) ? data.items : [])
    } catch (error) {
      console.error("Failed to load share history:", error)
      setHistoryItems([])
      setHistoryError("Unable to load history right now.")
    } finally {
      setIsHistoryLoading(false)
    }
  }

  const handleHistoryToggle = () => {
    if (!isAuthenticated) {
      onSignIn()
      return
    }

    const nextOpenState = !showHistoryDialog
    setShowHistoryDialog(nextOpenState)

    if (nextOpenState) {
      void loadHistory()
    }
  }

  const copyHistoryLink = async (url: string, id: string) => {
    await navigator.clipboard.writeText(url)
    setCopiedHistoryId(id)
    setTimeout(() => setCopiedHistoryId(null), 2000)
  }

  useEffect(() => {
    if (isAuthenticated) return
    setShowHistoryDialog(false)
    setHistoryItems([])
    setHistoryError(null)
    setCopiedHistoryId(null)
  }, [isAuthenticated])

  return (
    <>
      <header className="flex items-center justify-between border-b border-border bg-background px-4 py-3 md:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <FileText className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Marcko</h1>
            <p className="hidden text-xs text-muted-foreground sm:block">Markdown Editor</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
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
            variant="outline"
            className="gap-2"
            size="sm"
            disabled={isAuthLoading}
          >
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">History</span>
          </Button>

          <Button
            onClick={handleShare}
            disabled={isSharing}
            className="gap-2"
            size="sm"
          >
            {isSharing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="hidden sm:inline">Sharing...</span>
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
                  <p className="truncate text-sm font-medium">{userName || "Account"}</p>
                  {userEmail ? (
                    <p className="truncate text-xs font-normal text-muted-foreground">
                      {userEmail}
                    </p>
                  ) : null}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  disabled={isSigningOut || isDeletingAccount}
                  className="gap-2"
                >
                  {isSigningOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut />}
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

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share your document</DialogTitle>
            <DialogDescription>
              Anyone with this link can view your rendered markdown document. Shared
              documents are stored to keep links working.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Link className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                readOnly
                value={shareUrl || ""}
                className="pl-9 pr-4"
              />
            </div>
            <Button onClick={copyShareLink} size="sm" className="shrink-0 gap-1.5">
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied
                </>
              ) : (
                <>
                  <Link className="h-4 w-4" />
                  Copy
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showHistoryDialog}
        onOpenChange={(open) => {
          setShowHistoryDialog(open)
          if (open && isAuthenticated) {
            void loadHistory()
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Your share history</DialogTitle>
            <DialogDescription>
              Reopen any document you have already shared.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-md border border-amber-500/30 bg-amber-100/70 p-3 text-xs text-amber-900 dark:bg-amber-900/20 dark:text-amber-100">
              Privacy note: Shared documents are stored so links and history work.
              Anyone with the share link can view that document, so avoid sensitive data.
            </div>
            {isHistoryLoading ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading your shares...
              </div>
            ) : historyError ? (
              <div className="space-y-3 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-sm text-destructive">{historyError}</p>
                <Button size="sm" variant="outline" onClick={() => void loadHistory()}>
                  Retry
                </Button>
              </div>
            ) : historyItems.length === 0 ? (
              <div className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                No shared documents yet.
              </div>
            ) : (
              <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
                {historyItems.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-md border border-border bg-background p-3"
                  >
                    <div className="mb-2 min-w-0">
                      <p className="text-xs font-medium text-foreground">Shared link</p>
                      <a
                        href={item.shareUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 block truncate text-xs text-primary underline-offset-2 hover:underline"
                      >
                        {item.shareUrl}
                      </a>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.preview || "No preview available"}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Shared on {formatHistoryDate(item.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <a href={item.shareUrl} target="_blank" rel="noreferrer" className="gap-1.5">
                          <ExternalLink className="h-4 w-4" />
                          <span>Open</span>
                        </a>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => void copyHistoryLink(item.shareUrl, item.id)}
                      >
                        {copiedHistoryId === item.id ? (
                          <>
                            <Check className="h-4 w-4" />
                            <span className="text-xs">Copied</span>
                          </>
                        ) : (
                          <>
                            <Link className="h-4 w-4" />
                            <span className="text-xs">Copy</span>
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
    </>
  )
}
