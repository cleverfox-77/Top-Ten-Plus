import bcrypt from 'bcryptjs'
import { getDb } from '../db/database'
import { requireAdmin } from '../session'
import { userSchema } from '../../shared/validation'
import type { User } from '../../shared/types'

export function listUsers(): User[] {
  requireAdmin()
  return getDb()
    .prepare('SELECT id, name, username, role, active, created_at FROM users ORDER BY name')
    .all() as User[]
}

export function createUser(input: unknown): User {
  requireAdmin()
  const data = userSchema.parse(input)
  if (!data.password) throw new Error('A password is required for a new staff account')
  const db = getDb()
  const dupe = db.prepare('SELECT id FROM users WHERE username = ?').get(data.username)
  if (dupe) throw new Error(`Username "${data.username}" is already taken`)

  const res = db
    .prepare('INSERT INTO users (name, username, password_hash, role) VALUES (?, ?, ?, ?)')
    .run(data.name, data.username, bcrypt.hashSync(data.password, 10), data.role)
  return db
    .prepare('SELECT id, name, username, role, active, created_at FROM users WHERE id = ?')
    .get(Number(res.lastInsertRowid)) as User
}

export function updateUser(id: number, input: unknown): User {
  requireAdmin()
  const data = userSchema.parse(input)
  const db = getDb()
  const clash = db
    .prepare('SELECT id FROM users WHERE username = ? AND id <> ?')
    .get(data.username, id) as { id: number } | undefined
  if (clash) throw new Error(`Username "${data.username}" is already taken`)

  if (data.password && data.password.length > 0) {
    db.prepare('UPDATE users SET name = ?, username = ?, role = ?, password_hash = ? WHERE id = ?').run(
      data.name,
      data.username,
      data.role,
      bcrypt.hashSync(data.password, 10),
      id
    )
  } else {
    db.prepare('UPDATE users SET name = ?, username = ?, role = ? WHERE id = ?').run(
      data.name,
      data.username,
      data.role,
      id
    )
  }
  return db
    .prepare('SELECT id, name, username, role, active, created_at FROM users WHERE id = ?')
    .get(id) as User
}

export function setUserActive(id: number, active: boolean): User {
  const admin = requireAdmin()
  if (admin.id === id && !active) throw new Error('You cannot deactivate your own account')
  const db = getDb()
  if (!active) {
    const remaining = db
      .prepare("SELECT COUNT(*) AS c FROM users WHERE role='admin' AND active=1 AND id <> ?")
      .get(id) as { c: number }
    const target = db.prepare('SELECT role FROM users WHERE id = ?').get(id) as
      | { role: string }
      | undefined
    if (target?.role === 'admin' && remaining.c === 0) {
      throw new Error('At least one active admin is required')
    }
  }
  db.prepare('UPDATE users SET active = ? WHERE id = ?').run(active ? 1 : 0, id)
  return db
    .prepare('SELECT id, name, username, role, active, created_at FROM users WHERE id = ?')
    .get(id) as User
}
