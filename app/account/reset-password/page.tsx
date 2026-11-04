'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

async function readJsonSafe(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

export default function ResetPasswordPage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  async function handleReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!newPassword || newPassword.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newPassword,
          confirmPassword,
        }),
      })
      const data = await readJsonSafe(response)
      const message = (data as { message?: string })?.message
      if (!response.ok) {
        throw new Error(message || 'Unable to reset password.')
      }

      toast.success(message ? String(message) : 'Password reset successfully.')
      router.push('/account/login')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset password.')
      toast.error(err instanceof Error ? err.message : 'Unable to reset password.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-12 sm:px-6">
      <section className="rounded-[2rem] border border-border bg-card p-8 sm:p-10 shadow-sm">
        <p className="text-sm font-semibold text-primary tracking-wide uppercase">
          S.V. Bakery
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-primary tracking-tight">
          Reset your password
        </h1>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          Enter your new password below. Your reset code has already been verified.
        </p>

        {error && (
          <div role="alert" className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive shadow-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleReset} className="mt-8 space-y-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              New password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={72}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="••••••••"
                className={cn(
                  'mt-2 w-full rounded-xl border px-4 py-3.5 outline-none focus:ring-2 pr-10',
                  error ? 'border-destructive focus:ring-destructive' : 'border-border focus:ring-caramel',
                )}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3.5 text-xs text-muted-foreground hover:text-primary"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              Confirm password
            </label>
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={72}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="••••••••"
              className={cn(
                'mt-2 w-full rounded-xl border px-4 py-3.5 outline-none focus:ring-2',
                error ? 'border-destructive focus:ring-destructive' : 'border-border focus:ring-caramel',
              )}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-caramel px-6 py-4 font-semibold text-caramel-foreground shadow-sm hover:bg-caramel/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Resetting…' : 'Reset password'}
          </button>
        </form>

        <p className="mt-8 text-sm text-muted-foreground text-center">
          Remember your password?{' '}
          <Link
            className="font-medium text-caramel underline-offset-4 hover:underline"
            href="/account/login"
          >
            Sign in
          </Link>
        </p>
      </section>
    </main>
  )
}
