import 'server-only'
import { cookies } from 'next/headers'
import crypto from 'crypto'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { users } from '@/db/schema'
import type { User } from '@/lib/types'

// Two fixed roles, no self-signup — a signed session cookie is enough (plan §1).
const COOKIE = 'ttp_session'
const MAX_AGE = 60 * 60 * 24 * 30 // 30 days

function secret(): string {
  return process.env.SESSION_SECRET || 'dev-insecure-secret-change-me'
}

function sign(value: string): string {
  const mac = crypto.createHmac('sha256', secret()).update(value).digest('hex')
  return `${value}.${mac}`
}

function unsign(signed: string): string | null {
  const idx = signed.lastIndexOf('.')
  if (idx < 0) return null
  const value = signed.slice(0, idx)
  const mac = signed.slice(idx + 1)
  const expected = crypto.createHmac('sha256', secret()).update(value).digest('hex')
  const a = Buffer.from(mac)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  return value
}

export function setSession(userId: number): void {
  cookies().set(COOKIE, sign(String(userId)), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE
  })
}

export function clearSession(): void {
  cookies().delete(COOKIE)
}

export async function getCurrentUser(): Promise<User | null> {
  const raw = cookies().get(COOKIE)?.value
  if (!raw) return null
  const value = unsign(raw)
  if (!value) return null
  const id = Number(value)
  if (!Number.isInteger(id)) return null

  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      role: users.role,
      active: users.active,
      created_at: users.created_at
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1)

  if (!row || !row.active) return null
  return row
}

export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Not signed in')
  return user
}

export async function requireAdmin(): Promise<User> {
  const user = await requireAuth()
  if (user.role !== 'admin') throw new Error('Admin permission required')
  return user
}
