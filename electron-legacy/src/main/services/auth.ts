import bcrypt from 'bcryptjs'
import { getDb } from '../db/database'
import { setCurrentUser, getCurrentUser } from '../session'
import { loginSchema } from '../../shared/validation'
import type { User } from '../../shared/types'

interface UserRow extends User {
  password_hash: string
}

function toUser(row: UserRow): User {
  const { password_hash, ...user } = row
  return user
}

export function login(input: unknown): User {
  const { username, password } = loginSchema.parse(input)
  const db = getDb()
  const row = db
    .prepare('SELECT * FROM users WHERE username = ? AND active = 1')
    .get(username) as UserRow | undefined

  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    throw new Error('Invalid username or password')
  }
  const user = toUser(row)
  setCurrentUser(user)
  return user
}

export function logout(): void {
  setCurrentUser(null)
}

export function getSession(): User | null {
  return getCurrentUser()
}
