import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { SharedDocumentView } from "@/components/shared-document-view"

interface SharePageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: SharePageProps) {
  const { id } = await params
  const supabase = await createClient()
  
  const { data: document } = await supabase
    .from("documents")
    .select("content")
    .eq("id", id)
    .single()

  if (!document) {
    return {
      title: "Document Not Found - Marcko",
    }
  }

  const firstLine = document.content.split("\n")[0].replace(/^#\s*/, "").trim()
  const title = firstLine || "Shared Document"

  return {
    title: `${title} - Marcko`,
    description: "View this shared markdown document created with Marcko",
  }
}

export default async function SharePage({ params }: SharePageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: document, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .single()

  if (error || !document) {
    notFound()
  }

  return <SharedDocumentView content={document.content} documentId={id} />
}
