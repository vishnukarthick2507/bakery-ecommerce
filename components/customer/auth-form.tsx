'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/lib/utils'

type AuthMode = 'login' | 'register'

type OtpStep = 'enter' | 'verify'

export function CustomerAuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter()
  const [step, setStep] = useState<OtpStep>('enter')
  const [identifier, setIdentifier] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const purpose = mode === 'login' ? 'LOGIN' : 'REGISTER'

  async function handleSendOtp(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const response = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: identifier.trim().toLowerCase(),
          purpose,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Unable to send OTP')
      }

      setStep('verify')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send OTP')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleVerifyOtp(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const response = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: identifier.trim().toLowerCase(),
          otp: otp.trim(),
          purpose,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Invalid or expired OTP')
      }

      window.localStorage.setItem('customer-token', data.token)
      router.push('/account')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid or expired OTP')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-12 sm:px-6">
      <section className="rounded-xl border border-border bg-white p-6 sm:p-8 shadow-sm">
        <p className="text-sm font-semibold text-primary">S.V. Bakery</p>
        <h1 className="mt-2 text-3xl font-semibold text-primary">
          {mode === 'login' ? 'Customer sign in' : 'Create your account'}
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

        <form onSubmit={step === 'enter' ? handleSendOtp : handleVerifyOtp} className="mt-6 space-y-5">
          {/* Step 1: Enter email or phone */}
          {step === 'enter' && (
            <>
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  Email or phone number
                </label>
                <input
                  type="text"
                  autoComplete="email"
                  required
                  maxLength={254}
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  placeholder="you@example.com or 9840916058"
                  className="mt-2 w-full rounded-lg border px-4 py-3 outline-none focus:ring-2"
                />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                We&apos;ll send a 6-digit code to verify your identity.
              </p>
              <button
                type="submit"
                disabled={submitting || !identifier.trim()}
                className="w-full rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-60 hover:opacity-90"
              >
                {submitting ? 'Sending…' : 'Send OTP'}
              </button>
            </>
          )}

          {/* Step 2: Verify OTP */}
          {step === 'verify' && (
            <>
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  Enter 6-digit code
                </label>
                <input
                  type="text"
                  autoComplete="otp"
                  required
                  maxLength={6}
                  value={otp}
                  onChange={(event) => setOtp(event.target.value)}
                  placeholder="123456"
                  className="mt-2 w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 text-center text-lg font-mono"
                />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Code sent to {identifier}
              </p>
              <button
                type="submit"
                disabled={submitting || otp.trim().length !== 6}
                className="w-full rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-60 hover:opacity-90"
              >
                {submitting ? 'Verifying…' : 'Verify & Continue'}
              </button>
              <p className="mt-2 text-sm text-muted-foreground">
                Didn&apos;t receive the code?
                <button
                  type="button"
                  onClick={() => setStep('enter')}
                  className="text-primary font-medium hover:underline"
                >
                  Resend OTP
                </button>
              </p>
            </>
          )}
        </form>
      </section>
    </main>
  )
}
