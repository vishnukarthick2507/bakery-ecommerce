'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { CustomerOrder, customerAuthHeaders, formatOrderStatus } from '@/lib/customer-auth'

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

export default function CustomerOrderDetailPage() {
  const params = useParams<{ orderNumber: string }>()
  const router = useRouter()
  const [order, setOrder] = useState<CustomerOrder | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!window.localStorage.getItem('customer-token')) {
      router.replace('/account/login')
      return
    }
    fetch(`/api/orders/me/${encodeURIComponent(params.orderNumber)}`, {
      headers: customerAuthHeaders(),
      cache: 'no-store',
    })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.message || 'Unable to load order.')
        setOrder(data.order)
      })
      .catch((requestError: unknown) => setError(requestError instanceof Error ? requestError.message : 'Unable to load order.'))
      .finally(() => setLoading(false))
  }, [params.orderNumber, router])

  const startRetryPayment = async (
    orderNumber: string,
    totalAmount: number,
    customerName: string,
    phone: string,
  ): Promise<boolean> => {
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL ||
      'http://localhost:5000'

    try {
      setError('')

      const response = await fetch(
        `${apiUrl}/api/payments/retry`,
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
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to start payment.',
      )

      setIsSubmitting(false)
      return false
    }
  }

  if (loading) return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <div className="rounded-xl border border-border p-10 text-center">
        <p className="text-muted-foreground">Loading order…</p>
      </div>
    </main>
  )
  if (error) return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <div className="rounded-xl border border-border p-10 text-center shadow-sm">
        <p className="text-destructive">{error}</p>
        <Link href="/account/orders" className="mt-4 inline-flex underline text-sm">
          Back to my orders
        </Link>
      </div>
    </main>
  )
  if (!order) return null

  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <Link href="/account/orders" className="text-sm text-muted-foreground hover:underline">
            ← My orders
          </Link>
          <h1 className="mt-3 text-3xl font-semibold text-primary">{order.orderNumber}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date(order.createdAt).toLocaleString('en-IN')}
          </p>
        </div>
        <div className="text-right text-sm">
          <p className="font-semibold">{formatOrderStatus(order.orderStatus)}</p>
          <p className="mt-1 text-muted-foreground">Payment: {order.paymentStatus}</p>
        </div>
      </div>

      {order.paymentMethod === 'ONLINE' &&
        order.paymentStatus !== 'PAID' &&
        order.orderStatus !== 'CANCELLED' &&
        (order.paymentStatus === 'FAILED' || order.paymentStatus === 'PENDING') && (
          <section className="mt-6 rounded-xl border border-border bg-white p-6 sm:p-8 shadow-sm">
            <h2 className="text-xl font-semibold text-primary">Retry Payment</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your online payment was not completed. You can retry payment for this order.
            </p>
            {error && (
              <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                setIsSubmitting(true)
                void startRetryPayment(
                  order.orderNumber,
                  order.totalAmount,
                  order.customer?.name ?? order.customerName,
                  order.customer?.phone ?? order.phone,
                )
              }}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Processing Payment…' : 'Retry Payment'}
            </button>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              You will not be charged twice for the same order.
            </p>
          </section>
        )}

      <section className="mt-6 rounded-xl border border-border bg-white p-6 sm:p-8 shadow-sm">
        <h2 className="text-xl font-semibold text-primary">Items</h2>
        <div className="mt-4 divide-y divide-border">
          {order.items.map((item) => (
            <div
              key={`${item.productId}-${item.variantId}`}
              className="flex justify-between gap-4 py-4"
            >
              <div>
                <p className="font-medium">{item.productName}</p>
                <p className="text-sm text-muted-foreground">
                  {item.quantity} × ₹{item.unitPrice.toLocaleString('en-IN')}
                </p>
              </div>
              <p className="font-medium">
                ₹{(item.itemTotal ?? item.totalPrice).toLocaleString('en-IN')}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-4 border-t border-border pt-4 text-sm">
          <p className="flex justify-between"><span>Subtotal</span><span>₹{order.subtotal.toLocaleString('en-IN')}</span></p>
          <p className="mt-2 flex justify-between"><span>Delivery fee</span><span>₹{order.deliveryFee.toLocaleString('en-IN')}</span></p>
          <p className="mt-3 flex justify-between text-base font-semibold text-primary"><span>Total</span><span>₹{order.totalAmount.toLocaleString('en-IN')}</span></p>
        </div>
      </section>

      <section className="mt-5 grid gap-5 rounded-xl border border-border bg-white p-6 sm:p-8 shadow-sm sm:grid-cols-2">
        <div>
          <h2 className="font-semibold text-primary">Customer</h2>
          <p className="mt-2 text-sm">{order.customer?.name ?? order.customerName}</p>
          {order.customer?.email && (
            <p className="mt-1 text-sm text-muted-foreground">{order.customer.email}</p>
          )}
          <p className="mt-1 text-sm text-muted-foreground">{order.customer?.phone ?? order.phone}</p>
        </div>
        <div>
          <h2 className="font-semibold text-primary">
            {order.fulfillmentType === 'DELIVERY' ? 'Delivery address' : 'Pickup'}
          </h2>
          <p className="mt-2 text-sm">
            {order.address
              ? `${order.address.addressLine}, ${order.address.city}, ${order.address.pincode}`
              : 'Pick up from S.V. Bakery'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {order.scheduledDate} · {order.scheduledTime}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{order.paymentMethod}</p>
        </div>
      </section>
    </main>
  )
}
