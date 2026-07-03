'use server'

import bcrypt from 'bcryptjs'
import { and, eq, ne, sql } from 'drizzle-orm'
import { db } from '@/db'
import { users } from '@/db/schema'
import { requireAdmin } from '@/lib/session'
import { userSchema } from '@/lib/validation'
import { run } from '@/lib/result'
import type { User } from '@/lib/types'

const publicCols = {
  id: users.id,
  name: users.name,
  username: users.username,
  role: users.role,
  active: users.active,
  created_at: users.created_at
}

export async function listUsers() {
  return run<User[]>(async () => {
    await requireAdmin()
    return db.select(publicCols).from(users).orderBy(users.name)
  })
}

export async function createUser(input: unknown) {
  return run<User>(async () => {
    await requireAdmin()
    const data = userSchema.parse(input)
    if (!data.password) throw new Error('A password is required for a new staff account')
    const [dupe] = await db.select({ id: users.id }).from(users).where(eq(users.username, data.username)).limit(1)
    if (dupe) throw new Error(`Username "${data.username}" is already taken`)

    const [row] = await db
      .insert(users)
      .values({
        name: data.name,
        username: data.username,
        password_hash: bcrypt.hashSync(data.password, 10),
        role: data.role
      })
      .returning(publicCols)
    return row
  })
}

export async function updateUser(id: number, input: unknown) {
  return run<User>(async () => {
    await requireAdmin()
    const data = userSchema.parse(input)
    const [clash] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.username, data.username), ne(users.id, id)))
      .limit(1)
    if (clash) throw new Error(`Username "${data.username}" is already taken`)

    const set: Record<string, unknown> = { name: data.name, username: data.username, role: data.role }
    if (data.password && data.password.length > 0) {
      set.password_hash = bcrypt.hashSync(data.password, 10)
    }
    const [row] = await db.update(users).set(set).where(eq(users.id, id)).returning(publicCols)
    return row
  })
}

export async function setUserActive(id: number, active: boolean) {
  return run<User>(async () => {
    const admin = await requireAdmin()
    if (admin.id === id && !active) throw new Error('You cannot deactivate your own account')
    if (!active) {
      const [target] = await db.select({ role: users.role }).from(users).where(eq(users.id, id)).limit(1)
      if (target?.role === 'admin') {
        const [{ count }] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(users)
          .where(and(eq(users.role, 'admin'), eq(users.active, true), ne(users.id, id)))
        if (Number(count) === 0) throw new Error('At least one active admin is required')
      }
    }
    const [row] = await db.update(users).set({ active }).where(eq(users.id, id)).returning(publicCols)
    return row
  })
}
