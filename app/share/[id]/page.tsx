import { notFound } from "next/navigation"
import { headers } from "next/headers"
import { auth, authDbPool } from "@/lib/auth"
import { SharedDocumentView } from "@/components/shared-document-view"
import { PrivateDocumentGate } from "@/components/auth/private-document-gate"
import { buildContentPreview, decryptStoredContent, verifySignedAccessToken } from "@/lib/secure-content"
import { getSiteOrigin } from "@/lib/site-url"

interface SharePageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ token?: string }>
}

const DEFAULT_SHARE_TITLE = "Shared Document"
const DEFAULT_SHARE_DESCRIPTION = "View this shared markdown document created with Marcko"

async function getDocumentWithOwner(id: string) {
  let result
  try {
    result = await authDbPool.query(
      `SELECT d.id, d.content, d.user_id, d.visibility, u.name as owner_name
       FROM documents d
       LEFT JOIN "user" u ON d.user_id = u.id
       WHERE d.id = $1`,
      [id],
    )
  } catch {
    try {
      result = await authDbPool.query(
        `SELECT d.id, d.content, d.user_id, d.visibility, u.name as owner_name
         FROM documents d
         LEFT JOIN users u ON d.user_id = u.id
         WHERE d.id = $1`,
        [id],
      )
    } catch {
      result = await authDbPool.query(
        `SELECT id, content, user_id, visibility, NULL::text as owner_name FROM documents WHERE id = $1`,
        [id],
      )
    }
  }
  return result.rows[0] ?? null
}

const getDecodedContent = (rawContent: unknown): string => {
  const content = String(rawContent ?? "")
  try {
    return decryptStoredContent(content)
  } catch {
    // Fallback for any malformed legacy row.
    return content
  }
}

const getDocumentTitle = (content: string): string => {
  const firstTextLine = content
    .split("\n")
    .map((line) => line.replace(/^#{1,6}\s*/, "").trim())
    .find(Boolean)

  return firstTextLine || DEFAULT_SHARE_TITLE
}

const getDocumentDescription = (content: string): string => {
  const plainText = content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/[*_~>#-]/g, " ")

  return buildContentPreview(plainText, 180) || DEFAULT_SHARE_DESCRIPTION
}

export async function generateMetadata({ params }: SharePageProps) {
  const { id } = await params
  const doc = await getDocumentWithOwner(id)
  const origin = getSiteOrigin()
  const ogImage = {
    url: `${origin}/og.png`,
    width: 1200,
    height: 630,
    alt: "Marcko - Open Source Markdown Editor with Enterprise Secure Sharing",
  }

  if (!doc) {
    return {
      title: "Document Not Found",
      robots: { index: false, follow: false },
    }
  }

  const visibility = doc.visibility === "private" ? "private" : "public"
  if (visibility === "private") {
    return {
      metadataBase: new URL(origin),
      title: DEFAULT_SHARE_TITLE,
      description: DEFAULT_SHARE_DESCRIPTION,
      robots: { index: false, follow: false },
      openGraph: {
        title: DEFAULT_SHARE_TITLE,
        description: DEFAULT_SHARE_DESCRIPTION,
        type: "article",
        url: `${origin}/share/${id}`,
        siteName: "Marcko",
        images: [ogImage],
      },
      twitter: {
        card: "summary_large_image",
        title: DEFAULT_SHARE_TITLE,
        description: DEFAULT_SHARE_DESCRIPTION,
        images: [ogImage.url],
      },
    }
  }

  const decodedContent = getDecodedContent(doc.content)
  const title = getDocumentTitle(decodedContent)
  const description = getDocumentDescription(decodedContent)

  return {
    metadataBase: new URL(origin),
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      type: "article",
      url: `${origin}/share/${id}`,
      siteName: "Marcko",
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage.url],
    },
  }
}

export default async function SharePage({ params, searchParams }: SharePageProps) {
  const { id } = await params
  const { token } = await searchParams
  const doc = await getDocumentWithOwner(id)

  if (!doc) {
    notFound()
  }

  // Gate private documents behind authentication
  const visibility = doc.visibility === "private" ? "private" : "public"

  const decodedContent = getDecodedContent(doc.content)

  const sharedBy: { type: "guest" } | { type: "user"; name: string } =
    doc.user_id && doc.owner_name
      ? { type: "user", name: String(doc.owner_name) }
      : doc.user_id
        ? { type: "user", name: "user" }
        : { type: "guest" }

  let isOwner = false
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (visibility === "private") {
    const hasValidToken = typeof token === "string" && verifySignedAccessToken(id, token)

    if (!hasValidToken) {
      if (!session?.user) {
        return (
          <PrivateDocumentGate
            documentId={id}
            content={decodedContent}
            sharedBy={sharedBy}
          />
        )
      }
    }
  }

  if (doc.user_id && session?.user?.id) {
    isOwner = session.user.id === doc.user_id
  }

  return (
    <SharedDocumentView
      content={decodedContent}
      documentId={id}
      sharedBy={sharedBy}
      visibility={visibility}
      isOwner={isOwner}
    />
  )
}
