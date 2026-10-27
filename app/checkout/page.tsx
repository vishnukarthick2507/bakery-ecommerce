'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from '@/components/cart/cart-provider'
import { customerAuthHeaders } from '@/lib/customer-auth'
import { cn } from '@/lib/utils'
import { formatPrice } from '@/lib/format'

type RazorpayHandlerResponse = {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}

type RazorpayInstance = {
  open: () => void
  on: (
    event: 'payment.failed',
    callback: (response: {
      error?: { description?: string }
    }) => void,
  ) => void
}

declare global {
  interface Window {
    Razorpay?: new (options: {
      key: string
      amount: number
      currency: string
      name: string
      description: string
      order_id: string
      prefill: { name: string; contact: string }
      theme: { color: string }
      handler: (response: RazorpayHandlerResponse) => void
      modal?: { ondismiss?: () => void }
    }) => RazorpayInstance
  }
}

let razorpayScriptPromise: Promise<void> | null = null

function loadRazorpayScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(
      new Error('Payment gateway is unavailable.'),
    )
  }

  if (window.Razorpay) return Promise.resolve()

  if (!razorpayScriptPromise) {
    razorpayScriptPromise = new Promise<void>(
      (resolve, reject) => {
        const script = document.createElement('script')
        script.src =
          'https://checkout.razorpay.com/v1/checkout.js'

        script.onload = () => resolve()

        script.onerror = () => {
          razorpayScriptPromise = null
          reject(
            new Error(
              'Unable to load the payment gateway. Please check your connection and try again.',
            ),
          )
        }

        document.body.appendChild(script)
      },
    )
  }

  return razorpayScriptPromise
}

type Step = 'details' | 'fulfilment' | 'schedule' | 'payment' | 'summary'

const STEPS: Array<{ key: Step; label: string }> = [
  { key: 'details', label: 'Your details' },
  { key: 'fulfilment', label: 'Delivery or pickup' },
  { key: 'schedule', label: 'Date & time' },
  { key: 'payment', label: 'Payment' },
  { key: 'summary', label: 'Confirm' },
]

const stepIndex = (key: Step) => STEPS.findIndex((s) => s.key === key)

