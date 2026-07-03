'use client'

import { ReactNode } from 'react'
import { ToastProvider } from '@/lib/toast'
import { AuthProvider } from '@/lib/auth'

export default function Providers({ children }: { children: ReactNode }): JSX.Element {
  return (
    <ToastProvider>
      <AuthProvider>{children}</AuthProvider>
    </ToastProvider>
  )
}
