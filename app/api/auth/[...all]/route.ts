import { toNextJsHandler } from "better-auth/next-js"

import { auth, ensureAuthSchema } from "@/lib/auth"

export const runtime = "nodejs"

const authHandler = toNextJsHandler(auth)

export async function GET(request: Request) {
  await ensureAuthSchema()
  return authHandler.GET(request)
}

export async function POST(request: Request) {
  await ensureAuthSchema()
  return authHandler.POST(request)
}
