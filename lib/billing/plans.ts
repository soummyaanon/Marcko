import "server-only"

export type QuotaKind =
  | "inline_edit"
  // Reserved for Phase 2-5 — not yet enforced. Listed here so the type
  // is stable; quota wrappers gate only what they're invoked for.
  | "library_chat"
  | "shared_doc_chat"
  | "feedback_digest"
  | "agent_run"

export const PRO_MONTHLY_QUOTAS: Record<QuotaKind, number> = {
  inline_edit: 500,
  library_chat: 200,
  shared_doc_chat: 1_000,
  feedback_digest: 30,
  agent_run: 100,
}

export const FREE_MONTHLY_QUOTAS: Record<QuotaKind, number> = {
  inline_edit: 10,
  library_chat: 0,
  shared_doc_chat: 0,
  feedback_digest: 0,
  agent_run: 0,
}
