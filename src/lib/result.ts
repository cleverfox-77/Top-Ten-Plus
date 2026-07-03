// Server actions return a structured result rather than throwing, because Next.js
// scrubs thrown error messages in production. This preserves user-facing messages
// like "Not enough fabric in stock" while still being easy to consume on the client.

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string }

export async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
