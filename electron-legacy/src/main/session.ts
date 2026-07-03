import type { User } from '../shared/types'

// The app runs as a single desktop instance, so the "logged-in" user lives in
// main-process memory. Role guards below protect Admin-only IPC handlers.

let currentUser: User | null = null

export function setCurrentUser(user: User | null): void {
  currentUser = user
}

export function getCurrentUser(): User | null {
  return currentUser
}

export function requireAuth(): User {
  if (!currentUser) throw new Error('Not signed in')
  return currentUser
}

export function requireAdmin(): User {
  const user = requireAuth()
  if (user.role !== 'admin') throw new Error('Admin permission required')
  return user
}
