'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function AdminLoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      let data
      const contentType = response.headers.get('content-type')
      if (contentType && contentType.includes('application/json')) {
        data = await response.json()
      } else {
        const text = await response.text()
        throw new Error(`Server returned non-JSON response. Status: ${response.status}. Is the backend running at http://localhost:5000?`)
      }

      if (!response.ok) {
        throw new Error(data.message || 'Login failed')
      }

      // The server sets the httpOnly admin-token cookie (single source of
      // truth). No localStorage or document.cookie is used client-side.
      router.push('/admin')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/20 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-primary">Admin Login</h1>
          <p className="mt-2 text-muted-foreground">S.V. Bakery Admin</p>
        </div>

        <div className="rounded-xl border border-border bg-white p-8 shadow-sm">
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className="mt-2 w-full rounded-lg border border-border bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="mt-2 w-full rounded-lg border border-border bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>

            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60 hover:opacity-90"
            >
              {loading ? 'Logging in…' : 'Login'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/"
              className="text-sm text-muted-foreground hover:underline"
            >
              ← Back to store
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
