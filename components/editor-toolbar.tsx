"use client"

import { useState } from "react"
import { Share2, Link, Check, Loader2, FileText, Moon, Sun, Monitor } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  theme: "light" | "dark" | "system"
  onThemeChange: (theme: "light" | "dark" | "system") => void
}

export function EditorToolbar({ onShare, theme, onThemeChange }: EditorToolbarProps) {
  const [isSharing, setIsSharing] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [showDialog, setShowDialog] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    setIsSharing(true)
    try {
      const url = await onShare()
      setShareUrl(url)
      setShowDialog(true)
    } catch (error) {
      console.error("Failed to share:", error)
    } finally {
      setIsSharing(false)
    }
  }

  const copyShareLink = async () => {
    if (shareUrl) {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

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
        </div>
      </header>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share your document</DialogTitle>
            <DialogDescription>
              Anyone with this link can view your rendered markdown document.
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
    </>
  )
}
