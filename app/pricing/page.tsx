"use client"

import { useState } from "react"
import Link from "next/link"
import { useTier } from "@/components/pro-gate"

const FEATURES = [
  "Inline AI in the editor (rewrite, expand, translate, mermaid…)",
  "Ask-Your-Library — chat with all your saved docs (coming soon)",
  "Talkable Shared Docs — readers can chat with your published docs (coming soon)",
  "Feedback Intelligence — themes, sentiment, draft replies (coming soon)",
  "Marcko Agent — tool-using chat that drafts, attaches widgets, and publishes (coming soon)",
]

export default function PricingPage() {
  const tier = useTier()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function upgrade() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        credentials: "same-origin",
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? "Checkout unavailable. Please try again.")
        return
      }
      const { checkoutUrl } = await res.json()
      window.location.href = checkoutUrl
    } catch {
      setError("Network error.")
    } finally {
      setBusy(false)
    }
  }

  async function manage() {
    const res = await fetch("/api/billing/portal", { method: "POST" })
    if (!res.ok) return
    const { url } = await res.json()
    window.location.href = url
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Marcko Pro</h1>
      <p className="mt-3 text-zinc-600">
        Unlock the writing copilot and the upcoming Ask-Marcko agent surface.
      </p>
      <div className="mt-8 rounded-2xl border border-zinc-200 p-8">
        <div className="flex items-baseline gap-2">
          <span className="text-5xl font-bold">$6</span>
          <span className="text-zinc-500">/month</span>
        </div>
        <ul className="mt-6 space-y-2 text-sm">
          {FEATURES.map((f) => (
            <li key={f} className="flex gap-2">
              <span className="text-emerald-600">✓</span>
              {f}
            </li>
          ))}
        </ul>
        <div className="mt-8">
          {tier.loading ? null : tier.isPro ? (
            <button
              onClick={manage}
              className="rounded-full border border-zinc-900 px-5 py-2 text-sm font-medium"
            >
              Manage subscription
            </button>
          ) : tier.signedIn ? (
            <button
              onClick={upgrade}
              disabled={busy}
              className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? "Redirecting…" : "Upgrade to Pro"}
            </button>
          ) : (
            <Link
              href="/?signin=1"
              className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white"
            >
              Sign in to upgrade
            </Link>
          )}
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>
      </div>
    </main>
  )
}
