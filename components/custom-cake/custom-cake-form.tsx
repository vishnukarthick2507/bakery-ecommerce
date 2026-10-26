'use client'

import { useState } from 'react'
import { ArrowLeftIcon, CheckCircle2, MessageCircleIcon } from 'lucide-react'

import { ApiError, submitCustomCakeRequest } from '@/lib/api'
import { siteConfig, whatsappLink } from '@/lib/site-config'
import { cn } from '@/lib/utils'

type FormState = {
  name: string
  phone: string
  flavour: string
  weight: string
  theme: string
  messageOnCake: string
  instructions: string
  referenceImageUrl: string
}

const emptyForm: FormState = {
  name: '',
  phone: '',
  flavour: '',
  weight: '',
  theme: '',
  messageOnCake: '',
  instructions: '',
  referenceImageUrl: '',
}

type Step = 'contact' | 'cake-details' | 'design' | 'reference' | 'review'

const STEPS: Array<{ key: Step; label: string }> = [
  { key: 'contact', label: 'Your details' },
  { key: 'cake-details', label: 'Cake details' },
  { key: 'design', label: 'Design & message' },
  { key: 'reference', label: 'Reference image' },
  { key: 'review', label: 'Review & submit' },
]

function stepIndex(key: Step) {
  return STEPS.findIndex((s) => s.key === key)
}

const inputClass =
  'mt-2 w-full rounded-lg border border-border bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-primary'

function fieldErrorClass(hasError: boolean) {
  return cn(
    'rounded-lg border px-4 py-3 outline-none focus:ring-2',
    hasError ? 'border-destructive focus:ring-destructive' : 'border-border focus:ring-primary',
  )
}

