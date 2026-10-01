'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from '@/components/cart/cart-provider'

export default function CheckoutPage() {
  const router = useRouter()
  const { items, pricing, clear } = useCart()

  const [fulfilment, setFulfilment] =
    useState<'delivery' | 'pickup'>('delivery')

  const [payment, setPayment] =
    useState<'online' | 'cod'>('cod')

  const [customerName, setCustomerName] = useState('')
  const [phone, setPhone] = useState('')

  const [addressLine, setAddressLine] = useState('')
  const [city, setCity] = useState('')
  const [pincode, setPincode] = useState('')

  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] =
    useState('10:00 AM - 12:00 PM')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!items.length) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <div className="rounded-2xl border p-8 text-center">
          <h1 className="text-3xl font-semibold">
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

  const handlePlaceOrder = async () => {
    setError('')

    if (!customerName.trim()) {
      setError('Please enter your full name.')
      return
    }

    if (!phone.trim()) {
      setError('Please enter your phone number.')
      return
    }

    if (fulfilment === 'delivery') {
      if (!addressLine.trim()) {
        setError('Please enter your delivery address.')
        return
      }

      if (!city.trim()) {
        setError('Please enter your city.')
        return
      }

      if (!pincode.trim()) {
        setError('Please enter your pincode.')
        return
      }
    }

    if (!scheduledDate) {
      setError('Please select your order date.')
      return
    }

    try {
      setIsSubmitting(true)

      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL ||
        'http://localhost:5000'

      const response = await fetch(
        `${apiUrl}/api/orders`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            customerName: customerName.trim(),
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

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.message ||
            'Unable to create your order.',
        )
      }

      clear()

      router.push(
        `/track?order=${encodeURIComponent(
          data.order.orderNumber,
        )}`,
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to create your order.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <Link
          href="/products"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Continue shopping
        </Link>

        <h1 className="mt-3 text-4xl font-semibold">
          Checkout
        </h1>

        <p className="mt-2 text-muted-foreground">
          Enter your details and choose how you
          would like to receive your order.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <section className="space-y-6">
          {/* Customer details */}
          <div className="rounded-2xl border bg-background p-6">
            <h2 className="text-xl font-semibold">
              Customer details
            </h2>

            <div className="mt-5 grid gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Full name
                </label>

                <input
                  type="text"
                  placeholder="Enter your name"
                  value={customerName}
                  onChange={(e) =>
                    setCustomerName(e.target.value)
                  }
                  className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Phone number
                </label>

                <input
                  type="tel"
                  placeholder="Enter your phone number"
                  value={phone}
                  onChange={(e) =>
                    setPhone(e.target.value)
                  }
                  className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2"
                />
              </div>
            </div>
          </div>

          {/* Fulfilment */}
          <div className="rounded-2xl border bg-background p-6">
            <h2 className="text-xl font-semibold">
              Fulfilment
            </h2>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() =>
                  setFulfilment('delivery')
                }
                className={`rounded-xl border p-4 text-left ${
                  fulfilment === 'delivery'
                    ? 'border-primary bg-primary/5'
                    : ''
                }`}
              >
                <div className="font-semibold">
                  Delivery
                </div>

                <div className="mt-1 text-sm text-muted-foreground">
                  Deliver to my address
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  setFulfilment('pickup')
                }
                className={`rounded-xl border p-4 text-left ${
                  fulfilment === 'pickup'
                    ? 'border-primary bg-primary/5'
                    : ''
                }`}
              >
                <div className="font-semibold">
                  Pickup
                </div>

                <div className="mt-1 text-sm text-muted-foreground">
                  Pick up from S.V. Sweets & Bakers
                </div>
              </button>
            </div>

            {fulfilment === 'delivery' && (
              <div className="mt-5 grid gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Address
                  </label>

                  <textarea
                    placeholder="Enter your complete delivery address"
                    rows={4}
                    value={addressLine}
                    onChange={(e) =>
                      setAddressLine(e.target.value)
                    }
                    className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      City
                    </label>

                    <input
                      type="text"
                      placeholder="City"
                      value={city}
                      onChange={(e) =>
                        setCity(e.target.value)
                      }
                      className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Pincode
                    </label>

                    <input
                      type="text"
                      placeholder="Pincode"
                      value={pincode}
                      onChange={(e) =>
                        setPincode(e.target.value)
                      }
                      className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Date and time */}
          <div className="rounded-2xl border bg-background p-6">
            <h2 className="text-xl font-semibold">
              Schedule your order
            </h2>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Date
                </label>

                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) =>
                    setScheduledDate(e.target.value)
                  }
                  className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Time slot
                </label>

                <select
                  value={scheduledTime}
                  onChange={(e) =>
                    setScheduledTime(e.target.value)
                  }
                  className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2"
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
          </div>

          {/* Payment */}
          <div className="rounded-2xl border bg-background p-6">
            <h2 className="text-xl font-semibold">
              Payment method
            </h2>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setPayment('cod')}
                className={`rounded-xl border p-4 text-left ${
                  payment === 'cod'
                    ? 'border-primary bg-primary/5'
                    : ''
                }`}
              >
                <div className="font-semibold">
                  Cash on Delivery
                </div>

                <div className="mt-1 text-sm text-muted-foreground">
                  Pay when your order arrives
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  setPayment('online')
                }
                className={`rounded-xl border p-4 text-left ${
                  payment === 'online'
                    ? 'border-primary bg-primary/5'
                    : ''
                }`}
              >
                <div className="font-semibold">
                  Online Payment
                </div>

                <div className="mt-1 text-sm text-muted-foreground">
                  Razorpay will be connected later
                </div>
              </button>
            </div>
          </div>
        </section>

        {/* Order summary */}
        <aside className="h-fit rounded-2xl border bg-background p-6 lg:sticky lg:top-6">
          <h2 className="text-xl font-semibold">
            Order summary
          </h2>

          <div className="mt-5 space-y-4">
            {pricing.lines.map((line) => (
              <div
                key={`${line.item.productId}-${line.item.variantId}`}
                className="flex justify-between gap-4"
              >
                <div>
                  <p className="font-medium">
                    {line.product.name}
                  </p>

                  <p className="text-sm text-muted-foreground">
                    {line.variant.label} ×{' '}
                    {line.item.quantity}
                  </p>
                </div>

                <p className="font-medium">
                  ₹
                  {line.lineTotal.toLocaleString(
                    'en-IN',
                  )}
                </p>
              </div>
            ))}
          </div>

          <div className="my-6 border-t" />

          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Subtotal
              </span>

              <span>
                ₹
                {pricing.subtotal.toLocaleString(
                  'en-IN',
                )}
              </span>
            </div>

            <div className="flex justify-between text-lg font-semibold">
              <span>Total</span>

              <span>
                ₹
                {pricing.subtotal.toLocaleString(
                  'en-IN',
                )}
              </span>
            </div>
          </div>

          {error && (
            <div className="mt-5 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <button
            type="button"
            disabled={isSubmitting}
            onClick={handlePlaceOrder}
            className="mt-6 w-full rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting
              ? 'Placing Order...'
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