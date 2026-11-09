'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CakeIcon } from 'lucide-react'

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
    <main className="flex min-h-screen items-center justify-center bg-cream/30 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-caramel text-caramel-foreground mx-auto mb-4 shadow-sm">
            <CakeIcon className="size-6" aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-bold text-primary tracking-tight">
            Admin Login
          </h1>
          <p className="mt-2 text-muted-foreground">Bluebell Bakehouse Admin</p>
        </div>

        <div className="rounded-[2rem] border border-border bg-card p-8 shadow-sm">
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3.5 outline-none focus:ring-2 focus:ring-caramel"
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
                className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3.5 outline-none focus:ring-2 focus:ring-caramel"
                required
              />
            </div>

            {error && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-caramel px-6 py-4 font-semibold text-caramel-foreground shadow-sm hover:bg-caramel/90 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
            >
              {loading ? 'Logging in…' : 'Login'}
            </button>
          </form>

          <div className="mt-8 text-center">
            <Link
              href="/"
              className="text-sm text-caramel hover:underline font-medium"
            >
              ← Back to store
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
