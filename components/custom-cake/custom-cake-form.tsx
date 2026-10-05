'use client'

import { useState } from 'react'
import { MessageCircleIcon } from 'lucide-react'

import { ApiError, submitCustomCakeRequest } from '@/lib/api'
import { siteConfig, whatsappLink } from '@/lib/site-config'

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

const inputClass =
  'mt-2 w-full rounded-lg border bg-background px-4 py-3 outline-none focus:ring-2'

export function CustomCakeForm() {
  const [form, setForm] = useState<FormState>(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [referenceNumber, setReferenceNumber] =
    useState<string | null>(null)

  function update(
    field: keyof FormState,
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    try {
      setSubmitting(true)
      setError('')

      const result = await submitCustomCakeRequest({
        name: form.name.trim(),
        phone: form.phone.trim(),
        flavour: form.flavour.trim(),
        weight: form.weight.trim(),
        theme: form.theme.trim(),
        messageOnCake:
          form.messageOnCake.trim() || undefined,
        instructions:
          form.instructions.trim() || undefined,
        referenceImageUrl:
          form.referenceImageUrl.trim() || undefined,
      })

      setReferenceNumber(
        result.request.referenceNumber,
      )
      setForm(emptyForm)
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

  if (referenceNumber) {
    return (
      <div className="rounded-2xl border bg-background p-10 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl">
          ✅
        </div>

        <h1 className="mt-6 text-3xl font-semibold">
          Request received
        </h1>

        <p className="mt-3 text-muted-foreground">
          Your reference number is{' '}
          <span className="font-mono font-semibold text-foreground">
            {referenceNumber}
          </span>
          . Our team will call or WhatsApp you to
          confirm the design, price and delivery
          before we start baking.
        </p>

        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <a
            href={whatsappLink(
              `Hi ${siteConfig.name}! I just submitted custom cake request ${referenceNumber}.`,
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-lg border px-6 py-3 font-medium hover:bg-muted"
          >
            <MessageCircleIcon className="size-4" />
            Continue on WhatsApp
          </a>

          <button
            type="button"
            onClick={() =>
              setReferenceNumber(null)
            }
            className="inline-flex rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground hover:opacity-90"
          >
            Submit another request
          </button>
        </div>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border bg-background p-6 shadow-sm sm:p-8"
    >
      <h1 className="text-2xl font-bold">
        Design your cake
      </h1>

      <p className="mt-2 text-sm text-muted-foreground">
        Share the details below and our team will
        contact you to confirm the design and price.
        Please allow at least 48 hours&apos; notice.
      </p>

      {error && (
        <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        <div>
          <label
            htmlFor="cc-name"
            className="text-sm font-medium"
          >
            Your Name *
          </label>

          <input
            id="cc-name"
            value={form.name}
            onChange={(event) =>
              update('name', event.target.value)
            }
            placeholder="Priya"
            className={inputClass}
            required
          />
        </div>

        <div>
          <label
            htmlFor="cc-phone"
            className="text-sm font-medium"
          >
            Phone *
          </label>

          <input
            id="cc-phone"
            type="tel"
            value={form.phone}
            onChange={(event) =>
              update('phone', event.target.value)
            }
            placeholder="+91 98409 16058"
            className={inputClass}
            required
          />
        </div>

        <div>
          <label
            htmlFor="cc-flavour"
            className="text-sm font-medium"
          >
            Cake Flavour *
          </label>

          <input
            id="cc-flavour"
            value={form.flavour}
            onChange={(event) =>
              update('flavour', event.target.value)
            }
            placeholder="Chocolate truffle"
            className={inputClass}
            required
          />
        </div>

        <div>
          <label
            htmlFor="cc-weight"
            className="text-sm font-medium"
          >
            Weight *
          </label>

          <input
            id="cc-weight"
            value={form.weight}
            onChange={(event) =>
              update('weight', event.target.value)
            }
            placeholder="1 kg"
            className={inputClass}
            required
          />
        </div>

        <div className="sm:col-span-2">
          <label
            htmlFor="cc-theme"
            className="text-sm font-medium"
          >
            Theme / Occasion *
          </label>

          <input
            id="cc-theme"
            value={form.theme}
            onChange={(event) =>
              update('theme', event.target.value)
            }
            placeholder="Birthday, unicorn theme, pastel colours"
            className={inputClass}
            required
          />
        </div>

        <div className="sm:col-span-2">
          <label
            htmlFor="cc-message"
            className="text-sm font-medium"
          >
            Message on Cake
          </label>

          <input
            id="cc-message"
            value={form.messageOnCake}
            onChange={(event) =>
              update(
                'messageOnCake',
                event.target.value,
              )
            }
            placeholder="Happy Birthday, Meera!"
            className={inputClass}
          />
        </div>

        <div className="sm:col-span-2">
          <label
            htmlFor="cc-instructions"
            className="text-sm font-medium"
          >
            Special Instructions
          </label>

          <textarea
            id="cc-instructions"
            value={form.instructions}
            onChange={(event) =>
              update(
                'instructions',
                event.target.value,
              )
            }
            placeholder="Eggless, less sugar, delivery before 5 PM…"
            rows={4}
            className={`${inputClass} resize-none`}
          />
        </div>

        <div className="sm:col-span-2">
          <label
            htmlFor="cc-image"
            className="text-sm font-medium"
          >
            Reference Image URL
          </label>

          <input
            id="cc-image"
            type="url"
            value={form.referenceImageUrl}
            onChange={(event) =>
              update(
                'referenceImageUrl',
                event.target.value,
              )
            }
            placeholder="https://…"
            className={inputClass}
          />

          <p className="mt-2 text-xs text-muted-foreground">
            Prefer to send a photo? Message us on{' '}
            <a
              href={whatsappLink(
                `Hi ${siteConfig.name}! I'd like to discuss a custom cake.`,
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              WhatsApp
            </a>
            .
          </p>
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="mt-8 w-full rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting
          ? 'Submitting…'
          : 'Submit Request'}
      </button>
    </form>
  )
}
