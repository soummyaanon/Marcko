import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { getFeedbackWidgetByPublicKey } from "@/lib/feedback"
import { getSiteOrigin } from "@/lib/site-url"

import { FeedbackForm } from "./feedback-form"

interface PageProps {
  params: Promise<{ publicKey: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { publicKey } = await params
  const widget = await getFeedbackWidgetByPublicKey(publicKey).catch(() => null)
  if (!widget) {
    return {
      title: "Feedback form not found · Marcko",
      robots: { index: false, follow: false },
    }
  }
  const origin = getSiteOrigin()
  const title = `${widget.name} · Feedback`
  const description = `Share your feedback for ${widget.name}.`
  return {
    metadataBase: new URL(origin),
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      type: "website",
      url: `${origin}/feedback/${publicKey}`,
      siteName: "Marcko",
    },
  }
}

export default async function PublicFeedbackPage({ params }: PageProps) {
  const { publicKey } = await params
  const widget = await getFeedbackWidgetByPublicKey(publicKey).catch(() => null)
  if (!widget) notFound()

  return (
    <main className="min-h-svh bg-background text-foreground">
      <FeedbackForm
        widget={{
          publicKey: widget.publicKey,
          name: widget.name,
          triggerLabel: widget.triggerLabel,
          accent: widget.accent,
          questions: widget.questions,
          collectName: widget.collectName,
          nameRequired: widget.nameRequired,
        }}
      />
    </main>
  )
}
