'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type AuthMode = 'login' | 'register'
type AuthMethod = 'password' | 'phone-otp'
type OtpStep = 'send' | 'verify' | 'register'

export function CustomerAuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter()

  // ---- Auth method: Password vs Phone OTP ----
  const [authMethod, setAuthMethod] = useState<AuthMethod>('password')

  // ---- OTP flow state ----
  const [otpStep, setOtpStep] = useState<OtpStep>('send')
  const [otp, setOtp] = useState('')
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
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
    setPhone('')
    setName('')
    setEmail('')
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

    setSubmitting(true)
    try {
      const response = await fetch('/api/auth/otp/send', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone(phone) }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(otpErrorMessage(response.status, data.message))
      }
      setOtp('')
      setOtpStep('verify')
      toast.success('OTP sent to your mobile number.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to send OTP.'
      setFieldErrors({ phone: msg })
      setError(msg)
      toast.error(msg)
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

    setSubmitting(true)
    try {
      const response = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone(phone), otp: otp.trim() }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(otpErrorMessage(response.status, data.message))
      }

      if (data.status === 'registration_required') {
        // New customer: proceed to registration form. Phone is verified by the
        // backend and carried in the registration token cookie.
        setOtpStep('register')
        setName('')
        setEmail('')
        toast.success('OTP verified. Please complete your registration.')
        return
      }

      // Existing customer: authenticated via OTP, httpOnly cookie set by backend.
      router.push('/account')
      toast.success('Welcome back!')
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
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.message || 'Unable to create account.')
      }

      router.push('/account')
      toast.success('Account created successfully!')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to create account.'
      if (msg.includes('already exists')) {
        setFieldErrors({ email: msg })
      } else {
        setFieldErrors({ phone: msg })
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
          <button
            type="button"
            onClick={() => switchAuthMethod('phone-otp')}
            className={cn(
              'flex-1 rounded-xl border px-5 py-3 text-sm font-medium transition-all',
              authMethod === 'phone-otp'
                ? 'bg-caramel text-caramel-foreground border-caramel shadow-sm'
                : 'border-border text-muted-foreground hover:bg-cream/50 hover:border-caramel/20',
            )}
          >
            Phone OTP
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
                    'mt-2 w-full rounded-xl border px-4 py-3.5 outline-none focus:ring-2',
                    fieldErrors.phone
                      ? 'border-destructive focus:ring-destructive'
                      : 'border-border focus:ring-caramel',
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
                  'mt-2 w-full rounded-xl border px-4 py-3.5 outline-none focus:ring-2',
                  fieldErrors.password
                    ? 'border-destructive focus:ring-destructive'
                    : 'border-border focus:ring-caramel',
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
                    'mt-2 w-full rounded-xl border px-4 py-3.5 outline-none focus:ring-2',
                    fieldErrors.confirmPassword
                      ? 'border-destructive focus:ring-destructive'
                      : 'border-border focus:ring-caramel',
                  )}
                />
              </div>
            )}

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
          <form className="mt-8 space-y-6">
            {otpStep === 'send' ? (
              <>
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
                      'mt-2 w-full rounded-xl border px-4 py-3.5 outline-none focus:ring-2',
                      fieldErrors.phone
                        ? 'border-destructive focus:ring-destructive'
                        : 'border-border focus:ring-caramel',
                    )}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={submitting || !isValidOtpPhone(phone)}
                  className="w-full rounded-xl bg-caramel px-6 py-4 font-semibold text-caramel-foreground shadow-sm hover:bg-caramel/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? 'Sending…' : 'Send OTP'}
                </button>

                <p className="mt-4 text-sm text-muted-foreground">
                  A 6-digit code will be sent to your mobile number.
                </p>
              </>
            ) : otpStep === 'verify' ? (
              <>
                <div className="bg-cream rounded-xl p-5">
                  <p className="text-sm text-muted-foreground">
                    Enter the 6-digit code sent to{' '}
                    <span className="font-medium text-primary">
                      {cleanPhone(phone) || phone}
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
                  ← Use a different phone number
                </button>

                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={submitting}
                  className="w-full rounded-xl border border-border px-6 py-3 text-sm font-medium text-caramel-foreground hover:bg-cream/50 transition-colors"
                >
                  Resend OTP
                </button>
              </>
            ) : (
              // Registration step (new customer after OTP verification)
              <form onSubmit={handleCompleteRegistration} className="mt-8 space-y-6">
                <div className="bg-cream rounded-xl p-5">
                  <p className="text-sm text-muted-foreground">
                    Phone verified: <span className="font-medium text-primary">{cleanPhone(phone) || phone}</span>. Please complete your profile.
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
                  Your phone number is verified and cannot be changed here. To
                  use a different phone, restart OTP verification.
                </p>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl bg-caramel px-6 py-4 font-semibold text-caramel-foreground shadow-sm hover:bg-caramel/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? 'Creating account…' : 'Create account'}
                </button>

                <button
                  type="button"
                  onClick={() => setOtpStep('send')}
                  className="w-full rounded-xl border border-border px-6 py-3 text-sm font-medium text-muted-foreground hover:bg-cream/50 transition-colors"
                >
                  ← Use a different phone number
                </button>
              </form>
            )}
          </form>
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