export default function CheckoutPage() {
  const router = useRouter()
  const { items, pricing, clear } = useCart()

  const [fulfilment, setFulfilment] =
    useState<'delivery' | 'pickup'>('delivery')

  const [payment, setPayment] =
    useState<'online' | 'cod' | 'pay_at_store'>('cod')

  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [phone, setPhone] = useState('')

  const [addressLine, setAddressLine] = useState('')
  const [city, setCity] = useState('')
  const [pincode, setPincode] = useState('')

  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] =
    useState('10:00 AM - 12:00 PM')

  const [settings, setSettings] = useState<{
    onlineOrdersEnabled: boolean
    deliveryEnabled: boolean
    pickupEnabled: boolean
    closedMessage: string
  } | null>(null)
  const [settingsLoaded, setSettingsLoaded] = useState(false)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // An ONLINE order that is created but not yet paid, so retries
  // reuse the same order instead of creating duplicates.
  const [pendingOnlineOrder, setPendingOnlineOrder] =
    useState<string | null>(null)
  const orderIdempotencyKey = useRef<string | null>(null)

  const [activeStep, setActiveStep] = useState<Step>('details')

  useEffect(() => {
    const token = window.localStorage.getItem('customer-token')
    if (!token) return
    void fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok) return
        const data = await response.json()
        setCustomerName((current) => current || data.user.name)
        setCustomerEmail((current) => current || data.user.email)
        setPhone((current) => current || data.user.phone)
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    void fetch('/api/settings', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return
        const data = await response.json()
        setSettings(data.settings ?? null)
      })
      .catch(() => undefined)
      .finally(() => setSettingsLoaded(true))
  }, [])

  useEffect(() => {
    if (!settings || !settingsLoaded) return
    if (fulfilment === 'delivery' && !settings.deliveryEnabled) {
      setFulfilment(settings.pickupEnabled ? 'pickup' : 'delivery')
    }
    if (fulfilment === 'pickup' && !settings.pickupEnabled) {
      setFulfilment(settings.deliveryEnabled ? 'delivery' : 'pickup')
    }
  }, [settings, settingsLoaded, fulfilment])

  if (!items.length) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <div className="rounded-xl border border-border p-8 text-center">
          <h1 className="text-3xl font-semibold text-primary">
            Your cart is empty
          </h1>

          <p className="mt-3 text-muted-foreground">
            Add some delicious items before checking out.
          </p>

          <Link
            href="/products"
            className="mt-6 inline-flex rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground"
          >
            Browse products
          </Link>
        </div>
      </main>
    )
  }

  const clearFieldError = (field: string) => {
    setFieldErrors((prev) => {
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  const startOnlinePayment = async (
    orderNumber: string,
    apiUrl: string,
  ): Promise<boolean> => {
    const response = await fetch(
      `${apiUrl}/api/payments/create-order`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...customerAuthHeaders(),
        },
        body: JSON.stringify({ orderNumber }),
      },
    )

    const data = await response.json()

    if (!response.ok) {
      throw new Error(
        data.message ||
          'Unable to start online payment.',
      )
    }

    await loadRazorpayScript()

    if (!window.Razorpay) {
      throw new Error(
        'Unable to load the payment gateway. Please try again or choose Cash on Delivery.',
      )
    }

    const razorpay = new window.Razorpay({
      key: data.keyId,
      amount: data.amount,
      currency: data.currency,
      name: 'S.V. Bakery',
      description: `Order ${data.orderNumber}`,
      order_id: data.razorpayOrderId,

      prefill: {
        name: customerName.trim(),
        contact: phone.trim(),
      },

      theme: { color: '#0B2744' },

      handler: async (
        paymentResponse: RazorpayHandlerResponse,
      ) => {
        try {
          const verifyResponse = await fetch(
            `${apiUrl}/api/payments/verify`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...customerAuthHeaders(),
              },
              body: JSON.stringify(paymentResponse),
            },
          )

          const verifyData =
            await verifyResponse.json()

          if (!verifyResponse.ok) {
            throw new Error(
              verifyData.message ||
                'Payment verification failed.',
            )
          }

          clear()
          setPendingOnlineOrder(null)

          if (typeof window !== 'undefined') {
            window.sessionStorage.setItem(`guest-track-phone-${data.orderNumber}`, phone.trim())
            window.sessionStorage.setItem('guest-track-phone', phone.trim())
          }

          router.push(
            `/track?order=${encodeURIComponent(
              data.orderNumber,
            )}`,
          )
        } catch (err) {
          setError(
            `${
              err instanceof Error
                ? err.message
                : 'Payment verification failed.'
            } Your order ${orderNumber} is saved — do not pay again. If money was deducted, contact us on WhatsApp.`,
          )

          setIsSubmitting(false)
        }
      },

      modal: {
        ondismiss: () => {
          setError(
            `Payment was cancelled. Your order ${orderNumber} is saved — press the pay button to try again.`,
          )

          setIsSubmitting(false)
        },
      },
    })

    razorpay.on(
      'payment.failed',
      (failureResponse) => {
        setError(
          `Payment failed${
            failureResponse?.error?.description
              ? `: ${failureResponse.error.description}`
              : ''
          }. Your order ${orderNumber} is saved — you can try again.`,
        )

        setIsSubmitting(false)
      },
    )

    razorpay.open()

    return true
  }

  const handlePlaceOrder = async () => {
    setError('')
    setFieldErrors({})

    if (!settings?.onlineOrdersEnabled) {
      setError(
        settings?.closedMessage ||
          'Online ordering is currently closed. Please check back soon.',
      )
      return
    }

    let hasError = false
    const nextFieldErrors: Record<string, string> = {}

    if (!customerName.trim()) {
      nextFieldErrors.customerName = 'Please enter your full name.'
      hasError = true
    } else {
      clearFieldError('customerName')
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim())) {
      nextFieldErrors.customerEmail = 'Enter a valid email address.'
      hasError = true
    } else {
      clearFieldError('customerEmail')
    }

    if (!phone.trim()) {
      nextFieldErrors.phone = 'Please enter your phone number.'
      hasError = true
    } else if (!/^[6-9]\d{9}$/.test(phone.trim())) {
      nextFieldErrors.phone = 'Enter a valid 10-digit Indian mobile number.'
      hasError = true
    } else {
      clearFieldError('phone')
    }

    if (fulfilment === 'delivery') {
      if (!addressLine.trim()) {
        nextFieldErrors.addressLine = 'Please enter your delivery address.'
        hasError = true
      } else {
        clearFieldError('addressLine')
      }

      if (!city.trim()) {
        nextFieldErrors.city = 'Please enter your city.'
        hasError = true
      } else {
        clearFieldError('city')
      }

      if (!pincode.trim()) {
        nextFieldErrors.pincode = 'Please enter your pincode.'
        hasError = true
      } else {
        clearFieldError('pincode')
      }
    }

    if (!scheduledDate) {
      nextFieldErrors.scheduledDate = 'Please select your order date.'
      hasError = true
    } else {
      clearFieldError('scheduledDate')
    }

    if (hasError) {
      setFieldErrors(nextFieldErrors)
      // Move to first step with an error
      const firstErrorKey = Object.keys(nextFieldErrors)[0]
      if (firstErrorKey === 'customerName' || firstErrorKey === 'customerEmail' || firstErrorKey === 'phone') {
        setActiveStep('details')
      } else if (firstErrorKey === 'addressLine' || firstErrorKey === 'city' || firstErrorKey === 'pincode') {
        setActiveStep('fulfilment')
      } else if (firstErrorKey === 'scheduledDate') {
        setActiveStep('schedule')
      }
      return
    }

    setIsSubmitting(true)

    try {
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL ||
        'http://localhost:5000'

      let orderNumber =
        payment === 'online'
          ? pendingOnlineOrder
          : null

      if (!orderNumber) {
        orderIdempotencyKey.current ??=
          window.sessionStorage.getItem('checkout-order-idempotency-key') ||
          window.crypto.randomUUID()
        window.sessionStorage.setItem(
          'checkout-order-idempotency-key',
          orderIdempotencyKey.current,
        )
        const response = await fetch(
          `${apiUrl}/api/orders`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Idempotency-Key': orderIdempotencyKey.current,
              ...customerAuthHeaders(),
            },
            body: JSON.stringify({
              customerName: customerName.trim(),
              email: customerEmail.trim().toLowerCase(),
              phone: phone.trim(),

              fulfillmentType:
                fulfilment === 'delivery'
                  ? 'DELIVERY'
                  : 'PICKUP',

              ...(fulfilment === 'delivery'
                ? {
                    address: {
                      addressLine:
                        addressLine.trim(),
                      city: city.trim(),
                      pincode:
                        pincode.trim(),
                    },
                  }
                : {}),

              scheduledDate,
              scheduledTime,

              paymentMethod:
                payment === 'online'
                  ? 'ONLINE'
                  : 'COD',

              items: items.map((item) => {
                const line = pricing.lines.find(
                  (line) =>
                    line.item.productId ===
                      item.productId &&
                    line.item.variantId ===
                      item.variantId,
                )

                return {
                  productId: item.productId,
                  productName:
                    line?.product.name || 'Product',
                  variantId: item.variantId,
                  quantity: item.quantity,
                }
              }),
            }),
          },
        )

        const data: {
          message?: string
          order: { orderNumber: string }
        } = await response.json()

        if (!response.ok) {
          throw new Error(
            data.message ||
              'Unable to create your order.',
          )
        }

        orderNumber = data.order.orderNumber
        window.sessionStorage.removeItem('checkout-order-idempotency-key')
        orderIdempotencyKey.current = null

        if (payment === 'cod' || payment === 'pay_at_store') {
          clear()

          if (typeof window !== 'undefined') {
            window.sessionStorage.setItem(`guest-track-phone-${orderNumber}`, phone.trim())
            window.sessionStorage.setItem('guest-track-phone', phone.trim())
          }

          router.push(
            `/track?order=${encodeURIComponent(
              orderNumber,
            )}`,
          )

          return
        }

        setPendingOnlineOrder(orderNumber)
      }

      // Returns true when the Razorpay modal opened; its
      // callbacks own the isSubmitting state from here.
      const opened = await startOnlinePayment(
        orderNumber,
        apiUrl,
      )

      if (!opened) {
        setIsSubmitting(false)
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to create your order.',
      )

      setIsSubmitting(false)
    }
  }

  const currentStepIndex = stepIndex(activeStep)

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <Link
          href="/products"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Continue shopping
        </Link>

        <h1 className="mt-3 text-3xl font-semibold text-primary">
          Checkout
        </h1>

        <p className="mt-2 text-muted-foreground">
          Enter your details and choose how you
          would like to receive your order.
        </p>
      </div>

      {/* Progress indicator */}
      <ol className="flex gap-1 mb-8" aria-label="Checkout progress">
        {STEPS.map((step, i) => {
          const isComplete = i < currentStepIndex
          const isCurrent = i === currentStepIndex
          return (
            <li key={step.key} className="flex-1 relative">
              <div className="flex flex-col items-center gap-2">
                <span
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors',
                    isComplete
                      ? 'bg-primary text-primary-foreground border-primary'
                      : isCurrent
                        ? 'border-primary text-primary'
                        : 'border-border text-muted-foreground',
                  )}
                >
                  {i + 1}
                </span>
                {isComplete && (
                  <svg className="absolute size-3 text-primary" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
                <span
                  className={cn(
                    'text-[0.7rem] font-medium uppercase tracking-wider',
                    isComplete || isCurrent
                      ? 'text-primary font-bold'
                      : 'text-muted-foreground',
                  )}
                >
                  {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className="absolute left-1/2 top-8 -mt-0.5 w-full h-0.5 -z-10" aria-hidden="true">
                  <div className={cn('h-full', isComplete ? 'bg-primary' : 'bg-border')} />
                </div>
              )}
            </li>
          )
        })}
      </ol>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <section className="space-y-6">
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {error}
            </div>
          )}

          {!settings?.onlineOrdersEnabled && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {settings?.closedMessage ||
                'Online ordering is currently closed. Please check back soon.'}
            </div>
          )}

          {/* Step: Customer details */}
          {activeStep === 'details' && (
            <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-primary mb-1">
                Customer details
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                We&apos;ll use this to confirm your order.
              </p>

              <div className="mt-5 grid gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Full name
                  </label>
                  {fieldErrors.customerName && (
                    <p className="mb-1 text-xs text-destructive">
                      {fieldErrors.customerName}
                    </p>
                  )}
                  <input
                    type="text"
                    placeholder="Enter your name"
                    value={customerName}
                    onChange={(e) => {
                      setCustomerName(e.target.value)
                      clearFieldError('customerName')
                    }}
                    onBlur={() => clearFieldError('customerName')}
                    className={cn(
                      'w-full rounded-lg border px-4 py-3 outline-none focus:ring-2',
                      fieldErrors.customerName
                        ? 'border-destructive focus:ring-destructive'
                        : 'border-border focus:ring-primary',
                    )}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Email address
                  </label>
                  {fieldErrors.customerEmail && (
                    <p className="mb-1 text-xs text-destructive">
                      {fieldErrors.customerEmail}
                    </p>
                  )}
                  <input
                    type="email"
                    autoComplete="email"
                    maxLength={254}
                    placeholder="Enter your email address"
                    value={customerEmail}
                    onChange={(e) => {
                      setCustomerEmail(e.target.value)
                      clearFieldError('customerEmail')
                    }}
                    onBlur={() => clearFieldError('customerEmail')}
                    className={cn(
                      'w-full rounded-lg border px-4 py-3 outline-none focus:ring-2',
                      fieldErrors.customerEmail
                        ? 'border-destructive focus:ring-destructive'
                        : 'border-border focus:ring-primary',
                    )}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Phone number
                  </label>
                  {fieldErrors.phone && (
                    <p className="mb-1 text-xs text-destructive">
                      {fieldErrors.phone}
                    </p>
                  )}
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    pattern="[6-9][0-9]{9}"
                    placeholder="Enter your phone number"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value)
                      clearFieldError('phone')
                    }}
                    onBlur={() => clearFieldError('phone')}
                    className={cn(
                      'w-full rounded-lg border px-4 py-3 outline-none focus:ring-2',
                      fieldErrors.phone
                        ? 'border-destructive focus:ring-destructive'
                        : 'border-border focus:ring-primary',
                    )}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveStep('fulfilment')}
                disabled={isSubmitting}
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                Continue <span aria-hidden="true">›</span>
              </button>
            </div>
          )}

          {/* Step: Fulfilment */}
          {activeStep === 'fulfilment' && (
            <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-primary mb-1">
                Delivery or pickup
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                How would you like to receive your order?
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {!settings?.deliveryEnabled ? null : (
                  <button
                    type="button"
                    disabled={!settings?.onlineOrdersEnabled}
                    onClick={() => setFulfilment('delivery')}
                    className={`flex flex-col gap-2 rounded-xl border p-4 text-left transition-colors ${
                      fulfilment === 'delivery' && settings?.deliveryEnabled
                        ? 'border-primary bg-primary/5'
                        : !settings?.deliveryEnabled
                          ? 'border-border opacity-50'
                          : 'border-border hover:bg-muted'
                    }`}
                  >
                    <div className="font-semibold text-foreground">
                      Delivery
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Deliver to my address
                    </div>
                    {!settings?.onlineOrdersEnabled && (
                      <div className="mt-1 text-xs text-destructive">
                        Ordering is currently closed
                      </div>
                    )}
                  </button>
                )}
                {!settings?.pickupEnabled ? null : (
                  <button
                    type="button"
                    disabled={!settings?.onlineOrdersEnabled}
                    onClick={() => setFulfilment('pickup')}
                    className={`flex flex-col gap-2 rounded-xl border p-4 text-left transition-colors ${
                      fulfilment === 'pickup' && settings?.pickupEnabled
                        ? 'border-primary bg-primary/5'
                        : !settings?.pickupEnabled
                          ? 'border-border opacity-50'
                          : 'border-border hover:bg-muted'
                    }`}
                  >
                    <div className="font-semibold text-foreground">Pickup</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Pick up from S.V. Bakery
                    </div>
                    {!settings?.onlineOrdersEnabled && (
                      <div className="mt-1 text-xs text-destructive">
                        Ordering is currently closed
                      </div>
                    )}
                  </button>
                )}
              </div>

              {fulfilment === 'delivery' && (
                <div className="mt-6 grid gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">
                      Address
                    </label>
                    {fieldErrors.addressLine && (
                      <p className="mb-1 text-xs text-destructive">
                        {fieldErrors.addressLine}
                      </p>
                    )}
                    <textarea
                      placeholder="Enter your complete delivery address"
                      rows={4}
                      value={addressLine}
                      onChange={(e) => {
                        setAddressLine(e.target.value)
                        clearFieldError('addressLine')
                      }}
                      onBlur={() => clearFieldError('addressLine')}
                      className={cn(
                        'w-full rounded-lg border px-4 py-3 outline-none focus:ring-2',
                        fieldErrors.addressLine
                          ? 'border-destructive focus:ring-destructive'
                          : 'border-border focus:ring-primary',
                      )}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">
                        City
                      </label>
                      {fieldErrors.city && (
                        <p className="mb-1 text-xs text-destructive">
                          {fieldErrors.city}
                        </p>
                      )}
                      <input
                        type="text"
                        placeholder="City"
                        value={city}
                        onChange={(e) => {
                          setCity(e.target.value)
                          clearFieldError('city')
                        }}
                        onBlur={() => clearFieldError('city')}
                        className={cn(
                          'w-full rounded-lg border px-4 py-3 outline-none focus:ring-2',
                          fieldErrors.city
                            ? 'border-destructive focus:ring-destructive'
                            : 'border-border focus:ring-primary',
                        )}
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">
                        Pincode
                      </label>
                      {fieldErrors.pincode && (
                        <p className="mb-1 text-xs text-destructive">
                          {fieldErrors.pincode}
                        </p>
                      )}
                      <input
                        type="text"
                        placeholder="Pincode"
                        value={pincode}
                        onChange={(e) => {
                          setPincode(e.target.value)
                          clearFieldError('pincode')
                        }}
                        onBlur={() => clearFieldError('pincode')}
                        className={cn(
                          'w-full rounded-lg border px-4 py-3 outline-none focus:ring-2',
                          fieldErrors.pincode
                            ? 'border-destructive focus:ring-destructive'
                            : 'border-border focus:ring-primary',
                        )}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-8 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveStep('details')}
                  className="text-sm text-muted-foreground hover:text-foreground underline"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStep('schedule')}
                  disabled={isSubmitting}
                  className="ml-auto inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
                >
                  Continue <span aria-hidden="true">›</span>
                </button>
              </div>
            </div>
          )}

          {/* Step: Schedule */}
          {activeStep === 'schedule' && (
            <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-primary mb-1">
                Schedule your order
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                Choose when you&apos;d like to pick up or receive your order.
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Date
                  </label>
                  {fieldErrors.scheduledDate && (
                    <p className="mb-1 text-xs text-destructive">
                      {fieldErrors.scheduledDate}
                    </p>
                  )}
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => {
                      setScheduledDate(e.target.value)
                      clearFieldError('scheduledDate')
                    }}
                    className={cn(
                      'w-full rounded-lg border px-4 py-3 outline-none focus:ring-2',
                      fieldErrors.scheduledDate
                        ? 'border-destructive focus:ring-destructive'
                        : 'border-border focus:ring-primary',
                    )}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Time slot
                  </label>
                  <select
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 border-border focus:ring-primary"
                  >
                    <option>
                      10:00 AM - 12:00 PM
                    </option>
                    <option>
                      12:00 PM - 2:00 PM
                    </option>
                    <option>
                      2:00 PM - 4:00 PM
                    </option>
                    <option>
                      4:00 PM - 6:00 PM
                    </option>
                    <option>
                      6:00 PM - 8:00 PM
                    </option>
                  </select>
                </div>
              </div>

              <div className="mt-8 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveStep('fulfilment')}
                  className="text-sm text-muted-foreground hover:text-foreground underline"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStep('payment')}
                  disabled={isSubmitting}
                  className="ml-auto inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
                >
                  Continue <span aria-hidden="true">›</span>
                </button>
              </div>
            </div>
          )}

          {/* Step: Payment */}
          {activeStep === 'payment' && (
            <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-primary mb-1">
                Payment method
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                Choose how you&apos;d like to pay.
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {fulfilment === 'delivery' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setPayment('cod')
                        setPendingOnlineOrder(null)
                      }}
                      className={`flex flex-col gap-2 rounded-xl border p-4 text-left transition-colors ${payment === 'cod' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'}`}
                    >
                      <div className="font-semibold text-foreground">Cash on Delivery</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        Pay when your order arrives
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPayment('online')
                        setPendingOnlineOrder(null)
                      }}
                      className={`flex flex-col gap-2 rounded-xl border p-4 text-left transition-colors ${payment === 'online' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'}`}
                    >
                      <div className="font-semibold text-foreground">Online Payment</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        Pay securely via Razorpay — UPI,
                        cards & netbanking
                      </div>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setPayment('online')
                        setPendingOnlineOrder(null)
                      }}
                      className={`flex flex-col gap-2 rounded-xl border p-4 text-left transition-colors ${payment === 'online' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'}`}
                    >
                      <div className="font-semibold text-foreground">Online Payment</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        Pay securely via Razorpay — UPI,
                        cards & netbanking
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPayment('pay_at_store')
                        setPendingOnlineOrder(null)
                      }}
                      className={`flex flex-col gap-2 rounded-xl border p-4 text-left transition-colors ${payment === 'pay_at_store' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'}`}
                    >
                      <div className="font-semibold text-foreground">Pay at Store</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        Pay when you collect your order
                      </div>
                    </button>
                  </>
                )}
              </div>

              <div className="mt-8 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveStep('schedule')}
                  className="text-sm text-muted-foreground hover:text-foreground underline"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStep('summary')}
                  disabled={isSubmitting}
                  className="ml-auto inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
                >
                  Continue <span aria-hidden="true">›</span>
                </button>
              </div>
            </div>
          )}

          {/* Step: Summary */}
          {activeStep === 'summary' && (
            <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-primary mb-1">
                Review your order
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                Please review your order before placing it.
              </p>

              <div className="space-y-4">
                <div className="flex justify-between items-start py-3 border-b border-border">
                  <div>
                    <p className="font-medium text-foreground">
                      {fulfilment === 'delivery' ? 'Delivery' : 'Pickup'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {scheduledDate} · {scheduledTime}
                    </p>
                  </div>
                  <p className="font-medium text-primary">
                    {payment === 'online'
                      ? 'Online Payment'
                      : payment === 'pay_at_store'
                        ? 'Pay at Store'
                        : 'Cash on Delivery'}
                  </p>
                </div>

                <div className="space-y-3">
                  {pricing.lines.map((line) => (
                    <div
                      key={`${line.item.productId}-${line.item.variantId}`}
                      className="flex justify-between gap-4"
                    >
                      <div>
                        <p className="font-medium text-foreground">
                          {line.product.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {line.variant.label} ×{' '}
                          {line.item.quantity}
                        </p>
                      </div>
                      <p className="font-medium text-primary">
                        {formatPrice(line.lineTotal)}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="my-4 border-t border-border" />

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Subtotal
                    </span>
                    <span>{formatPrice(pricing.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold text-primary">
                    <span>Total</span>
                    <span>{formatPrice(pricing.subtotal)}</span>
                  </div>
                </div>

                {pendingOnlineOrder && (
                  <div className="mt-5 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-primary">
                    Order{' '}
                    <span className="font-semibold">
                      {pendingOnlineOrder}
                    </span>{' '}
                    is awaiting payment. Press the button
                    below to pay — you will not be charged
                    twice for the same order.
                  </div>
                )}

                {error && (
                  <div className="mt-5 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}
              </div>

              <div className="mt-8 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveStep('payment')}
                  className="text-sm text-muted-foreground hover:text-foreground underline"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handlePlaceOrder}
                  className="ml-auto inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
                >
                  {isSubmitting
                    ? payment === 'online'
                      ? 'Processing Payment…'
                      : 'Placing Order…'
                    : pendingOnlineOrder
                      ? 'Retry Payment'
                      : payment === 'online'
                        ? 'Place Order & Pay Online'
                        : 'Place Order'}
                </button>
              </div>

              <p className="mt-4 text-center text-xs text-muted-foreground">
                Your order will be securely saved to our system.
              </p>
            </div>
          )}
        </section>

        {/* Order summary sidebar */}
        <aside className="h-fit rounded-xl border border-border p-6 shadow-sm lg:sticky lg:top-6">
          <h2 className="text-xl font-semibold text-primary">
            Order summary
          </h2>

          <div className="mt-5 space-y-4">
            {pricing.lines.map((line) => (
              <div
                key={`${line.item.productId}-${line.item.variantId}`}
                className="flex justify-between gap-4"
              >
                <div>
                  <p className="font-medium text-foreground line-clamp-1">
                    {line.product.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {line.variant.label} ×{' '}
                    {line.item.quantity}
                  </p>
                </div>
                <p className="font-medium text-primary">
                  {formatPrice(line.lineTotal)}
                </p>
              </div>
            ))}
          </div>

          <div className="my-6 border-t border-border" />

          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Subtotal
              </span>
              <span>{formatPrice(pricing.subtotal)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-primary">
              <span>Total</span>
              <span>{formatPrice(pricing.subtotal)}</span>
            </div>
          </div>

          <p className="mt-4 text-xs text-muted-foreground text-center">
            Delivery is currently free on all orders.
          </p>

          {pendingOnlineOrder && (
            <div className="mt-5 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-primary">
              Order{' '}
              <span className="font-semibold">
                {pendingOnlineOrder}
              </span>{' '}
              is awaiting payment. Press the pay button
              below to pay — you will not be charged
              twice for the same order.
            </div>
          )}

          {error && (
            <div className="mt-5 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <button
            type="button"
            disabled={isSubmitting}
            onClick={handlePlaceOrder}
            className="mt-6 w-full rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting
              ? payment === 'online'
                ? 'Processing Payment…'
                : 'Placing Order…'
              : pendingOnlineOrder
                ? 'Retry Payment'
                : payment === 'online'
                  ? 'Place Order & Pay Online'
                  : 'Place Order'}
          </button>

          <p className="mt-3 text-center text-xs text-muted-foreground">
            Your order will be securely saved to
            our system.
          </p>
        </aside>
      </div>
    </main>
  )
}
