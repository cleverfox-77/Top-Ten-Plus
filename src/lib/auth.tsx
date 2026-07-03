'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import type { User } from '@/lib/types'
import { api } from '@/lib/api'

interface AuthCtx {
  user: User | null
  loading: boolean
  isAdmin: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.auth
      .session()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const login = async (username: string, password: string): Promise<void> => {
    const u = await api.auth.login(username, password)
    setUser(u)
  }

  const logout = async (): Promise<void> => {
    await api.auth.logout()
    setUser(null)
  }

  return (
    <Ctx.Provider value={{ user, loading, isAdmin: user?.role === 'admin', login, logout }}>
      {children}
    </Ctx.Provider>
  )
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
