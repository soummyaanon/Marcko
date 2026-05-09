// Vitest stub for `@/lib/auth`. The real module connects to Postgres at
// import time, which we want to avoid in unit tests for the pure helpers
// (sanitizers, hashers, crypto). Tests that hit the DB are out of scope here.

const notImplemented = (): never => {
  throw new Error(
    "auth.ts is mocked in tests; database access is not available. " +
      "Mock the specific function you need or write an integration test.",
  )
}

const queryStub = async () => {
  notImplemented()
}

export const authDbPool = {
  query: queryStub,
} as unknown as { query: (...args: unknown[]) => Promise<unknown> }

export const ensureAuthSchema = async (): Promise<void> => {}

export const auth = {
  api: {
    getSession: async () => null,
  },
} as const
