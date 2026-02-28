"use client"

import { useState } from "react"
import { Lock, Loader2, Sparkles, ArrowLeft } from "lucide-react"

import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { SharedDocumentView } from "@/components/shared-document-view"

type SharedBy = { type: "guest" } | { type: "user"; name: string }

interface PrivateDocumentGateProps {
  documentId: string
  content: string
  sharedBy?: SharedBy
}

export function PrivateDocumentGate({ documentId, content, sharedBy }: PrivateDocumentGateProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSignIn = async () => {
    setError(null)
    setIsLoading(true)

    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: `/share/${documentId}`,
      })
    } catch {
      setError("Google sign-in failed. Please try again.")
      setIsLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen">
      {/* Blurred document in the background */}
      <div
        className="pointer-events-none select-none"
        aria-hidden="true"
        style={{ filter: "blur(8px)" }}
      >
        <SharedDocumentView
          content={content}
          documentId={documentId}
          sharedBy={sharedBy}
          visibility="private"
        />
      </div>

      {/* Overlay with sign-in prompt */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
        <div className="relative mx-4 flex w-full max-w-sm flex-col items-center rounded-2xl bg-background p-8 shadow-2xl ring-1 ring-border animate-in fade-in zoom-in-95 duration-300 slide-in-from-bottom-10">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10 ring-8 ring-amber-500/5">
            <Lock className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>

          <div className="mb-4 space-y-2 text-center">
            <h2 className="text-2xl font-bold tracking-tight">Private Document</h2>
            <p className="text-muted-foreground">
              This document is private. Sign in with Google to view it.
            </p>
          </div>

          <div className="w-full space-y-4">
            <Button
              onClick={handleSignIn}
              disabled={isLoading}
              className="w-full h-11 text-base font-medium relative overflow-hidden group transition-all hover:scale-[1.02]"
              size="lg"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-primary/80 to-primary opacity-0 group-hover:opacity-10 transition-opacity" />
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Redirecting...
                </>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                    <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z" />
                  </svg>
                  Continue with Google
                </div>
              )}
            </Button>

            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-3 w-3 text-amber-500" />
              <span>Sign in to view this document</span>
            </div>

            {error ? (
              <p className="text-sm font-medium text-destructive animate-in fade-in slide-in-from-top-2">
                {error}
              </p>
            ) : null}
          </div>

          <Button asChild variant="ghost" className="mt-4 gap-2">
            <a href="/">
              <ArrowLeft className="h-4 w-4" />
              Go to Editor
            </a>
          </Button>
        </div>
      </div>
    </div>
  )
}
