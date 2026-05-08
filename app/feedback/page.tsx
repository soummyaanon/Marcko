import type { Metadata } from "next"

import { FeedbackDashboard } from "./feedback-dashboard"

export const metadata: Metadata = {
  title: "Feedback · Marcko",
  description: "Collect signal from your apps with embeddable feedback widgets.",
}

export default function FeedbackPage() {
  return <FeedbackDashboard />
}
