"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import Link from "next/link"

type Tier = {
  signedIn: boolean
  isPro: boolean
  tier: "free" | "pro" | null
  proUntil: string | null
  loading: boolean
}

const TierCtx = createContext<Tier>({
  signedIn: false,
  isPro: false,
  tier: null,
  proUntil: null,
  loading: true,
})

export function TierProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Tier>({
    signedIn: false,
    isPro: false,
    tier: null,
    proUntil: null,
    loading: true,
  })
  useEffect(() => {
    let cancelled = false
    fetch("/api/me", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        setState({
          signedIn: Boolean(data.signedIn),
          isPro: Boolean(data.isPro),
          tier: data.tier ?? null,
          proUntil: data.proUntil ?? null,
          loading: false,
        })
      })
      .catch(() => !cancelled && setState((s) => ({ ...s, loading: false })))
    return () => {
      cancelled = true
    }
  }, [])
  return <TierCtx.Provider value={state}>{children}</TierCtx.Provider>
}

export function useTier(): Tier {
  return useContext(TierCtx)
}

export function ProGate({
  children,
  fallback,
}: {
  children: ReactNode
  fallback?: ReactNode
}) {
  const tier = useTier()
  if (tier.loading) return null
  if (tier.isPro) return <>{children}</>
  return (
    <>
      {fallback ?? (
        <Link
          href="/pricing"
          className="inline-flex items-center gap-2 rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium hover:bg-zinc-50"
        >
          <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white">
            Pro
          </span>
          Upgrade to unlock
        </Link>
      )}
    </>
  )
}
