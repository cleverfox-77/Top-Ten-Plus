import type { Metadata } from 'next'
import './globals.css'
import Providers from './providers'
import AppShell from '@/components/AppShell'

export const metadata: Metadata = {
  title: 'New Top Ten Plus — Tailoring POS',
  description: 'Order intake, fabric inventory and sales for New Top Ten Plus tailoring shop'
}

export default function RootLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <html lang="en">
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  )
}
