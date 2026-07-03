'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth'
import { Spinner } from '@/components/ui'

export default function Login(): JSX.Element {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login(username.trim(), password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-700 to-brand-900 p-6">
      <div className="card w-full max-w-md p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-2xl font-bold text-white">
            T
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Top Ten Plus</h1>
          <p className="text-sm text-gray-500">Tailors • Fabrics • Fashion</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Username</label>
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              placeholder="admin"
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? <Spinner /> : 'Sign in'}
          </button>
        </form>

        <div className="mt-6 rounded-lg bg-gray-50 p-3 text-center text-xs text-gray-500">
          Default accounts — <b>admin</b> / admin123 &nbsp;·&nbsp; <b>sales</b> / sales123
          <br />
          Change these under Staff after first login.
        </div>
      </div>
    </div>
  )
}
