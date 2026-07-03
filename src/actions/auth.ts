'use server'

import bcrypt from 'bcryptjs'
import { eq, and } from 'drizzle-orm'
import { db } from '@/db'
import { users } from '@/db/schema'
import { setSession, clearSession, getCurrentUser } from '@/lib/session'
import { loginSchema } from '@/lib/validation'
import { run } from '@/lib/result'
import type { User } from '@/lib/types'

export async function loginAction(input: unknown) {
  return run<User>(async () => {
    const { username, password } = loginSchema.parse(input)
    const [row] = await db
      .select()
      .from(users)
      .where(and(eq(users.username, username), eq(users.active, true)))
      .limit(1)

    if (!row || !bcrypt.compareSync(password, row.password_hash)) {
      throw new Error('Invalid username or password')
    }
    setSession(row.id)
    const { password_hash, ...user } = row
    return user
  })
}

export async function logoutAction() {
  return run<null>(async () => {
    clearSession()
    return null
  })
}

export async function sessionAction() {
  return run<User | null>(async () => getCurrentUser())
}