export function CustomCakeForm() {
  const [form, setForm] = useState<FormState>(emptyForm)
  const [step, setStep] = useState<Step>('contact')
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [referenceNumber, setReferenceNumber] = useState<string | null>(null)

  const clearFieldError = (field: keyof FormState) => {
    setFieldErrors((prev) => {
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  function update(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
    clearFieldError(field)
  }

  function goTo(next: Step) {
    setError('')
    setStep(next)
  }

  function goBack() {
    setError('')
    const current = stepIndex(step)
    if (current > 0) {
      setStep(STEPS[current - 1].key)
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setFieldErrors({})
    setError('')

    const nextFieldErrors: Partial<Record<keyof FormState, string>> = {}
    let hasError = false

    if (!form.name.trim() || form.name.trim().length < 2) {
      nextFieldErrors.name = 'Please enter your full name.'
      hasError = true
    } else {
      clearFieldError('name')
    }

    if (!/^[6-9]\d{9}$/.test(form.phone.trim())) {
      nextFieldErrors.phone = 'Enter a valid 10-digit Indian mobile number.'
      hasError = true
    } else {
      clearFieldError('phone')
    }

    if (!form.flavour.trim() || form.flavour.trim().length < 2) {
      nextFieldErrors.flavour = 'Please tell us the flavour.'
      hasError = true
    } else {
      clearFieldError('flavour')
    }

    const kilograms = Number(form.weight)
    if (!Number.isFinite(kilograms) || kilograms < 0.1 || kilograms > 5) {
      nextFieldErrors.weight = 'Cake weight must be between 0.1 kg and 5 kg.'
      hasError = true
    } else {
      clearFieldError('weight')
    }

    if (!form.theme.trim() || form.theme.trim().length < 2) {
      nextFieldErrors.theme = 'Please describe the theme or occasion.'
      hasError = true
    } else {
      clearFieldError('theme')
    }

    if (
      form.referenceImageUrl.trim() &&
      !/^https?:\/\/.+/.test(form.referenceImageUrl.trim())
    ) {
      nextFieldErrors.referenceImageUrl = 'Please enter a valid image URL.'
      hasError = true
    } else {
      clearFieldError('referenceImageUrl')
    }

    if (hasError) {
      setFieldErrors(nextFieldErrors)
      return
    }

    try {
      setSubmitting(true)
      setError('')

      const result = await submitCustomCakeRequest({
        name: form.name.trim(),
        phone: form.phone.trim(),
        flavour: form.flavour.trim(),
        weight: `${kilograms} kg`,
        theme: form.theme.trim(),
        messageOnCake: form.messageOnCake.trim() || undefined,
        instructions: form.instructions.trim() || undefined,
        referenceImageUrl: form.referenceImageUrl.trim() || undefined,
      })

      setReferenceNumber(result.request.referenceNumber)
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Unable to submit your request. Please call or WhatsApp us instead.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const currentIndex = stepIndex(step)
  const isReview = step === 'review'

  if (referenceNumber) {
    return (
      <div className="rounded-xl border border-border bg-white p-10 sm:p-12 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-3xl mb-4">
          <CheckCircle2 className="size-6" aria-hidden="true" />
        </div>

        <h1 className="text-3xl font-semibold text-primary">
          Request Received
        </h1>

        <p className="mt-3 text-muted-foreground">
          Your custom cake request has been submitted. Our team will call or
          WhatsApp you to confirm the design, price and delivery before we
          start baking.
        </p>

        <div className="mt-6 inline-flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
          <span className="text-xs text-muted-foreground">
            Reference number
          </span>
          <span className="font-mono font-semibold text-primary">
            {referenceNumber}
          </span>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <a
            href={whatsappLink(
              `Hi ${siteConfig.name}! I just submitted custom cake request ${referenceNumber}.`,
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-6 py-3 font-medium hover:bg-muted"
          >
            <MessageCircleIcon className="size-4" />
            Continue on WhatsApp
          </a>

          <button
            type="button"
            onClick={() => {
              setReferenceNumber(null)
              setForm(emptyForm)
              setStep('contact')
            }}
            className="inline-flex rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground hover:opacity-90"
          >
            Submit another request
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Progress indicator */}
      <ol className="flex gap-1 mb-8" aria-label="Request progress">
        {STEPS.map((s, i) => {
          const isComplete = i < currentIndex
          const isCurrent = i === currentIndex
          return (
            <li key={s.key} className="flex-1 relative">
              <div className="flex flex-col items-center gap-1.5">
                <span
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-full border-2 font-semibold',
                    isComplete
                      ? 'bg-primary border-primary text-primary-foreground'
                      : isCurrent
                        ? 'border-primary text-primary bg-white'
                        : 'border-border text-muted-foreground',
                  )}
                >
                  {isComplete ? (
                    <CheckCircle2 className="size-4" aria-hidden="true" />
                  ) : (
                    i + 1
                  )}
                </span>
                <span
                  className={cn(
                    'text-[0.72rem] font-medium uppercase tracking-wider leading-none',
                    isComplete || isCurrent
                      ? 'text-primary font-bold'
                      : 'text-muted-foreground',
                  )}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className="absolute left-1/2 top-3.5 -mt-px w-full h-0.5 -z-10"
                  aria-hidden="true"
                >
                  <div className={cn('h-full', isComplete ? 'bg-primary' : 'bg-border')} />
                </div>
              )}
            </li>
          )
        })}
      </ol>

      <form onSubmit={handleSubmit} noValidate>
        {error && (
          <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Step 1: Contact */}
        {step === 'contact' && (
          <section className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-primary">
                Your details
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                We&apos;ll use this to contact you about your custom cake.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="cc-name" className="mb-2 block text-sm font-medium text-foreground">
                  Your Name *
                </label>
                {fieldErrors.name && (
                  <p className="mb-2 text-xs text-destructive">
                    {fieldErrors.name}
                  </p>
                )}
                <input
                  id="cc-name"
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                  placeholder="Priya"
                  className={fieldErrorClass(Boolean(fieldErrors.name))}
                  required
                />
              </div>

              <div>
                <label htmlFor="cc-phone" className="mb-2 block text-sm font-medium text-foreground">
                  Phone Number *
                </label>
                {fieldErrors.phone && (
                  <p className="mb-2 text-xs text-destructive">
                    {fieldErrors.phone}
                  </p>
                )}
                <input
                  id="cc-phone"
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  pattern="[6-9][0-9]{9}"
                  value={form.phone}
                  onChange={(e) => update('phone', e.target.value)}
                  placeholder="9840916058"
                  className={fieldErrorClass(Boolean(fieldErrors.phone))}
                  required
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => goTo('cake-details')}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                Continue <ArrowLeftIcon className="size-4 rotate-180" aria-hidden="true" />
              </button>
            </div>
          </section>
        )}

        {/* Step 2: Cake details */}
        {step === 'cake-details' && (
          <section className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-primary">
                Cake details
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Tell us what you&apos;d like baked.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="cc-flavour" className="mb-2 block text-sm font-medium text-foreground">
                  Cake Flavour *
                </label>
                {fieldErrors.flavour && (
                  <p className="mb-2 text-xs text-destructive">
                    {fieldErrors.flavour}
                  </p>
                )}
                <input
                  id="cc-flavour"
                  value={form.flavour}
                  onChange={(e) => update('flavour', e.target.value)}
                  placeholder="Chocolate truffle"
                  className={fieldErrorClass(Boolean(fieldErrors.flavour))}
                  required
                />
              </div>

              <div>
                <label htmlFor="cc-weight" className="mb-2 block text-sm font-medium text-foreground">
                  Weight (kg) *
                </label>
                {fieldErrors.weight && (
                  <p className="mb-2 text-xs text-destructive">
                    {fieldErrors.weight}
                  </p>
                )}
                <input
                  id="cc-weight"
                  type="number"
                  min="0.1"
                  max="5"
                  step="0.1"
                  value={form.weight}
                  onChange={(e) => update('weight', e.target.value)}
                  placeholder="1"
                  className={fieldErrorClass(Boolean(fieldErrors.weight))}
                  required
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Between 0.1 kg and 5 kg.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={goBack}
                className="text-sm text-muted-foreground hover:text-foreground underline"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => goTo('design')}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                Continue
              </button>
            </div>
          </section>
        )}

        {/* Step 3: Design & message */}
        {step === 'design' && (
          <section className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-primary">
                Design & message
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Describe the theme, occasion and any message for the cake.
              </p>
            </div>

            <div>
              <label htmlFor="cc-theme" className="mb-2 block text-sm font-medium text-foreground">
                Theme / Occasion *
              </label>
              {fieldErrors.theme && (
                <p className="mb-2 text-xs text-destructive">
                  {fieldErrors.theme}
                </p>
              )}
              <input
                id="cc-theme"
                value={form.theme}
                onChange={(e) => update('theme', e.target.value)}
                placeholder="Birthday, unicorn theme, pastel colours"
                className={fieldErrorClass(Boolean(fieldErrors.theme))}
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="cc-message" className="mb-2 block text-sm font-medium text-foreground">
                Message on Cake
              </label>
              <input
                id="cc-message"
                value={form.messageOnCake}
                onChange={(e) => update('messageOnCake', e.target.value)}
                placeholder="Happy Birthday, Meera!"
                className={fieldErrorClass(false)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Optional. Shown on the cake if space allows.
              </p>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="cc-instructions" className="mb-2 block text-sm font-medium text-foreground">
                Special Instructions
              </label>
              <textarea
                id="cc-instructions"
                value={form.instructions}
                onChange={(e) => update('instructions', e.target.value)}
                placeholder="Eggless, less sugar, delivery before 5 PM…"
                rows={4}
                className={`${fieldErrorClass(false)} resize-none`}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Optional. Any dietary or delivery notes.
              </p>
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={goBack}
                className="text-sm text-muted-foreground hover:text-foreground underline"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => goTo('reference')}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                Continue
              </button>
            </div>
          </section>
        )}

        {/* Step 4: Reference image */}
        {step === 'reference' && (
          <section className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-primary">
                Reference image
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Optionally share a photo or design link for inspiration.
              </p>
            </div>

            <div>
              <label htmlFor="cc-image" className="mb-2 block text-sm font-medium text-foreground">
                Reference Image URL
              </label>
              {fieldErrors.referenceImageUrl && (
                <p className="mb-2 text-xs text-destructive">
                  {fieldErrors.referenceImageUrl}
                </p>
              )}
              <input
                id="cc-image"
                type="url"
                value={form.referenceImageUrl}
                onChange={(e) => update('referenceImageUrl', e.target.value)}
                placeholder="https://…"
                className={fieldErrorClass(Boolean(fieldErrors.referenceImageUrl))}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Optional. Prefer to send a photo? Message us on WhatsApp
              </p>
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={goBack}
                className="text-sm text-muted-foreground hover:text-foreground underline"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => goTo('review')}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                Continue
              </button>
            </div>
          </section>
        )}

        {/* Step 5: Review */}
        {isReview && (
          <section className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-primary">
                Review your request
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Please check the details before submitting.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="shrink-0 text-muted-foreground">Name</span>
                <p className="text-muted-foreground">{form.name}</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="shrink-0 text-muted-foreground">Phone</span>
                <p className="text-muted-foreground">{form.phone}</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="shrink-0 text-muted-foreground">Flavour</span>
                <p className="text-muted-foreground">{form.flavour}</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="shrink-0 text-muted-foreground">Weight</span>
                <p className="text-muted-foreground">{form.weight} kg</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="shrink-0 text-muted-foreground">Theme</span>
                <p className="text-muted-foreground">{form.theme}</p>
              </div>
              {form.messageOnCake && (
                <div className="flex items-start gap-3">
                  <span className="shrink-0 text-muted-foreground">Message</span>
                  <p className="text-muted-foreground">{form.messageOnCake}</p>
                </div>
              )}
              {form.instructions && (
                <div className="flex items-start gap-3">
                  <span className="shrink-0 text-muted-foreground">Instructions</span>
                  <p className="text-muted-foreground">{form.instructions}</p>
                </div>
              )}
              {form.referenceImageUrl && (
                <div className="flex items-start gap-3">
                  <span className="shrink-0 text-muted-foreground">Reference Image</span>
                  <p className="text-muted-foreground text-sm truncate max-w-xs">
                    {form.referenceImageUrl}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={goBack}
                className="text-sm text-muted-foreground hover:text-foreground underline"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                {submitting ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </section>
        )}
      </form>
    </>
  )
}
