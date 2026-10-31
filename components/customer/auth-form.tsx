'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/lib/utils'

type AuthMode = 'login' | 'register'
type AuthMethod = 'password' | 'phone-otp'
type OtpStep = 'send' | 'verify'

export function CustomerAuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter()

  // ---- Auth method: Password vs Phone OTP ----
  const [authMethod, setAuthMethod] = useState<AuthMethod>('password')

  // ---- OTP flow state ----
  const [otpStep, setOtpStep] = useState<OtpStep>('send')
  const [otp, setOtp] = useState('')

  // ---- Form state (shared with password flow) ----
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<'name' | 'email' | 'phone' | 'password' | 'confirmPassword' | 'otp', string>>>({})

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
    setError('')
    setFieldErrors({})
  }

  const isOtpFlow = authMethod === 'phone-otp'
  const isLogin = mode === 'login'

  // ---- Password flow (existing, unchanged) ----
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
          credentials: 'include',
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

  // ---- Phone OTP helpers ----
  function cleanPhone(raw: string): string {
    return raw.replace(/\s+/g, '').replace(/-/g, '').replace(/^(\+91|91)/, '')
  }

  function isValidOtpPhone(raw: string): boolean {
    const cleaned = cleanPhone(raw)
    return /^[6-9]\d{9}$/.test(cleaned)
  }

  function otpErrorMessage(status: number, message: string): string {
    switch (status) {
      case 400:
        return message || 'Invalid input. Please check your details.'
      case 401:
        return 'Invalid or expired OTP. Please try again.'
      case 404:
        return 'No account found for this phone number.'
      case 409:
        return 'An account with this phone number already exists.'
      case 429:
        return 'Too many requests. Please try again later.'
      case 501:
        return 'SMS delivery is not configured. Please try again later.'
      default:
        return message || 'Unable to process your request. Please try again.'
    }
  }

  async function handleSendOtp() {
    setError('')
    setFieldErrors({})

    if (!isValidOtpPhone(phone)) {
      const msg = 'Enter a valid 10-digit Indian mobile number.'
      setFieldErrors({ phone: msg })
      setError(msg)
      return
    }

    const purpose = mode.toUpperCase() as 'LOGIN' | 'REGISTER'

    setSubmitting(true)
    try {
      const response = await fetch('/api/auth/otp/send', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone(phone), purpose }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(otpErrorMessage(response.status, data.message))
      }
      setOtp('')
      setOtpStep('verify')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to send OTP.'
      setFieldErrors({ phone: msg })
      setError(msg)
    } finally {
      setSubmitting(false)
    }
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

    const purpose = mode.toUpperCase() as 'LOGIN' | 'REGISTER'

    setSubmitting(true)
    try {
      const body: Record<string, unknown> = { phone: cleanPhone(phone), otp: otp.trim(), purpose }
      if (mode === 'register') {
        body.name = name.trim()
      }

      const response = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(otpErrorMessage(response.status, data.message))
      }
      window.localStorage.setItem('customer-token', data.token)
      router.push('/account')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to verify OTP.'
      if (msg.includes('already exists') || msg.includes('No account found')) {
        setFieldErrors({ phone: msg })
      } else if (msg.includes('OTP') || msg.includes('6-digit')) {
        setFieldErrors({ otp: msg })
      } else {
        setFieldErrors({ phone: msg })
      }
      setError(msg)
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

        {/* Auth method switch */}
        <div className="mt-6 flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={() => switchAuthMethod('password')}
            className={cn(
              'flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
              authMethod === 'password'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:bg-muted',
            )}
          >
            Password
          </button>
          <button
            type="button"
            onClick={() => switchAuthMethod('phone-otp')}
            className={cn(
              'flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
              authMethod === 'phone-otp'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:bg-muted',
            )}
          >
            Phone OTP
          </button>
        </div>

        {authMethod === 'password' ? (
          // ---- Password form (existing, unchanged) ----
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
        ) : (
          // ---- Phone OTP form ----
          <form className="mt-6 space-y-5">
            {otpStep === 'send' ? (
              <>
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
                    maxLength={15}
                    value={phone}
                    onChange={(event) => {
                      setPhone(event.target.value)
                      clearFieldError('phone')
                    }}
                    placeholder="+91 98409 16058"
                    className={cn(
                      'mt-2 w-full rounded-lg border px-4 py-3 outline-none focus:ring-2',
                      fieldErrors.phone
                        ? 'border-destructive focus:ring-destructive'
                        : 'border-border focus:ring-primary',
                    )}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={submitting}
                  className="w-full rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-60 hover:opacity-90"
                >
                  {submitting ? 'Sending…' : 'Send OTP'}
                </button>

                <p className="mt-4 text-sm text-muted-foreground">
                  A 6-digit code will be sent to your mobile number.
                </p>
              </>
            ) : (
              // OTP verify step
              <>
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">
                    Enter the 6-digit code sent to{' '}
                    <span className="font-medium">{cleanPhone(phone) || phone}</span>
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
                      'mt-2 w-full rounded-lg border px-4 py-3 outline-none focus:ring-2',
                      fieldErrors.otp
                        ? 'border-destructive focus:ring-destructive'
                        : 'border-border focus:ring-primary',
                    )}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleVerifyOtp}
                  disabled={submitting}
                  className="w-full rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-60 hover:opacity-90"
                >
                  {submitting ? 'Verifying…' : 'Verify OTP'}
                </button>

                <button
                  type="button"
                  onClick={() => setOtpStep('send')}
                  className="w-full rounded-lg border border-border px-5 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
                >
                  ← Use a different phone number
                </button>

                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={submitting}
                  className="w-full rounded-lg border border-border px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-muted"
                >
                  Resend OTP
                </button>
              </>
            )}
          </form>
        )}

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
