import { drizzle, type NeonDatabase } from 'drizzle-orm/neon-serverless'
import { Pool, neonConfig } from '@neondatabase/serverless'
import ws from 'ws'
import * as schema from './schema'

// The order-creation flow needs interactive transactions (read stock, then
// conditionally deduct), so we use the WebSocket Pool driver rather than the
// HTTP driver. In the Node runtime we must supply a WebSocket implementation.
if (typeof globalThis.WebSocket === 'undefined') {
  neonConfig.webSocketConstructor = ws
}

// Lazily initialise so that importing this module (e.g. during `next build`)
// doesn't require DATABASE_URL — only an actual query does.
let instance: NeonDatabase<typeof schema> | null = null

function getDb(): NeonDatabase<typeof schema> {
  if (instance) return instance
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env.local and add your Neon connection string.'
    )
  }
  const pool = new Pool({ connectionString: url })
  instance = drizzle(pool, { schema })
  return instance
}

// A thin proxy so callers can use `db.select()` etc. directly while the real
// client is created on first use.
export const db = new Proxy({} as NeonDatabase<typeof schema>, {
  get(_target, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>
    const value = real[prop]
    return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(real) : value
  }
})

export { schema }
