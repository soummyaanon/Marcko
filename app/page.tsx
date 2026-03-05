"use client"

import { Suspense, useState, useEffect, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { MarkdownEditor } from "@/components/markdown-editor"
import { MarkdownPreview } from "@/components/markdown-preview"
import { EditorToolbar } from "@/components/editor-toolbar"
import { SharedDocumentView } from "@/components/shared-document-view"
import { GoogleSignInModal } from "@/components/auth/google-sign-in-modal"
import { authClient } from "@/lib/auth-client"
import { Github, Star } from "lucide-react"

/** Bump this when you change DEFAULT_MARKDOWN to refresh the default for all users */
const DEFAULT_CONTENT_VERSION = 9

const STORAGE_KEY = "marcko-content"

const DEFAULT_MARKDOWN = `<div align="center">

# Welcome to Marcko ⚡️

**The **Open Source** markdown editor for developers and writers.**

**Enterprise-ready secure sharing: authenticated link creation, encryption at rest, and link revocation controls.**

[Get Started Now](#) • [View on GitHub](https://github.com/soummyaanon/Marcko)

<p align="center">
  <video src="https://res.cloudinary.com/do33xllbd/video/upload/v1770742556/Image_Animation_with_Markdown_Preview_p1auw8.mp4?v=2" autoplay loop muted playsinline preload="metadata" width="80%" height="auto" style="max-width: 80%; height: auto; border-radius: 12px;"></video>
</p>

</div>

<div align="justify">

<br>

------------
------------
------------


## ❓ The Problem & Solution

**The Problem**: Most markdown editors focus on writing speed but treat sharing and security as an afterthought. That leaves teams choosing between convenience and trust.

**Our Solution**: Marcko combines a fast writing experience with **security-first sharing**. Only authenticated users can create share links, and shared content is encrypted at rest. You ship docs faster without compromising data protection.

### 🔒 Security You Can Trust

- **Authenticated sharing**: only signed-in users can generate public links.
- **Encryption at rest**: shared content is encrypted before it is stored.
- **Controlled visibility**: recipients can read only with the exact share URL.
- **Governance controls**: creators can track, reopen, and revoke shared links.

### 🏢 Enterprise Readiness

- **Security baseline**: encrypted storage + authenticated sharing by default.
- **Operational control**: revoke links instantly from history.
- **Collaboration at scale**: simple public viewing for intended recipients.

---

<br>

## 🚀 Key Features

- **🔐 Secure by Default**: Shared docs are encrypted at rest and only signed-in users can create share links.
- **🔮 Open with AI**: Directly open your current document in **ChatGPT**, **Gemini**, or **Claude**.
- **Real-time Preview**: Type on the left, see it on the right. Instant feedback.
- **GitHub Flavored**: We support tables, task lists, strikethrough, and more.
- **Math Support**: Render complex equations with KaTeX.
- **Syntax Highlighting**: Beautiful code blocks for your technical writing.
- **Share Instantly**: Create a unique link to share your work with the world.


<br>

## 🎨 Demo

### 1. Images & HTML

We support raw HTML and images!

<p align="center">
  <img src="https://github.com/user-attachments/assets/92f9b0bd-6d86-4a69-869c-a8f1e2e9bf61" alt="soummyaanon-space-shooter" loading="lazy" decoding="async" />
</p>

### 2. Code Syntax Highlighting

\`\`\`typescript
interface User {
  id: number;
  name: string;
  role: 'admin' | 'user';
}

function greet(user: User): string {
  return \`Hello, \${user.name}! You are logged in as \${user.role}.\`;
}
\`\`\`

### 3. Mathematical Equations

We render math using **KaTeX**:

The quadratic formula is $$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$

Maxwell's equations:
$$
\\nabla \\cdot \\mathbf{E} = \\frac{\rho}{\\varepsilon_0}
$$

### 4. Mermaid Diagrams

\`\`\`mermaid
graph TD
    A[Start] --> B{Is it working?}
    B -- Yes --> C[Great!]
    B -- No --> D[Debug]
    D --> B
\`\`\`

### 5. GFM Tables

| Feature | Support | Description |
| :--- | :---: | :--- |
| **Tables** | ✅ | Neat data organization |
| **Task Lists** | ✅ | Manage your to-dos |
| **Strikethrough** | ✅ | ~~Mistakes~~ Corrections |

### 6. Task Lists

- [x] Create a new document
- [x] Write some cool markdown
- [x] Share with friends
- [ ] Star Marcko on GitHub ⭐️


<br>

## 🌐 Sharing Features

### Share Your Work
Easily generate a unique public URL for your markdown.
- **Encrypted at rest**: Shared document content is encrypted before storage.
- **Only signed-in users can share** documents.
- **Sign in with Google** to create share links.

</div>

---

<p align="center">
     <img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&height=100&section=footer"/>
</p>
`

const PENDING_SHARE_STORAGE_KEY = "marcko-pending-share"

const PENDING_SHARE_VISIBILITY_KEY = "marcko-pending-share-visibility"

type ShareApiResponse = {
  id: string
  shareUrl: string
  visibility: "public" | "private"
}

type ShareDocResponse = {
  id: string
  content: string
  visibility: "public" | "private"
  shareUrl: string
}

type DraftApiResponse = {
  content?: string | null
  contentVersion?: number | null
}

type ApiErrorResponse = {
  message?: string
  code?: string
  authRequired?: boolean
  error?: {
    code?: string
    detail?: string
    hint?: string | null
  }
}

const createAuthRequiredError = (message: string) => {
  const error = new Error(message) as Error & { code: "AUTH_REQUIRED" }
  error.code = "AUTH_REQUIRED"
  return error
}

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"

function HomeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editingDocumentId = searchParams.get("edit")?.trim() || null

  const [markdown, setMarkdown] = useState(DEFAULT_MARKDOWN)
  const [showFullPreview, setShowFullPreview] = useState(false)
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system")
  const [showSignInModal, setShowSignInModal] = useState(false)
  const [shareTriggerToken, setShareTriggerToken] = useState(0)
  const [shareWarning, setShareWarning] = useState<string | null>(null)
  const [direction, setDirection] = useState<"horizontal" | "vertical">("horizontal")
  const [isDraftReady, setIsDraftReady] = useState(false)
  const { data: session, isPending: isSessionPending } = authClient.useSession()
  const sessionUser =
    (session as {
      user?: { id?: string | null; name?: string | null; email?: string | null; image?: string | null } | null
    } | null)?.user ??
    (session as {
      data?: {
        user?: { id?: string | null; name?: string | null; email?: string | null; image?: string | null } | null
      } | null
    } | null)?.data?.user ??
    null

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as { content?: string; defaultVersion?: number }
      const savedVersion = parsed.defaultVersion ?? 0
      if (savedVersion >= DEFAULT_CONTENT_VERSION && typeof parsed.content === "string") {
        setMarkdown(parsed.content)
      }
    } catch {
      // Invalid or old format — use default
    }
  }, [])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ content: markdown, defaultVersion: DEFAULT_CONTENT_VERSION }),
        )
      } catch {
        // Storage full or disabled
      }
    }, 500)
    return () => clearTimeout(timeoutId)
  }, [markdown])

  useEffect(() => {
    const root = document.documentElement
    
    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
      root.classList.toggle("dark", systemTheme)
    } else {
      root.classList.toggle("dark", theme === "dark")
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const handleChange = (e: MediaQueryListEvent) => {
      if (theme === "system") {
        root.classList.toggle("dark", e.matches)
      }
    }
    mediaQuery.addEventListener("change", handleChange)
    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [theme])

  useEffect(() => {
    const checkDirection = () => {
      setDirection(window.innerWidth < 768 ? "vertical" : "horizontal")
    }
    
    checkDirection()
    window.addEventListener("resize", checkDirection)
    return () => window.removeEventListener("resize", checkDirection)
  }, [])

  useEffect(() => {
    if (editingDocumentId && sessionUser?.id) {
      let isCancelled = false
      const loadDoc = async () => {
        try {
          const response = await fetch(`/api/share?id=${encodeURIComponent(editingDocumentId)}`, {
            cache: "no-store",
          })
          if (!response.ok || isCancelled) return
          const data = (await response.json()) as ShareDocResponse
          if (isCancelled) return
          if (typeof data.content === "string") {
            setMarkdown(data.content)
          }
        } catch (error) {
          console.error("Failed to load document for editing:", error)
        }
      }
      void loadDoc()
      return () => {
        isCancelled = true
      }
    }
  }, [editingDocumentId, sessionUser?.id])

  useEffect(() => {
    if (isSessionPending) return

    if (!sessionUser?.id) {
      setIsDraftReady(false)
      return
    }

    if (editingDocumentId) {
      setIsDraftReady(true)
      return
    }

    let isCancelled = false

    const loadDraft = async () => {
      try {
        const response = await fetch("/api/draft", {
          method: "GET",
          cache: "no-store",
        })

        if (!response.ok) return

        const data = (await response.json()) as DraftApiResponse
        if (isCancelled) return

        const draftVersion =
          typeof data.contentVersion === "number" && Number.isFinite(data.contentVersion)
            ? data.contentVersion
            : 0

        // Never replace current defaults with an older draft from the server.
        const shouldApplyDraft = draftVersion >= DEFAULT_CONTENT_VERSION

        if (typeof data.content === "string") {
          if (shouldApplyDraft) {
            setMarkdown(data.content)
          }
        }
      } catch (error) {
        console.error("Failed to load secure draft:", error)
      } finally {
        if (!isCancelled) {
          setIsDraftReady(true)
        }
      }
    }

    void loadDraft()

    return () => {
      isCancelled = true
    }
  }, [isSessionPending, sessionUser?.id, editingDocumentId])

  useEffect(() => {
    if (!sessionUser?.id || !isDraftReady) return

    const timeoutId = setTimeout(() => {
      void fetch("/api/draft", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          content: markdown,
          contentVersion: DEFAULT_CONTENT_VERSION,
        }),
      }).catch((error) => {
        console.error("Failed to save secure draft:", error)
      })
    }, 700)

    return () => clearTimeout(timeoutId)
  }, [markdown, sessionUser?.id, isDraftReady])

  const requestShare = useCallback(async (content: string, visibility: "public" | "private" = "public"): Promise<string> => {
    const response = await fetch("/api/share", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ content, visibility }),
    })

    if (!response.ok) {
      const errorData = (await response.json().catch(() => null)) as ApiErrorResponse | null
      if (response.status === 403 && errorData?.code === "AUTH_REQUIRED") {
        throw createAuthRequiredError(
          errorData.message || "Please sign in with Google to share documents.",
        )
      }

      const debugSuffix =
        errorData?.error?.code || errorData?.error?.detail
          ? ` (${errorData.error?.code || "UNKNOWN"}: ${errorData.error?.detail || "no detail"})`
          : ""
      throw new Error((errorData?.message || "Failed to share document") + debugSuffix)
    }

    const data = (await response.json()) as ShareApiResponse
    setShareWarning(null)
    return data.shareUrl
  }, [])

  const handleShare = useCallback(async (visibility: "public" | "private" = "public"): Promise<string> => {
    return requestShare(markdown, visibility)
  }, [markdown, requestShare])

  const requestUpdateShare = useCallback(
    async (docId: string, content: string): Promise<string> => {
      const response = await fetch("/api/share", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ id: docId, content }),
      })

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as ApiErrorResponse | null
        const debugSuffix =
          errorData?.error?.code || errorData?.error?.detail
            ? ` (${errorData.error?.code || "UNKNOWN"}: ${errorData.error?.detail || "no detail"})`
            : ""
        throw new Error((errorData?.message || "Failed to update document") + debugSuffix)
      }

      const data = (await response.json()) as { shareUrl?: string }
      setShareWarning(null)
      return data.shareUrl ?? `${typeof window !== "undefined" ? window.location.origin : ""}/share/${docId}`
    },
    [],
  )

  const handleEditDocument = useCallback(
    (docId: string) => {
      router.push(`/?edit=${encodeURIComponent(docId)}`)
    },
    [router],
  )

  const handleShareAuthRequired = useCallback(() => {
    localStorage.setItem(PENDING_SHARE_STORAGE_KEY, "1")
    localStorage.setItem(PENDING_SHARE_VISIBILITY_KEY, "public")
    setShowSignInModal(true)
    setShareWarning("Sign in with Google to share documents.")
  }, [])

  const handleSignOut = useCallback(async () => {
    await authClient.signOut()
    setShareWarning(null)
  }, [])

  const handleDeleteAccount = useCallback(async () => {
    await authClient.deleteUser({
      callbackURL: window.location.origin,
    })
    setShareWarning(null)
    localStorage.removeItem(PENDING_SHARE_STORAGE_KEY)
  }, [])

  useEffect(() => {
    if (isSessionPending) return
    if (!sessionUser) return

    const shouldResumeShare = localStorage.getItem(PENDING_SHARE_STORAGE_KEY) === "1"
    if (!shouldResumeShare) return

    localStorage.removeItem(PENDING_SHARE_STORAGE_KEY)
    localStorage.removeItem(PENDING_SHARE_VISIBILITY_KEY)
    setShowSignInModal(false)
    setShareTriggerToken((previous) => previous + 1)
    setShareWarning(null)
  }, [isSessionPending, sessionUser])

  if (showFullPreview) {
    return (
      <SharedDocumentView
        content={markdown}
        onBackToEditor={() => setShowFullPreview(false)}
      />
    )
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-background overflow-hidden">
      <EditorToolbar
        onShare={handleShare}
        onShareAuthRequired={handleShareAuthRequired}
        onUpdateShare={editingDocumentId ? requestUpdateShare : undefined}
        onEditDocument={handleEditDocument}
        editingDocumentId={editingDocumentId}
        editorContent={editingDocumentId ? markdown : undefined}
        theme={theme}
        onThemeChange={setTheme}
        isAuthenticated={Boolean(sessionUser)}
        isAuthLoading={isSessionPending}
        onSignIn={() => setShowSignInModal(true)}
        onSignOut={handleSignOut}
        onDeleteAccount={handleDeleteAccount}
        userName={sessionUser?.name ?? null}
        userEmail={sessionUser?.email ?? null}
        userImage={sessionUser?.image ?? null}
        shareTriggerToken={shareTriggerToken}
        shareWarning={shareWarning}
      />
      
      <main className="flex flex-1 flex-col overflow-hidden">
        <ResizablePanelGroup direction={direction}>
          <ResizablePanel defaultSize={40} minSize={20}>
            <div className="flex h-full flex-col border-r border-border">
              <MarkdownEditor value={markdown} onChange={setMarkdown} defaultContent={DEFAULT_MARKDOWN} />
            </div>
          </ResizablePanel>
          
          <ResizableHandle withHandle />
          
          <ResizablePanel defaultSize={60} minSize={20}>
            <div className="flex h-full flex-col">
              <MarkdownPreview content={markdown} onOpenPreview={() => setShowFullPreview(true)} />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </main>

      <footer className="border-t border-border bg-muted/30 px-4 py-2 md:px-6"> 
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 sm:flex-row">
          <div className="flex flex-col items-center gap-1 sm:items-start">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Created by</span>
              <a
                href="https://github.com/soummyaanon"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 font-medium text-foreground hover:underline"
              >
                <Github className="h-3 w-3" />
                soummyaanon
              </a>
            </div>
          </div>
          <a
            href="https://github.com/soummyaanon/Marcko"
            target="_blank"
            rel="noreferrer"
            className="group flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium transition-colors hover:bg-muted"
          >
            <Github className="h-3.5 w-3.5" />
            <span>Star on GitHub</span>
            <span className="flex items-center gap-1 border-l border-border pl-2 text-muted-foreground group-hover:text-foreground">
              <Star className="h-3 w-3" />
            </span>
          </a>
        </div>
      </footer>

      <GoogleSignInModal open={showSignInModal} onOpenChange={setShowSignInModal} />
    </div>
  )
}

function HomeFallback() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  )
}

export default function Home() {
  return (
    <Suspense fallback={<HomeFallback />}>
      <HomeContent />
    </Suspense>
  )
}
