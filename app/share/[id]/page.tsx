import { notFound } from "next/navigation"
import { authDbPool } from "@/lib/auth"
import { SharedDocumentView } from "@/components/shared-document-view"

interface SharePageProps {
  params: Promise<{ id: string }>
}

async function getDocumentWithOwner(id: string) {
  let result
  try {
    result = await authDbPool.query(
      `SELECT d.id, d.content, d.user_id, u.name as owner_name
       FROM documents d
       LEFT JOIN "user" u ON d.user_id = u.id
       WHERE d.id = $1`,
      [id],
    )
  } catch {
    try {
      result = await authDbPool.query(
        `SELECT d.id, d.content, d.user_id, u.name as owner_name
         FROM documents d
         LEFT JOIN users u ON d.user_id = u.id
         WHERE d.id = $1`,
        [id],
      )
    } catch {
      result = await authDbPool.query(
        `SELECT id, content, user_id, NULL::text as owner_name FROM documents WHERE id = $1`,
        [id],
      )
    }
  }
  return result.rows[0] ?? null
}

export async function generateMetadata({ params }: SharePageProps) {
  const { id } = await params
  const doc = await getDocumentWithOwner(id)

  if (!doc) {
    return {
      title: "Document Not Found - Marcko",
    }
  }

  const firstLine = (doc.content as string).split("\n")[0].replace(/^#\s*/, "").trim()
  const title = firstLine || "Shared Document"

  return {
    title: `${title} - Marcko`,
    description: "View this shared markdown document created with Marcko",
  }
}

export default async function SharePage({ params }: SharePageProps) {
  const { id } = await params
  const doc = await getDocumentWithOwner(id)

  if (!doc) {
    notFound()
  }

  const sharedBy: { type: "guest" } | { type: "user"; name: string } =
    doc.user_id && doc.owner_name
      ? { type: "user", name: String(doc.owner_name) }
      : doc.user_id
        ? { type: "user", name: "user" }
        : { type: "guest" }

  return (
    <SharedDocumentView
      content={doc.content as string}
      documentId={id}
      sharedBy={sharedBy}
    />
  )
}
