'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/lib/utils'

type AuthMode = 'login' | 'register'

export function CustomerAuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<'name' | 'email' | 'phone' | 'password' | 'confirmPassword', string>>>({})

  const clearFieldError = (field: keyof typeof fieldErrors) => {
    setFieldErrors((prev) => {
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setFieldErrors({})

    const nextFieldErrors: Partial<Record<'name' | 'email' | 'phone' | 'password' | 'confirmPassword', string>> = {}
    let hasError = false

    if (mode === 'register') {
      if (!name.trim() || name.trim().length < 2) {
        nextFieldErrors.name = 'Please enter your full name.'
        hasError = true
      } else {
        clearFieldError('name')
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        nextFieldErrors.email = 'Enter a valid email address.'
        hasError = true
      } else {
        clearFieldError('email')
      }

      if (!/^[6-9]\d{9}$/.test(phone)) {
        nextFieldErrors.phone = 'Enter a valid 10-digit Indian mobile number.'
        hasError = true
      } else {
        clearFieldError('phone')
      }

      if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
        nextFieldErrors.password = 'Password must be at least 8 characters with a letter and a number.'
        hasError = true
      } else {
        clearFieldError('password')
      }

      if (password !== confirmPassword) {
        nextFieldErrors.confirmPassword = 'Passwords do not match.'
        hasError = true
      } else {
        clearFieldError('confirmPassword')
      }
    } else {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        nextFieldErrors.email = 'Enter a valid email address.'
        hasError = true
      } else {
        clearFieldError('email')
      }

      if (!password) {
        nextFieldErrors.password = 'Please enter your password.'
        hasError = true
      } else {
        clearFieldError('password')
      }
    }

    if (hasError) {
      setFieldErrors(nextFieldErrors)
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(
        `/api/auth/${mode === 'register' ? 'register' : 'customer/login'}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...(mode === 'register' ? { name: name.trim(), phone } : {}),
            email: email.trim().toLowerCase(),
            password,
          }),
        },
      )
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.message || 'Unable to authenticate.')
      }
      window.localStorage.setItem('customer-token', data.token)
      router.push('/account')
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Unable to authenticate.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-12 sm:px-6">
      <section className="rounded-xl border border-border bg-white p-6 sm:p-8 shadow-sm">
        <p className="text-sm font-semibold text-primary">S.V. Bakery</p>
        <h1 className="mt-2 text-3xl font-semibold text-primary">
          {mode === 'register' ? 'Create your account' : 'Customer sign in'}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === 'register'
            ? 'Keep your account details and orders together.'
            : 'Sign in to view your account and order history.'}
        </p>

        {error && (
          <div role="alert" className="mt-5 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {mode === 'register' && (
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                Full name
              </label>
              {fieldErrors.name && (
                <p className="mb-2 text-xs text-destructive">
                  {fieldErrors.name}
                </p>
              )}
              <input
                autoComplete="name"
                required
                minLength={2}
                maxLength={100}
                value={name}
                onChange={(event) => {
                  setName(event.target.value)
                  clearFieldError('name')
                }}
                placeholder="Priya"
                className={cn(
                  'mt-2 w-full rounded-lg border px-4 py-3 outline-none focus:ring-2',
                  fieldErrors.name
                    ? 'border-destructive focus:ring-destructive'
                    : 'border-border focus:ring-primary',
                )}
              />
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              Email
            </label>
            {fieldErrors.email && (
              <p className="mb-2 text-xs text-destructive">
                {fieldErrors.email}
              </p>
            )}
            <input
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(event) => {
                setEmail(event.target.value)
                clearFieldError('email')
              }}
              placeholder="priya@example.com"
              className={cn(
                'mt-2 w-full rounded-lg border px-4 py-3 outline-none focus:ring-2',
                fieldErrors.email
                  ? 'border-destructive focus:ring-destructive'
                  : 'border-border focus:ring-primary',
              )}
            />
          </div>

          {mode === 'register' && (
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                Indian mobile number
              </label>
              {fieldErrors.phone && (
                <p className="mb-2 text-xs text-destructive">
                  {fieldErrors.phone}
                </p>
              )}
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                required
                minLength={10}
                maxLength={10}
                pattern="[6-9][0-9]{9}"
                value={phone}
                onChange={(event) => {
                  setPhone(event.target.value)
                  clearFieldError('phone')
                }}
                placeholder="9840916058"
                className={cn(
                  'mt-2 w-full rounded-lg border px-4 py-3 outline-none focus:ring-2',
                  fieldErrors.phone
                    ? 'border-destructive focus:ring-destructive'
                    : 'border-border focus:ring-primary',
                )}
              />
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              Password
            </label>
            {fieldErrors.password && (
              <p className="mb-2 text-xs text-destructive">
                {fieldErrors.password}
              </p>
            )}
            <input
              type="password"
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              required
              minLength={mode === 'register' ? 8 : undefined}
              maxLength={72}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                clearFieldError('password')
              }}
              placeholder="••••••••"
              className={cn(
                'mt-2 w-full rounded-lg border px-4 py-3 outline-none focus:ring-2',
                fieldErrors.password
                  ? 'border-destructive focus:ring-destructive'
                  : 'border-border focus:ring-primary',
              )}
            />
          </div>

          {mode === 'register' && (
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                Confirm password
              </label>
              {fieldErrors.confirmPassword && (
                <p className="mb-2 text-xs text-destructive">
                  {fieldErrors.confirmPassword}
                </p>
              )}
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={72}
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value)
                  clearFieldError('confirmPassword')
                }}
                placeholder="••••••••"
                className={cn(
                  'mt-2 w-full rounded-lg border px-4 py-3 outline-none focus:ring-2',
                  fieldErrors.confirmPassword
                    ? 'border-destructive focus:ring-destructive'
                    : 'border-border focus:ring-primary',
                )}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-60 hover:opacity-90"
          >
            {submitting ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-sm text-muted-foreground">
          {mode === 'register' ? 'Already have an account?' : 'New to S.V. Bakery?'}{' '}
          {mode === 'register' ? (
            <Link
              className="font-medium text-primary underline-offset-4 hover:underline"
              href="/account/login"
            >
              Sign in
            </Link>
          ) : (
            <Link
              className="font-medium text-primary underline-offset-4 hover:underline"
              href="/account/register"
            >
              Create an account
            </Link>
          )}
        </p>
      </section>
    </main>
  )
}
