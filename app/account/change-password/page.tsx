'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { UserIcon } from 'lucide-react'

export default function ChangePasswordPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    // Verify the customer is authenticated before allowing access
    fetch('/api/auth/me', {
      credentials: 'include',
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            router.replace('/account/login')
          }
          throw new Error('Authentication required.')
        }
      })
      .catch(() => {
        router.replace('/account/login')
      })
      .finally(() => setLoading(false))
  }, [router])

  if (loading) return (
    <main className="mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-champagne-gold/15 text-champagne-gold">
          <UserIcon className="size-5" aria-hidden="true" />
        </div>
        <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
      </div>
    </main>
  )

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error((data as { message?: string })?.message || 'Unable to change password.')
      }
      router.replace('/account')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to change password.')
    } finally {
      setSubmitting(false)
    }
  }

  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0

  return (
    <main className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/account"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← My account
          </Link>
          <h1 className="mt-3 text-3xl font-semibold text-primary tracking-tight">
            Change password
          </h1>
          <p className="mt-2 text-muted-foreground">
            Update your account password.
          </p>
        </div>
      </div>

      {error && (
        <div role="alert" className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive shadow-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-8 rounded-[2rem] border border-border bg-card p-8 sm:p-10 shadow-sm">
        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              Current password
            </label>
            <div className="relative">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                minLength={1}
                maxLength={72}
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-border px-4 py-3 outline-none focus:ring-2 focus:ring-caramel pr-12"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-caramel transition-colors focus:outline-none focus:ring-2 focus:ring-caramel rounded-sm"
                aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
              >
                {showCurrentPassword ? (
                  <svg className="size-4" aria-hidden="true"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /></svg>
                ) : (
                  <svg className="size-4" aria-hidden="true"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z" /></svg>
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              New password
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={72}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-border px-4 py-3 outline-none focus:ring-2 focus:ring-caramel pr-12"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-caramel transition-colors focus:outline-none focus:ring-2 focus:ring-caramel rounded-sm"
                aria-label={showNewPassword ? 'Hide password' : 'Show password'}
              >
                {showNewPassword ? (
                  <svg className="size-4" aria-hidden="true"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /></svg>
                ) : (
                  <svg className="size-4" aria-hidden="true"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z" /></svg>
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              Confirm new password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={72}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-border px-4 py-3 outline-none focus:ring-2 focus:ring-caramel pr-12"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-caramel transition-colors focus:outline-none focus:ring-2 focus:ring-caramel rounded-sm"
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? (
                  <svg className="size-4" aria-hidden="true"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /></svg>
                ) : (
                  <svg className="size-4" aria-hidden="true"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z" /></svg>
                )}
              </button>
            </div>
            {!passwordsMatch && confirmPassword.length > 0 && (
              <p className="mt-1 text-xs text-destructive">Passwords do not match.</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Password must be at least 8 characters and include a letter and a number.
            </p>
          </div>

          <div className="mt-8 flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-caramel px-6 py-3.5 font-medium text-caramel-foreground shadow-sm hover:bg-caramel/90 disabled:opacity-60 transition-colors"
            >
              {submitting ? 'Changing…' : 'Change password'}
            </button>
            <Link
              href="/account"
              className="text-sm text-muted-foreground hover:underline"
            >
              Cancel
            </Link>
          </div>
        </div>
      </form>
    </main>
  )
}
