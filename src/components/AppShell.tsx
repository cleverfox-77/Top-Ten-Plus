'use client'

import { ReactNode } from 'react'
import { useAuth } from '@/lib/auth'
import { Spinner } from '@/components/ui'
import Login from '@/components/Login'
import Sidebar from '@/components/Sidebar'

export default function AppShell({ children }: { children: ReactNode }): JSX.Element {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner label="Loading…" />
      </div>
    )
  }

  if (!user) return <Login />

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl p-6">{children}</div>
      </main>
    </div>
  )
}
