import "server-only"
import crypto from "node:crypto"

const REPLAY_WINDOW_SEC = 300

export type VerifyInput = {
  payload: string
  headerSignature: string | null
  secret: string
}

export function verifyDodoSignature({
  payload,
  headerSignature,
  secret,
}: VerifyInput): boolean {
  if (!headerSignature) return false
  const parts = Object.fromEntries(
    headerSignature.split(",").map((s) => {
      const i = s.indexOf("=")
      return i < 0 ? [s, ""] : [s.slice(0, i), s.slice(i + 1)]
    }),
  ) as Record<string, string>

  const ts = parts["t"]
  const sig = parts["v1"]
  if (!ts || !sig) return false

  const tsNum = Number(ts)
  if (!Number.isFinite(tsNum)) return false
  if (Math.abs(Math.floor(Date.now() / 1000) - tsNum) > REPLAY_WINDOW_SEC) return false

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${ts}.${payload}`)
    .digest("base64")

  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export type DodoEvent =
  | {
      type: "subscription.active" | "subscription.updated"
      data: {
        id: string
        customer_id: string
        current_period_end: string // ISO
        metadata?: { user_id?: string }
      }
    }
  | {
      type: "subscription.cancelled" | "subscription.expired"
      data: { id: string; customer_id: string; metadata?: { user_id?: string } }
    }

export type ApplyEvent = {
  userId: string
  newTier: "free" | "pro"
  newProUntil: string | null
  eventType: string
  dodoEventId: string
  raw: unknown
}

export function planFromEvent(
  event: DodoEvent,
  resolveUserId: (customerId: string) => Promise<string | null>,
  dodoEventId: string,
): Promise<ApplyEvent | null> {
  return (async () => {
    const userIdMeta = event.data.metadata?.user_id
    const userId = userIdMeta ?? (await resolveUserId(event.data.customer_id))
    if (!userId) return null

    switch (event.type) {
      case "subscription.active":
      case "subscription.updated":
        return {
          userId,
          newTier: "pro",
          newProUntil: event.data.current_period_end,
          eventType: event.type,
          dodoEventId,
          raw: redact(event),
        }
      case "subscription.cancelled":
      case "subscription.expired":
        return {
          userId,
          newTier: "free",
          newProUntil: null,
          eventType: event.type,
          dodoEventId,
          raw: redact(event),
        }
    }
  })()
}

function redact<T>(e: T): T {
  // Strip any obvious PII fields before persisting raw payload to audit log
  const clone = JSON.parse(JSON.stringify(e))
  if (clone?.data?.customer?.email) clone.data.customer.email = "[redacted]"
  return clone
}
