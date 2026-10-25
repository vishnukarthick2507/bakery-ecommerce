'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (mode === 'register') {
      if (!/^[6-9]\d{9}$/.test(phone)) {
        setError('Enter a valid 10-digit Indian mobile number.')
        return
      }
      if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
        setError('Password must be at least 8 characters and include a letter and a number.')
        return
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.')
        return
      }
    }

    setSubmitting(true)
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || ''
      const response = await fetch(
        `${apiBase}/api/auth/${mode === 'register' ? 'register' : 'customer/login'}`,
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
      <section className="rounded-xl border bg-background p-6 sm:p-8">
        <p className="text-sm font-semibold text-primary">THE CAKE POINT</p>
        <h1 className="mt-2 text-3xl font-semibold">
          {mode === 'register' ? 'Create your account' : 'Customer sign in'}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === 'register'
            ? 'Keep your account details and orders together.'
            : 'Sign in to view your account and order history.'}
        </p>

        {error && (
          <div role="alert" className="mt-5 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {mode === 'register' && (
            <label className="block text-sm font-medium">
              Full name
              <input
                autoComplete="name"
                required
                minLength={2}
                maxLength={100}
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-2 w-full rounded-lg border bg-background px-4 py-3 outline-none focus:ring-2"
              />
            </label>
          )}
          <label className="block text-sm font-medium">
            Email
            <input
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-lg border bg-background px-4 py-3 outline-none focus:ring-2"
            />
          </label>
          {mode === 'register' && (
            <label className="block text-sm font-medium">
              Indian mobile number
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                required
                minLength={10}
                maxLength={10}
                pattern="[6-9][0-9]{9}"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="mt-2 w-full rounded-lg border bg-background px-4 py-3 outline-none focus:ring-2"
              />
            </label>
          )}
          <label className="block text-sm font-medium">
            Password
            <input
              type="password"
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              required
              minLength={mode === 'register' ? 8 : undefined}
              maxLength={72}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-lg border bg-background px-4 py-3 outline-none focus:ring-2"
            />
          </label>
          {mode === 'register' && (
            <label className="block text-sm font-medium">
              Confirm password
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={72}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="mt-2 w-full rounded-lg border bg-background px-4 py-3 outline-none focus:ring-2"
              />
            </label>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-60"
          >
            {submitting ? 'Please wait...' : mode === 'register' ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <p className="mt-5 text-sm text-muted-foreground">
          {mode === 'register' ? 'Already have an account?' : 'New to THE CAKE POINT?'}{' '}
          <Link
            className="font-medium text-primary underline-offset-4 hover:underline"
            href={mode === 'register' ? '/account/login' : '/account/register'}
          >
            {mode === 'register' ? 'Sign in' : 'Create an account'}
          </Link>
        </p>
      </section>
    </main>
  )
}