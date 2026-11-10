'use client'

import Link from 'next/link'
import Script from 'next/script'
import { useRouter } from 'next/navigation'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type AuthMode = 'login' | 'register'
type AuthMethod = 'password' | 'email-otp'
type OtpStep = 'send' | 'verify' | 'register'

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: {
            client_id: string
            callback: (credentialResponse: { credential: string }) => void
            context?: string
          }) => void
          prompt: () => void
          renderButton: (element: HTMLElement, options: any) => void
        }
      }
    }
  }
}

export function CustomerAuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter()

  // ---- Google Identity Services state ----
  const [googleClientId, setGoogleClientId] = useState<string | null>(null)
  const [googleCredential, setGoogleCredential] = useState<string | null>(null)
  const [googleError, setGoogleError] = useState<string | null>(null)
  const [googleInitialized, setGoogleInitialized] = useState(false)

  // ---- Auth method: Password vs Email OTP ----
  const [authMethod, setAuthMethod] = useState<AuthMethod>(
    mode === 'register' ? 'email-otp' : 'password',
  )

  // ---- OTP flow state ----
  const [otpStep, setOtpStep] = useState<OtpStep>('send')
  const [otp, setOtp] = useState('')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<'name' | 'email' | 'password' | 'confirmPassword' | 'phone' | 'otp', string>>>({})
  const [resendCooldown, setResendCooldown] = useState(0)
  const resendCooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

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

  const clearFieldError = useCallback(
    (field: keyof typeof fieldErrors) => {
      setFieldErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    },
    [],
  )

  const switchAuthMethod = (method: AuthMethod) => {
    setAuthMethod(method)
    setOtpStep('send')
    setOtp('')
    setName('')
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setPhone('')
    setError('')
    setFieldErrors({})
    setResendCooldown(0)
    setShowPassword(false)
    setShowConfirmPassword(false)
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

  // ---- Send Google ID token to backend when received from GSI callback ----
  useEffect(() => {
    if (!googleCredential || !googleInitialized) return

    const sendCredential = async () => {
      setSubmitting(true)
      setError('')
      try {
        const response = await fetch('/api/auth/google', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: googleCredential }),
        })
        const data = await readJsonSafe(response)
        if (!response.ok) {
          throw new Error(
            (data as { message?: string })?.message || 'Google sign-in failed.',
          )
        }

        const redirectTo = (data as { redirectTo?: string })?.redirectTo
        if (redirectTo && typeof redirectTo === 'string') {
          router.push(redirectTo)
        } else {
          router.push('/account')
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unable to sign in with Google.'
        setError(msg)
        setGoogleError(msg)
        toast.error(msg)
      } finally {
        setSubmitting(false)
        setGoogleCredential(null)
      }
    }

    sendCredential()
  }, [googleCredential, googleInitialized, router])

  const isOtpFlow = authMethod === 'email-otp'
  const isLogin = mode === 'login'
  const isRegister = mode === 'register'

  const isValidIndianPhone = (raw: string): boolean => {
    const cleaned = raw.replace(/\s+/g, "").replace(/-/g, "")
    return /^[6-9]\d{9}$/.test(cleaned)
  }

  // ---- Password strength & requirements ----
  const passwordRequirements = useMemo(
    () => [
      { id: 'length', label: 'Minimum 8 characters', test: (p: string) => p.length >= 8 },
      { id: 'uppercase', label: 'At least one uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
      { id: 'lowercase', label: 'At least one lowercase letter', test: (p: string) => /[a-z]/.test(p) },
      { id: 'number', label: 'At least one number', test: (p: string) => /\d/.test(p) },
      { id: 'special', label: 'At least one special character', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
    ],
    [],
  )

  const getPasswordStrength = useCallback((pw: string): { score: number; label: string; color: string } => {
    if (!pw || pw.length === 0) {
      return { score: 0, label: 'Enter a password', color: 'text-muted-foreground' }
    }
    const met = passwordRequirements.filter((r) => r.test(pw)).length

    if (pw.length < 8) {
      return { score: 1, label: 'Weak', color: 'text-destructive' }
    }
    if (met >= 4) {
      return { score: 3, label: 'Strong', color: 'text-success' }
    }
    if (met >= 3) {
      return { score: 2, label: 'Medium', color: 'text-accent' }
    }
    return { score: 1, label: 'Weak', color: 'text-destructive' }
  }, [passwordRequirements])

  const { score: passwordScore, label: strengthLabel, color: strengthColor } =
    getPasswordStrength(password)

  const allRequirementsMet = useMemo(() => {
    if (!password) return true
    return passwordRequirements.every((r) => r.test(password))
  }, [password, passwordRequirements])

  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0

  // ---- Password flow ----
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setFieldErrors({})

    const nextFieldErrors: Partial<Record<'name' | 'email' | 'password' | 'confirmPassword' | 'phone', string>> = {}
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

      if (!isValidIndianPhone(phone)) {
        nextFieldErrors.phone = 'Enter a valid 10-digit Indian mobile number.'
        hasError = true
      } else {
        clearFieldError('phone')
      }

      if (!password || password.length < 8) {
        nextFieldErrors.password = 'Password must be at least 8 characters.'
        hasError = true
      } else {
        clearFieldError('password')
      }

      if (!allRequirementsMet) {
        nextFieldErrors.password = 'Please meet all password requirements.'
        hasError = true
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
            ...(mode === 'register'
              ? {
                  name: name.trim(),
                  email: email.trim().toLowerCase(),
                  phone: phone.replace(/\s+/g, "").replace(/-/g, ""),
                  password,
                  confirmPassword,
                }
              : {}),
            email: email.trim().toLowerCase(),
            password,
          }),
        },
      )
      const data = await readJsonSafe(response)
      if (!response.ok) {
        throw new Error((data as { message?: string })?.message || 'Unable to authenticate.')
      }

      // If the response indicates an existing account (email or phone already
      // registered), show the generic message as an error instead of
      // redirecting. No account was created, so sending the user to /account
      // would leave them stranded without a session.
      const message = (data as { message?: string })?.message || ''
      if (message.includes('does not already exist')) {
        setError(message)
        return
      }

      const redirectTo = (data as { redirectTo?: string })?.redirectTo
      if (redirectTo && typeof redirectTo === 'string') {
        router.push(redirectTo)
      } else {
        router.push('/account')
      }
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
      case "GOOGLE_CONFIG_MISSING":
        return "Google sign-in is not configured. Please contact support."
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

      const redirectTo = (data as { redirectTo?: string })?.redirectTo
      if (redirectTo && typeof redirectTo === 'string') {
        router.push(redirectTo)
      } else {
        setOtpStep('register')
        setName('')
        toast.success('Email verified. Enter your details to continue.')
      }
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
          phone: phone.replace(/\s+/g, "").replace(/-/g, ""),
          password,
          confirmPassword,
        }),
      })
      const data = await readJsonSafe(response)
      if (!response.ok) {
        throw new Error((data as { message?: string })?.message || 'Unable to create account.')
      }

      const redirectTo = (data as { redirectTo?: string })?.redirectTo
      if (redirectTo && typeof redirectTo === 'string') {
        router.push(redirectTo)
      } else {
        router.push('/account')
      }
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

  // ---- Google Sign-In via Identity Services ----
  async function handleGoogleSignIn() {
    setError('')
    setGoogleError('')

    if (!googleInitialized || !googleClientId) {
      setError('Google Sign-In is not available. Please try again later.')
      return
    }

    try {
      ;(window as any).google.accounts.id.prompt()
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Google Sign-In prompt failed.'
      setGoogleError(msg)
      setError(msg)
    }
  }

  // ---- Forgot password ----
  async function handleForgotPassword() {
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
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail(email) }),
      })
      const data = await readJsonSafe(response)
      if (!response.ok) {
        throw new Error((data as { message?: string })?.message || 'Unable to process request.')
      }

      setOtpStep('verify')
      toast.success('If an account exists for this email, a verification code has been sent.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to process request.'
      setFieldErrors({ email: msg })
      setError(msg)
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // ---- Presentational helpers ----
  const brandName = 'Bluebell Bakehouse'

  const inputClass = (field: keyof typeof fieldErrors) =>
    cn(
      'mt-2 block w-full rounded-xl border px-4 py-3.5 text-base outline-none transition-all',
      'placeholder:text-foreground',
      fieldErrors[field]
        ? 'border-destructive focus:ring-destructive focus:border-destructive'
        : 'border-border focus:ring-caramel/20 focus:border-caramel',
    )

  const eyeButtonClass =
    'absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-caramel transition-colors focus:outline-none focus:ring-2 focus:ring-caramel rounded-sm'

  const primaryButton = (label: string) => (
    <button
      type="submit"
      disabled={submitting}
      className={cn(
        'w-full rounded-xl bg-caramel px-6 py-4 font-semibold text-caramel-foreground shadow-sm',
        'hover:bg-caramel/90 disabled:opacity-60 disabled:cursor-not-allowed',
        'transition-all active:scale-[0.98]',
      )}
    >
      {submitting ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="size-4 text-caramel-foreground animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6M12 18v6" />
          </svg>
          {label}
        </span>
      ) : label}
    </button>
  )

  return (
    <main className="mx-auto max-w-lg px-4 py-10 sm:px-6 lg:py-16">
      <Script
        id="gis-script"
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => {
          const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
          if (!clientId) {
            setGoogleError('Google Sign-In is not configured.')
            return
          }
          setGoogleClientId(clientId)

          const g = (window as any).google
          if (g?.accounts?.id) {
            g.accounts.id.initialize({
              client_id: clientId,
              callback: (credentialResponse: { credential: string }) => {
                setGoogleCredential(credentialResponse.credential)
                setGoogleError(null)
              },
              context: 'signin',
            })
            setGoogleInitialized(true)
          } else {
            setGoogleError('Google Identity Services failed to load.')
          }
        }}
      />

      <section className="rounded-[2rem] border border-border bg-card p-6 sm:p-8 shadow-sm">
        {/* Brand header */}
        <div className="mb-8 text-center sm:text-left">
          <p className="text-xs font-semibold text-primary tracking-widest uppercase">
            {brandName}
          </p>
          <h1 className="mt-1 font-heading text-3xl sm:text-4xl font-semibold text-primary tracking-tight">
            {isRegister ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className="mt-3 text-sm text-foreground leading-relaxed">
            {isRegister
              ? 'Join us and save your favourite cakes for faster checkout.'
              : 'Sign in to view your orders and account details.'}
          </p>
        </div>

        {error && (
          <div role="alert" className="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive shadow-sm">
            {error}
          </div>
        )}

        {/* Auth method toggle */}
        <div className="mb-8 flex flex-col sm:flex-row gap-2">
          {isLogin ? (
            <button
              type="button"
              onClick={() => switchAuthMethod('password')}
              className={cn(
                'flex-1 rounded-xl border px-5 py-3 text-sm font-medium transition-all',
                authMethod === 'password'
                  ? 'bg-caramel text-caramel-foreground border-caramel shadow-sm'
                  : 'border-border text-muted-foreground hover:bg-cream hover:text-caramel hover:border-caramel/20',
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
                : 'border-border text-muted-foreground hover:bg-cream hover:text-caramel hover:border-caramel/20',
            )}
          >
            Email OTP
          </button>
        </div>

        {authMethod === 'password' ? (
          // ---- Password form ----
          <form onSubmit={handleSubmit} className="space-y-5">
            {isRegister ? (
              <>
                {/* Full Name */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Full name
                  </label>
                  {fieldErrors.name && (
                    <p className="mb-2 text-sm text-destructive">
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
                    className={inputClass('name')}
                  />
                </div>

                {/* Email Address */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Email address
                  </label>
                  {fieldErrors.email && (
                    <p className="mb-2 text-sm text-destructive">
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
                    className={inputClass('email')}
                  />
                </div>

                {/* Mobile Number */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Mobile number
                  </label>
                  {fieldErrors.phone && (
                    <p className="mb-2 text-sm text-destructive">
                      {fieldErrors.phone}
                    </p>
                  )}
                  <input
                    type="tel"
                    autoComplete="tel"
                    required
                    maxLength={15}
                    value={phone}
                    onChange={(event) => {
                      setPhone(event.target.value)
                      clearFieldError('phone')
                    }}
                    placeholder="9840916058"
                    className={inputClass('phone')}
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Password
                  </label>
                  {fieldErrors.password && (
                    <p className="mb-2 text-sm text-destructive">
                      {fieldErrors.password}
                    </p>
                  )}
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      minLength={8}
                      maxLength={72}
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value)
                        clearFieldError('password')
                      }}
                      placeholder="••••••••"
                      className={cn(
                        inputClass('password'),
                        'pr-12',
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className={eyeButtonClass}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" aria-hidden="true" />
                      ) : (
                        <Eye className="size-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>

                  {/* Password strength meter (register only) */}
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-muted-foreground">
                        Password strength
                      </span>
                      <span
                        className={cn('text-xs font-semibold', strengthColor)}
                      >
                        {strengthLabel}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted/50 overflow-hidden">
                      <div
                        className={cn(
                          'h-full transition-all duration-300 ease-out',
                          passwordScore === 0
                            ? 'w-0 bg-transparent'
                            : passwordScore === 1
                              ? 'w-1/3 bg-destructive'
                              : passwordScore === 2
                                ? 'w-2/3 bg-accent'
                                : 'w-full bg-success',
                        )}
                      />
                    </div>

                    {/* Requirements checklist */}
                    <div className="mt-2 space-y-1">
                      {passwordRequirements.map((req) => {
                        const met = password ? req.test(password) : false
                        return (
                          <div
                            key={req.id}
                            className="flex items-center gap-2"
                          >
                            <span
                              className={cn(
                                'flex size-3.5 items-center justify-center rounded-full border text-[10px] font-bold transition-colors',
                                met
                                  ? 'border-success bg-success text-success-foreground'
                                  : 'border-border text-muted-foreground',
                              )}
                            >
                              {met ? '✓' : '○'}
                            </span>
                            <span
                              className={cn(
                                'text-xs leading-none',
                                met
                                  ? 'text-muted-foreground'
                                  : 'text-foreground',
                              )}
                            >
                              {req.label}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Confirm password
                  </label>
                  {fieldErrors.confirmPassword && (
                    <p className="mb-2 text-sm text-destructive">
                      {fieldErrors.confirmPassword}
                    </p>
                  )}
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
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
                        inputClass('confirmPassword'),
                        'pr-12',
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className={eyeButtonClass}
                      aria-label={
                        showConfirmPassword ? 'Hide password' : 'Show password'
                      }
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="size-4" aria-hidden="true" />
                      ) : (
                        <Eye className="size-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                  {!passwordsMatch && confirmPassword.length > 0 && (
                    <p className="mt-1 text-xs text-destructive">
                      Passwords do not match.
                    </p>
                  )}
                </div>
              </>
            ) : (
              // Login fields
              <>
                {/* Email Address */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Email address
                  </label>
                  {fieldErrors.email && (
                    <p className="mb-2 text-sm text-destructive">
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
                    className={inputClass('email')}
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Password
                  </label>
                  {fieldErrors.password && (
                    <p className="mb-2 text-sm text-destructive">
                      {fieldErrors.password}
                    </p>
                  )}
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      minLength={1}
                      maxLength={72}
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value)
                        clearFieldError('password')
                      }}
                      placeholder="••••••••"
                      className={cn(
                        inputClass('password'),
                        'pr-12',
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className={eyeButtonClass}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" aria-hidden="true" />
                      ) : (
                        <Eye className="size-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}

            {primaryButton(isRegister ? 'Create account' : 'Sign in')}

            {isLogin && (
              <p className="mt-1 text-sm text-center text-muted-foreground">
                Forgot your password?{' '}
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                  disabled={submitting}
                >
                  Reset password
                </button>
              </p>
            )}
          </form>
        ) : (
          // ---- Email OTP form ----
          <div className="mt-8 space-y-5">
            {otpStep === 'send' ? (
              <>
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Email address
                  </label>
                  {fieldErrors.email && (
                    <p className="mb-2 text-sm text-destructive">
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
                    className={inputClass('email')}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={submitting || !isValidOtpEmail(email) || resendCooldown > 0}
                  className={cn(
                    'w-full rounded-xl bg-caramel px-6 py-4 font-semibold text-caramel-foreground shadow-sm',
                    'hover:bg-caramel/90 disabled:opacity-60 disabled:cursor-not-allowed',
                    'transition-all active:scale-[0.98]',
                  )}
                >
                  {submitting ? 'Sending…' : 'Send OTP'}
                </button>

                <p className="mt-3 text-sm text-muted-foreground">
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
                    <p className="mb-2 text-sm text-destructive">
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
                      inputClass('otp'),
                      'text-center letter-spacing-widest font-mono',
                    )}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleVerifyOtp}
                  disabled={submitting || otp.trim().length !== 6}
                  className={cn(
                    'w-full rounded-xl bg-caramel px-6 py-4 font-semibold text-caramel-foreground shadow-sm',
                    'hover:bg-caramel/90 disabled:opacity-60 disabled:cursor-not-allowed',
                    'transition-all active:scale-[0.98]',
                  )}
                >
                  {submitting ? 'Verifying…' : 'Verify OTP'}
                </button>

                <button
                  type="button"
                  onClick={() => setOtpStep('send')}
                  className="w-full rounded-xl border border-border px-6 py-3 text-sm font-medium text-muted-foreground hover:bg-cream transition-colors"
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
              <form onSubmit={handleCompleteRegistration} className="space-y-5">
                <div className="bg-cream rounded-xl p-5">
                  <p className="text-sm text-muted-foreground">
                    Email verified: <span className="font-medium text-primary">{email}</span>. Enter your details to continue.
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Full name
                  </label>
                  {fieldErrors.name && (
                    <p className="mb-2 text-sm text-destructive">
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
                    className={inputClass('name')}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Email address
                  </label>
                  {fieldErrors.email && (
                    <p className="mb-2 text-sm text-destructive">
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
                    className={inputClass('email')}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Mobile number
                  </label>
                  {fieldErrors.phone && (
                    <p className="mb-2 text-sm text-destructive">
                      {fieldErrors.phone}
                    </p>
                  )}
                  <input
                    type="tel"
                    autoComplete="tel"
                    required
                    maxLength={15}
                    value={phone}
                    onChange={(event) => {
                      setPhone(event.target.value)
                      clearFieldError('phone')
                    }}
                    placeholder="9840916058"
                    className={inputClass('phone')}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Password
                  </label>
                  {fieldErrors.password && (
                    <p className="mb-2 text-sm text-destructive">
                      {fieldErrors.password}
                    </p>
                  )}
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      minLength={8}
                      maxLength={72}
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value)
                        clearFieldError('password')
                      }}
                      placeholder="••••••••"
                      className={cn(
                        inputClass('password'),
                        'pr-12',
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className={eyeButtonClass}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" aria-hidden="true" />
                      ) : (
                        <Eye className="size-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Confirm password
                  </label>
                  {fieldErrors.confirmPassword && (
                    <p className="mb-2 text-sm text-destructive">
                      {fieldErrors.confirmPassword}
                    </p>
                  )}
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
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
                        inputClass('confirmPassword'),
                        'pr-12',
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className={eyeButtonClass}
                      aria-label={
                        showConfirmPassword ? 'Hide password' : 'Show password'
                      }
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="size-4" aria-hidden="true" />
                      ) : (
                        <Eye className="size-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                  {!passwordsMatch && confirmPassword.length > 0 && (
                    <p className="mt-1 text-xs text-destructive">
                      Passwords do not match.
                    </p>
                  )}
                </div>

                <p className="mt-2 text-xs text-muted-foreground">
                  Your email address is verified and cannot be changed here. To
                  use a different email, restart OTP verification.
                </p>

                {primaryButton('Continue')}

                <button
                  type="button"
                  onClick={() => setOtpStep('send')}
                  className="w-full rounded-xl border border-border px-6 py-3 text-sm font-medium text-muted-foreground hover:bg-cream transition-colors"
                >
                  ← Use a different email address
                </button>
              </form>
            )}
          </div>
        )}

        {/* Google OAuth divider */}
        <div className="mt-10 relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border"></span>
          </div>
          <span className="relative flex justify-center text-xs uppercase tracking-widest text-foreground bg-card px-4">
            Or continue with
          </span>
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={submitting || !googleInitialized || !googleClientId}
          className="mt-4 w-full rounded-xl border border-border bg-background px-6 py-4 font-semibold text-primary shadow-sm hover:bg-cream transition-colors flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <svg
                className="size-4 text-primary animate-spin"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6M12 18v6" />
              </svg>
              Signing in…
            </>
          ) : googleError ? (
            <>
              <svg
                className="size-4 text-destructive"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
              </svg>
              {googleError}
            </>
          ) : (
            <>
              <svg
                className="size-5"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66v-2.77c-1.16-.78-1.95-1.88-2.21-3.31H12v3.73c-1.32 0-2.52-.26-3.59-.72v-2.2c0-.26.02-.52.05-.77h2.32c.05.21.09.42.09.66 0 1.61-1.31 2.92-2.92 2.92z"
                />
                <path
                  fill="#FBBC05"
                  d="M12 5.38c1.61 0 2.92 1.31 2.92 2.92 0 .24-.04.47-.09.69h-2.32c-.03-.25-.05-.51-.05-.77 0-1.61 1.31-2.92 2.92-2.92zM3.27 7.27c.26 1.04.62 2.01 1.12 2.85v2.32c0 .27.02.53.07.78H3.27c-.38-.71-.6-1.56-.6-2.47 0-1.61 1.31-2.92 2.92-2.92 1.31 0 2.45.84 2.79 2.02h2.32c-.27-.8-.84-1.48-1.6-1.96C7.43 5.02 5.86 5 4.19 5c-2.61 0-4.82 2.01-4.91 4.62-.04.56-.01 1.12.14 1.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 23c-1.61 0-2.92-1.31-2.92-2.92 0-.24.04-.47.09-.69h2.32c.03-.25.05-.51.05-.77 0-1.61-1.31-2.92 2.92-2.92-1.61 0-2.92 1.31-2.92 2.92 0 .27.02.53.07.78H3.27c.38.71.6 1.56.6 2.47 0 1.61-1.31 2.92 2.92-2.92-1.61 0-2.92 1.31-2.92 2.92 0 .27.02.53.07.78H3.27c.38.71.6 1.56.6 2.47 0 1.61-1.31 2.92 2.92 2.92-.15 0-.31-.01-.46-.02V23c2.61 0 4.82-2.01 4.91-4.62.04-.56.01-1.12-.14-1.63z"
                />
              </svg>
              Continue with Google
            </>
          )}
        </button>

        <p className="mt-10 text-sm text-foreground text-center">
          {isRegister ? 'Already have an account?' : 'New to Bluebell Bakehouse?'}{' '}
          {isRegister ? (
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
