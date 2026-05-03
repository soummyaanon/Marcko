// One-off runner for raw SQL files against the configured Postgres.
// Usage: node scripts/run-migration.mjs scripts/004_add_document_versions.sql
import fs from "node:fs"
import path from "node:path"
import pg from "pg"

const file = process.argv[2]
if (!file) {
  console.error("Usage: node scripts/run-migration.mjs <sql-file>")
  process.exit(1)
}

// Load .env without depending on dotenv: parse KEY=VALUE lines.
const envPath = path.resolve(process.cwd(), ".env")
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m) continue
    let value = m[2]
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[m[1]]) process.env[m[1]] = value
  }
}

const candidates = [
  process.env.BETTER_AUTH_DATABASE_URL,
  process.env.POSTGRES_URL,
  process.env.SUPABASE_DB_URL,
  process.env.DATABASE_URL,
]
const url = candidates.find((c) => {
  if (!c) return false
  try {
    const u = new URL(c)
    return u.protocol === "postgres:" || u.protocol === "postgresql:"
  } catch {
    return false
  }
})

if (!url) {
  console.error("No valid Postgres URL found in env.")
  process.exit(1)
}
console.log(`> using db host: ${new URL(url).hostname}`)

// Strip sslmode/ssl params from the URL so pg's connection-string parser
// doesn't override our explicit ssl option below.
const cleaned = (() => {
  try {
    const u = new URL(url)
    u.searchParams.delete("sslmode")
    u.searchParams.delete("ssl")
    return u.toString()
  } catch {
    return url
  }
})()

const sql = fs.readFileSync(path.resolve(process.cwd(), file), "utf8")

const client = new pg.Client({
  connectionString: cleaned,
  ssl: { rejectUnauthorized: false },
})

try {
  await client.connect()
  console.log(`> running ${file}`)
  const result = await client.query(sql)
  const results = Array.isArray(result) ? result : [result]
  for (const r of results) {
    console.log(`  ${r.command ?? "OK"}${r.rowCount != null ? ` (${r.rowCount} rows)` : ""}`)
    if (r.command === "SELECT" && r.rows && r.rows.length > 0) {
      for (const row of r.rows) console.log("   ", row)
    }
  }
  console.log("done.")
} catch (err) {
  console.error("Migration failed:", err.message)
  process.exitCode = 1
} finally {
  await client.end().catch(() => {})
}
