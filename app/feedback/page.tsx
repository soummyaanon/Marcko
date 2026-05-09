import type { Metadata } from "next"

import { FeedbackDashboard } from "./feedback-dashboard"

export const metadata: Metadata = {
  title: "Feedback Collector",
  description:
    "Create embeddable feedback widgets for websites and apps, collect structured responses, and review product signal inside Marcko.",
  alternates: {
    canonical: "/feedback",
  },
  openGraph: {
    title: "Marcko Feedback Collector",
    description:
      "Embeddable feedback widgets for collecting structured product feedback from websites and apps.",
    type: "website",
    url: "/feedback",
    siteName: "Marcko",
  },
}

export default function FeedbackPage() {
  return <FeedbackDashboard />
}
