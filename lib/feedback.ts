import "server-only"

import { createHash, randomBytes } from "node:crypto"

import { authDbPool } from "@/lib/auth"

const PUBLIC_KEY_PREFIX = "fb_"
const PUBLIC_KEY_BYTES = 18

const toBase64Url = (buf: Buffer) =>
  buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")

export const hashIp = (ip: string): string =>
  createHash("sha256").update(ip).digest("hex").slice(0, 32)

export type FeedbackQuestionType = "short_text" | "long_text" | "rating" | "single_choice"

export type FeedbackQuestion = {
  id: string
  type: FeedbackQuestionType
  label: string
  required?: boolean
  placeholder?: string
  options?: string[]
}

const QUESTION_TYPES: ReadonlySet<FeedbackQuestionType> = new Set([
  "short_text",
  "long_text",
  "rating",
  "single_choice",
])

export const sanitizeQuestions = (input: unknown): FeedbackQuestion[] => {
  if (!Array.isArray(input)) return []
  const result: FeedbackQuestion[] = []
  for (const raw of input.slice(0, 12)) {
    if (!raw || typeof raw !== "object") continue
    const r = raw as Record<string, unknown>
    const type = typeof r.type === "string" && QUESTION_TYPES.has(r.type as FeedbackQuestionType)
      ? (r.type as FeedbackQuestionType)
      : "short_text"
    const label = typeof r.label === "string" ? r.label.trim().slice(0, 240) : ""
    if (!label) continue
    const id =
      typeof r.id === "string" && r.id.trim().length > 0 && r.id.length <= 64
        ? r.id.trim()
        : toBase64Url(randomBytes(6))
    const placeholder =
      typeof r.placeholder === "string" ? r.placeholder.trim().slice(0, 160) : undefined
    const required = r.required === true
    let options: string[] | undefined
    if (type === "single_choice" && Array.isArray(r.options)) {
      options = r.options
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
        .slice(0, 8)
    }
    result.push({ id, type, label, required, placeholder, options })
  }
  return result
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

export const sanitizeAccent = (input: unknown): string => {
  if (typeof input === "string" && HEX_COLOR.test(input)) return input
  return "#111111"
}

export type FeedbackWidgetRow = {
  id: string
  publicKey: string
  name: string
  questions: FeedbackQuestion[]
  triggerLabel: string
  accent: string
  createdAt: string
  updatedAt: string
}

export type FeedbackWidgetWithCounts = FeedbackWidgetRow & {
  responseCount: number
  lastResponseAt: string | null
}

export type FeedbackResponseRow = {
  id: string
  widgetId: string
  answers: Record<string, unknown>
  pageUrl: string | null
  userAgent: string | null
  submittedAt: string
}

let feedbackSchemaPromise: Promise<void> | null = null

export const ensureFeedbackSchema = async (): Promise<void> => {
  if (!feedbackSchemaPromise) {
    feedbackSchemaPromise = (async () => {
      await authDbPool.query(`
        CREATE TABLE IF NOT EXISTS feedback_widgets (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          public_key TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          questions JSONB NOT NULL DEFAULT '[]'::jsonb,
          trigger_label TEXT NOT NULL DEFAULT 'Feedback',
          accent TEXT NOT NULL DEFAULT '#111111',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `)
      await authDbPool.query(
        `CREATE INDEX IF NOT EXISTS idx_feedback_widgets_user ON feedback_widgets (user_id, created_at DESC);`,
      )

      await authDbPool.query(`
        CREATE TABLE IF NOT EXISTS feedback_responses (
          id TEXT PRIMARY KEY,
          widget_id TEXT NOT NULL REFERENCES feedback_widgets(id) ON DELETE CASCADE,
          answers JSONB NOT NULL DEFAULT '{}'::jsonb,
          page_url TEXT,
          user_agent TEXT,
          ip_hash TEXT,
          submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `)
      await authDbPool.query(
        `CREATE INDEX IF NOT EXISTS idx_feedback_responses_widget ON feedback_responses (widget_id, submitted_at DESC);`,
      )
      await authDbPool.query(
        `CREATE INDEX IF NOT EXISTS idx_feedback_responses_ip_recent ON feedback_responses (widget_id, ip_hash, submitted_at DESC);`,
      )
    })().catch((error) => {
      feedbackSchemaPromise = null
      throw error
    })
  }
  return feedbackSchemaPromise
}

const generateWidgetId = (): string => toBase64Url(randomBytes(9))
const generatePublicKey = (): string =>
  `${PUBLIC_KEY_PREFIX}${toBase64Url(randomBytes(PUBLIC_KEY_BYTES))}`

const toIso = (value: unknown): string =>
  value instanceof Date ? value.toISOString() : String(value ?? "")

const rowToWidget = (row: Record<string, unknown>): FeedbackWidgetRow => ({
  id: String(row.id),
  publicKey: String(row.public_key),
  name: String(row.name),
  questions: sanitizeQuestions(row.questions ?? []),
  triggerLabel: typeof row.trigger_label === "string" ? row.trigger_label : "Feedback",
  accent: sanitizeAccent(row.accent),
  createdAt: toIso(row.created_at),
  updatedAt: toIso(row.updated_at),
})

export const createFeedbackWidget = async (args: {
  userId: string
  name: string
  questions?: FeedbackQuestion[]
  triggerLabel?: string
  accent?: string
}): Promise<FeedbackWidgetRow> => {
  await ensureFeedbackSchema()
  const id = generateWidgetId()
  const publicKey = generatePublicKey()
  const name = args.name.trim().slice(0, 80) || "Untitled widget"
  const questions = sanitizeQuestions(args.questions ?? defaultQuestions())
  const triggerLabel =
    typeof args.triggerLabel === "string" && args.triggerLabel.trim().length > 0
      ? args.triggerLabel.trim().slice(0, 40)
      : "Feedback"
  const accent = sanitizeAccent(args.accent)

  const result = await authDbPool.query(
    `
    INSERT INTO feedback_widgets (id, user_id, public_key, name, questions, trigger_label, accent)
    VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
    RETURNING id, public_key, name, questions, trigger_label, accent, created_at, updated_at
    `,
    [id, args.userId, publicKey, name, JSON.stringify(questions), triggerLabel, accent],
  )
  return rowToWidget(result.rows[0])
}

export const listFeedbackWidgets = async (
  userId: string,
): Promise<FeedbackWidgetWithCounts[]> => {
  await ensureFeedbackSchema()
  const result = await authDbPool.query(
    `
    SELECT w.id, w.public_key, w.name, w.questions, w.trigger_label, w.accent, w.created_at, w.updated_at,
           COALESCE(r.count, 0)::int AS response_count,
           r.last_at AS last_response_at
    FROM feedback_widgets w
    LEFT JOIN (
      SELECT widget_id, COUNT(*) AS count, MAX(submitted_at) AS last_at
      FROM feedback_responses
      GROUP BY widget_id
    ) r ON r.widget_id = w.id
    WHERE w.user_id = $1
    ORDER BY w.created_at DESC
    `,
    [userId],
  )
  return result.rows.map((row) => ({
    ...rowToWidget(row),
    responseCount: Number(row.response_count ?? 0),
    lastResponseAt: row.last_response_at ? toIso(row.last_response_at) : null,
  }))
}

export const getFeedbackWidgetForOwner = async (
  userId: string,
  widgetId: string,
): Promise<FeedbackWidgetRow | null> => {
  await ensureFeedbackSchema()
  const result = await authDbPool.query(
    `
    SELECT id, public_key, name, questions, trigger_label, accent, created_at, updated_at
    FROM feedback_widgets
    WHERE id = $1 AND user_id = $2
    LIMIT 1
    `,
    [widgetId, userId],
  )
  if (result.rowCount === 0) return null
  return rowToWidget(result.rows[0])
}

export const getFeedbackWidgetByPublicKey = async (
  publicKey: string,
): Promise<FeedbackWidgetRow | null> => {
  await ensureFeedbackSchema()
  const result = await authDbPool.query(
    `
    SELECT id, public_key, name, questions, trigger_label, accent, created_at, updated_at
    FROM feedback_widgets
    WHERE public_key = $1
    LIMIT 1
    `,
    [publicKey],
  )
  if (result.rowCount === 0) return null
  return rowToWidget(result.rows[0])
}

export const updateFeedbackWidget = async (args: {
  userId: string
  widgetId: string
  name?: string
  questions?: FeedbackQuestion[]
  triggerLabel?: string
  accent?: string
}): Promise<FeedbackWidgetRow | null> => {
  await ensureFeedbackSchema()
  const sets: string[] = []
  const values: unknown[] = []
  let p = 1
  if (typeof args.name === "string") {
    sets.push(`name = $${p++}`)
    values.push(args.name.trim().slice(0, 80) || "Untitled widget")
  }
  if (Array.isArray(args.questions)) {
    sets.push(`questions = $${p++}::jsonb`)
    values.push(JSON.stringify(sanitizeQuestions(args.questions)))
  }
  if (typeof args.triggerLabel === "string") {
    const trimmed = args.triggerLabel.trim().slice(0, 40)
    sets.push(`trigger_label = $${p++}`)
    values.push(trimmed.length > 0 ? trimmed : "Feedback")
  }
  if (typeof args.accent === "string") {
    sets.push(`accent = $${p++}`)
    values.push(sanitizeAccent(args.accent))
  }
  if (sets.length === 0) {
    return getFeedbackWidgetForOwner(args.userId, args.widgetId)
  }
  sets.push(`updated_at = NOW()`)
  values.push(args.widgetId, args.userId)

  const result = await authDbPool.query(
    `
    UPDATE feedback_widgets
    SET ${sets.join(", ")}
    WHERE id = $${p++} AND user_id = $${p++}
    RETURNING id, public_key, name, questions, trigger_label, accent, created_at, updated_at
    `,
    values,
  )
  if (result.rowCount === 0) return null
  return rowToWidget(result.rows[0])
}

export const deleteFeedbackWidget = async (
  userId: string,
  widgetId: string,
): Promise<boolean> => {
  await ensureFeedbackSchema()
  const result = await authDbPool.query(
    `DELETE FROM feedback_widgets WHERE id = $1 AND user_id = $2`,
    [widgetId, userId],
  )
  return (result.rowCount ?? 0) > 0
}

export const listFeedbackResponses = async (args: {
  userId: string
  widgetId: string
  limit?: number
}): Promise<FeedbackResponseRow[]> => {
  await ensureFeedbackSchema()
  const limit = Math.min(Math.max(args.limit ?? 100, 1), 500)
  const result = await authDbPool.query(
    `
    SELECT r.id, r.widget_id, r.answers, r.page_url, r.user_agent, r.submitted_at
    FROM feedback_responses r
    INNER JOIN feedback_widgets w ON w.id = r.widget_id
    WHERE r.widget_id = $1 AND w.user_id = $2
    ORDER BY r.submitted_at DESC
    LIMIT $3
    `,
    [args.widgetId, args.userId, limit],
  )
  return result.rows.map((row) => ({
    id: String(row.id),
    widgetId: String(row.widget_id),
    answers: (row.answers ?? {}) as Record<string, unknown>,
    pageUrl: row.page_url ? String(row.page_url) : null,
    userAgent: row.user_agent ? String(row.user_agent) : null,
    submittedAt: toIso(row.submitted_at),
  }))
}

export const RATE_LIMIT_WINDOW_MS = 60_000
export const RATE_LIMIT_MAX = 5

export const isRateLimited = async (args: {
  widgetId: string
  ipHash: string
}): Promise<boolean> => {
  const result = await authDbPool.query(
    `
    SELECT COUNT(*)::int AS recent
    FROM feedback_responses
    WHERE widget_id = $1 AND ip_hash = $2
      AND submitted_at > NOW() - INTERVAL '60 seconds'
    `,
    [args.widgetId, args.ipHash],
  )
  return Number(result.rows[0]?.recent ?? 0) >= RATE_LIMIT_MAX
}

export const recordFeedbackResponse = async (args: {
  widgetId: string
  answers: Record<string, unknown>
  pageUrl?: string | null
  userAgent?: string | null
  ipHash?: string | null
}): Promise<FeedbackResponseRow> => {
  await ensureFeedbackSchema()
  const id = toBase64Url(randomBytes(12))
  const result = await authDbPool.query(
    `
    INSERT INTO feedback_responses (id, widget_id, answers, page_url, user_agent, ip_hash)
    VALUES ($1, $2, $3::jsonb, $4, $5, $6)
    RETURNING id, widget_id, answers, page_url, user_agent, submitted_at
    `,
    [
      id,
      args.widgetId,
      JSON.stringify(args.answers ?? {}),
      args.pageUrl ? String(args.pageUrl).slice(0, 500) : null,
      args.userAgent ? String(args.userAgent).slice(0, 400) : null,
      args.ipHash ?? null,
    ],
  )
  const row = result.rows[0]
  return {
    id: String(row.id),
    widgetId: String(row.widget_id),
    answers: (row.answers ?? {}) as Record<string, unknown>,
    pageUrl: row.page_url ? String(row.page_url) : null,
    userAgent: row.user_agent ? String(row.user_agent) : null,
    submittedAt: toIso(row.submitted_at),
  }
}

export const sanitizeAnswers = (
  questions: FeedbackQuestion[],
  raw: unknown,
): { ok: true; answers: Record<string, unknown> } | { ok: false; reason: string } => {
  if (!raw || typeof raw !== "object") {
    return { ok: false, reason: "answers must be an object" }
  }
  const input = raw as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const q of questions) {
    const value = input[q.id]
    const has = value !== undefined && value !== null && value !== ""
    if (q.required && !has) {
      return { ok: false, reason: `Missing answer for "${q.label}"` }
    }
    if (!has) continue
    if (q.type === "rating") {
      const n = Number(value)
      if (!Number.isFinite(n) || n < 1 || n > 5) {
        return { ok: false, reason: `"${q.label}" must be a number 1–5` }
      }
      out[q.id] = Math.round(n)
    } else if (q.type === "single_choice") {
      const v = String(value).slice(0, 240)
      if (q.options && q.options.length > 0 && !q.options.includes(v)) {
        return { ok: false, reason: `"${q.label}" has an invalid choice` }
      }
      out[q.id] = v
    } else if (q.type === "long_text") {
      out[q.id] = String(value).slice(0, 4000)
    } else {
      out[q.id] = String(value).slice(0, 600)
    }
  }
  return { ok: true, answers: out }
}

export const defaultQuestions = (): FeedbackQuestion[] => [
  {
    id: "rating",
    type: "rating",
    label: "How would you rate your experience?",
    required: true,
  },
  {
    id: "comment",
    type: "long_text",
    label: "What could we improve?",
    placeholder: "Tell us more (optional)",
    required: false,
  },
]
