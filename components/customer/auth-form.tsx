'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type AuthMode = 'login' | 'register'
type AuthMethod = 'password' | 'email-otp'
type OtpStep = 'send' | 'verify' | 'register'

export function CustomerAuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter()

  // ---- Auth method: Password vs Email OTP ----
  // Password registration is disabled. New customers must use email OTP.
  const [authMethod, setAuthMethod] = useState<AuthMethod>(
    mode === 'register' ? 'email-otp' : 'password',
  )

  // ---- OTP flow state ----
  const [otpStep, setOtpStep] = useState<OtpStep>('send')
  const [otp, setOtp] = useState('')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<'name' | 'email' | 'password' | 'otp', string>>>({})
  const [resendCooldown, setResendCooldown] = useState(0)
  const resendCooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  /**
   * Reads a response body as JSON, returning null when the body is not valid
   * JSON (for example a non-JSON error page returned by a proxy/edge when the
   * upstream request times out). Prevents raw "Unexpected token" JSON parse
   * exceptions from surfacing to the user.
   */
  async function readJsonSafe(response: Response): Promise<unknown> {
    try {
      return await response.json()
    } catch {
      return null
    }
  }

  const clearFieldError = (field: keyof typeof fieldErrors) => {
    setFieldErrors((prev) => {
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  const switchAuthMethod = (method: AuthMethod) => {
    setAuthMethod(method)
    setOtpStep('send')
    setOtp('')
    setName('')
    setEmail('')
    setError('')
    setFieldErrors({})
    setResendCooldown(0)
    if (resendCooldownTimer.current) {
      clearInterval(resendCooldownTimer.current)
      resendCooldownTimer.current = null
    }
  }

  // Cleanup cooldown timer on unmount.
  useEffect(() => {
    return () => {
      if (resendCooldownTimer.current) {
        clearInterval(resendCooldownTimer.current)
        resendCooldownTimer.current = null
      }
    }
  }, [])

  const isOtpFlow = authMethod === 'email-otp'
  const isLogin = mode === 'login'

  // ---- Password flow (existing, unchanged) ----
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setFieldErrors({})

    const nextFieldErrors: Partial<Record<'name' | 'email' | 'password', string>> = {}
    let hasError = false

    if (mode === 'register') {
      // Password registration is disabled; new customers register via email OTP.
      // The password form is not shown in register mode, so no password validation
      // is needed here. Only name and email are collected for display purposes,
      // but the actual registration happens via the OTP flow.
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
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...(mode === 'register' ? { name: name.trim() } : {}),
            email: email.trim().toLowerCase(),
            password,
          }),
        },
      )
      const data = await readJsonSafe(response)
      if (!response.ok) {
        throw new Error((data as { message?: string })?.message || 'Unable to authenticate.')
      }
      router.push('/account')
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Unable to authenticate.')
    } finally {
      setSubmitting(false)
    }
  }

  // ---- Email OTP helpers ----
  function cleanEmail(raw: string): string {
    return raw.trim().toLowerCase()
  }

  function isValidOtpEmail(raw: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail(raw))
  }

  function otpErrorMessage(status: number, message: string, code?: string): string {
    switch (code) {
      case "EMAIL_CONFIG_MISSING":
        return "Email service is not configured. Please contact support."
      case "EMAIL_DELIVERY_FAILED":
        return message || "Unable to send OTP. Please try again later."
    }
    switch (status) {
      case 400:
        return message || 'Invalid input. Please check your details.'
      case 401:
        return 'Invalid or expired OTP. Please try again.'
      case 404:
        return 'No account found for this email address.'
      case 409:
        return 'An account with this email address already exists.'
      case 429:
        return message || 'Too many OTP requests. Please wait before resending.'
      case 502:
        return message || 'Unable to send OTP. Please try again later.'
      case 503:
        return 'Email service is not configured. Please contact support.'
      default:
        return message || 'Unable to process your request. Please try again.'
    }
  }

  async function handleSendOtp() {
    setError('')
    setFieldErrors({})

    if (!isValidOtpEmail(email)) {
      const msg = 'Enter a valid email address.'
      setFieldErrors({ email: msg })
      setError(msg)
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/auth/otp/send', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail(email) }),
      })
      const data = await readJsonSafe(response)
      if (!response.ok) {
        const payload = data as {
          retryAfter?: number
          message?: string
          code?: string
        } | null
        if (response.status === 429 && payload?.retryAfter) {
          setResendCooldown(payload.retryAfter)
          startResendCooldownTimer()
          throw new Error(
            `Please wait ${payload.retryAfter}s before resending OTP.`,
          )
        }
        throw new Error(
          otpErrorMessage(response.status, payload?.message ?? '', payload?.code),
        )
      }
      setOtp('')
      setOtpStep('verify')
      toast.success('OTP sent to your email address.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to send OTP.'
      setFieldErrors({ email: msg })
      setError(msg)
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  function startResendCooldownTimer() {
    if (resendCooldownTimer.current) {
      clearInterval(resendCooldownTimer.current)
    }
    resendCooldownTimer.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(resendCooldownTimer.current!)
          resendCooldownTimer.current = null
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  async function handleVerifyOtp() {
    setError('')
    setFieldErrors({})

    if (!otp.trim() || !/^\d{6}$/.test(otp.trim())) {
      const msg = 'Please enter a valid 6-digit OTP.'
      setFieldErrors({ otp: msg })
      setError(msg)
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail(email), otp: otp.trim() }),
      })
      const data = await readJsonSafe(response)
      if (!response.ok) {
        const payload = data as { message?: string; code?: string } | null
        throw new Error(
          otpErrorMessage(response.status, payload?.message ?? '', payload?.code),
        )
      }

      setOtpStep('register')
      setName('')
      toast.success('Email verified. Enter your details to continue.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to verify OTP.'
      if (msg.includes('already exists') || msg.includes('No account found')) {
        setFieldErrors({ email: msg })
      } else if (msg.includes('OTP') || msg.includes('6-digit')) {
        setFieldErrors({ otp: msg })
      } else {
        setFieldErrors({ email: msg })
      }
      setError(msg)
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCompleteRegistration(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setFieldErrors({})

    if (!name.trim() || name.trim().length < 2) {
      setFieldErrors({ name: 'Please enter your full name.' })
      setError('Please enter your full name.')
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setFieldErrors({ email: 'Enter a valid email address.' })
      setError('Enter a valid email address.')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/auth/otp/register-complete', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
        }),
      })
      const data = await readJsonSafe(response)
      if (!response.ok) {
        throw new Error((data as { message?: string })?.message || 'Unable to create account.')
      }

      router.push('/account')
      toast.success('You’re signed in.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to create account.'
      if (msg.includes('already exists')) {
        setFieldErrors({ email: msg })
      } else {
        setFieldErrors({ email: msg })
      }
      setError(msg)
      toast.error(msg)
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
          {mode === 'register' ? 'Create your account' : 'Customer sign in'}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          {mode === 'register'
            ? 'Keep your account details and orders together.'
            : 'Sign in to view your account and order history.'}
        </p>

        {error && (
          <div role="alert" className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive shadow-sm">
            {error}
          </div>
        )}

        {/* Auth method switch */}
        <div className="mt-8 flex flex-col sm:flex-row gap-2">
          {mode === 'login' ? (
            <button
              type="button"
              onClick={() => switchAuthMethod('password')}
              className={cn(
                'flex-1 rounded-xl border px-5 py-3 text-sm font-medium transition-all',
                authMethod === 'password'
                  ? 'bg-caramel text-caramel-foreground border-caramel shadow-sm'
                  : 'border-border text-muted-foreground hover:bg-cream/50 hover:border-caramel/20',
              )}
            >
              Password
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => switchAuthMethod('email-otp')}
            className={cn(
              'flex-1 rounded-xl border px-5 py-3 text-sm font-medium transition-all',
              authMethod === 'email-otp'
                ? 'bg-caramel text-caramel-foreground border-caramel shadow-sm'
                : 'border-border text-muted-foreground hover:bg-cream/50 hover:border-caramel/20',
            )}
          >
            Email OTP
          </button>
        </div>

        {authMethod === 'password' ? (
          // ---- Password form (existing, unchanged logic) ----
          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
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
                    'mt-2 w-full rounded-xl border px-4 py-3.5 outline-none focus:ring-2',
                    fieldErrors.name
                      ? 'border-destructive focus:ring-destructive'
                      : 'border-border focus:ring-caramel',
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
                  'mt-2 w-full rounded-xl border px-4 py-3.5 outline-none focus:ring-2',
                  fieldErrors.email
                    ? 'border-destructive focus:ring-destructive'
                    : 'border-border focus:ring-caramel',
                )}
              />
            </div>

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
                  'mt-2 w-full rounded-xl border px-4 py-3.5 outline-none focus:ring-2',
                  fieldErrors.password
                    ? 'border-destructive focus:ring-destructive'
                    : 'border-border focus:ring-caramel',
                )}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-caramel px-6 py-4 font-semibold text-caramel-foreground shadow-sm hover:bg-caramel/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Sign in'}
            </button>
          </form>
        ) : (
          // ---- Phone OTP form (unified: no LOGIN/REGISTER choice) ----
          <div className="mt-8 space-y-6">
            {otpStep === 'send' ? (
              <>
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Email address
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
                      'mt-2 w-full rounded-xl border px-4 py-3.5 outline-none focus:ring-2',
                      fieldErrors.email
                        ? 'border-destructive focus:ring-destructive'
                        : 'border-border focus:ring-caramel',
                    )}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={submitting || !isValidOtpEmail(email) || resendCooldown > 0}
                  className="w-full rounded-xl bg-caramel px-6 py-4 font-semibold text-caramel-foreground shadow-sm hover:bg-caramel/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? 'Sending…' : 'Send OTP'}
                </button>

                <p className="mt-4 text-sm text-muted-foreground">
                  A 6-digit code will be sent to your email address.
                </p>
              </>
            ) : otpStep === 'verify' ? (
              <>
                <div className="bg-cream rounded-xl p-5">
                  <p className="text-sm text-muted-foreground">
                    Enter the 6-digit code sent to{' '}
                    <span className="font-medium text-primary">
                      {email || ''}
                    </span>
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    OTP code
                  </label>
                  {fieldErrors.otp && (
                    <p className="mb-2 text-xs text-destructive">
                      {fieldErrors.otp}
                    </p>
                  )}
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                    maxLength={6}
                    pattern="[0-9]{6}"
                    value={otp}
                    onChange={(event) => {
                      setOtp(event.target.value)
                      clearFieldError('otp')
                    }}
                    placeholder="123456"
                    className={cn(
                      'mt-2 w-full rounded-xl border px-4 py-3.5 outline-none focus:ring-2 text-center letter-spacing-widest font-mono',
                      fieldErrors.otp
                        ? 'border-destructive focus:ring-destructive'
                        : 'border-border focus:ring-caramel',
                    )}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleVerifyOtp}
                  disabled={submitting || otp.trim().length !== 6}
                  className="w-full rounded-xl bg-caramel px-6 py-4 font-semibold text-caramel-foreground shadow-sm hover:bg-caramel/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? 'Verifying…' : 'Verify OTP'}
                </button>

                <button
                  type="button"
                  onClick={() => setOtpStep('send')}
                  className="w-full rounded-xl border border-border px-6 py-3 text-sm font-medium text-muted-foreground hover:bg-cream/50 transition-colors"
                >
                  ← Use a different email address
                </button>

                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={submitting || resendCooldown > 0}
                  className="w-full rounded-xl border border-border px-6 py-3 text-sm font-medium text-caramel-foreground hover:bg-cream/50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
                </button>
              </>
            ) : (
              // Registration step (new customer after OTP verification)
              <form onSubmit={handleCompleteRegistration} className="mt-8 space-y-6">
                <div className="bg-cream rounded-xl p-5">
                  <p className="text-sm text-muted-foreground">
                    Email verified: <span className="font-medium text-primary">{email}</span>. Enter your name to continue. Any saved profile for this email will remain unchanged.
                  </p>
                </div>

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
                      'mt-2 w-full rounded-xl border px-4 py-3.5 outline-none focus:ring-2',
                      fieldErrors.name
                        ? 'border-destructive focus:ring-destructive'
                        : 'border-border focus:ring-caramel',
                    )}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Email address
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
                      'mt-2 w-full rounded-xl border px-4 py-3.5 outline-none focus:ring-2',
                      fieldErrors.email
                        ? 'border-destructive focus:ring-destructive'
                        : 'border-border focus:ring-caramel',
                    )}
                  />
                </div>

                <p className="mt-2 text-xs text-muted-foreground">
                  Your email address is verified and cannot be changed here. To
                  use a different email, restart OTP verification.
                </p>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl bg-caramel px-6 py-4 font-semibold text-caramel-foreground shadow-sm hover:bg-caramel/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? 'Continuing…' : 'Continue'}
                </button>

                <button
                  type="button"
                  onClick={() => setOtpStep('send')}
                  className="w-full rounded-xl border border-border px-6 py-3 text-sm font-medium text-muted-foreground hover:bg-cream/50 transition-colors"
                >
                  ← Use a different email address
                </button>
              </form>
            )}
          </div>
        )}

        <p className="mt-8 text-sm text-muted-foreground text-center">
          {mode === 'register' ? 'Already have an account?' : 'New to S.V. Bakery?'}{' '}
          {mode === 'register' ? (
            <Link
              className="font-medium text-caramel underline-offset-4 hover:underline"
              href="/account/login"
            >
              Sign in
            </Link>
          ) : (
            <Link
              className="font-medium text-caramel underline-offset-4 hover:underline"
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
