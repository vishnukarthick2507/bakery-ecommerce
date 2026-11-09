'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowLeftIcon, ClockIcon } from 'lucide-react'
import { CustomerOrder, formatOrderStatus } from '@/lib/customer-auth'

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

const statusVariant = (status: string) => {
  const base = 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border'
  switch (status) {
    case 'DELIVERED':
      return `${base} bg-green-50 text-green-700 border-green-100`
    case 'CANCELLED':
      return `${base} bg-red-50 text-red-700 border-red-100`
    case 'PREPARING':
    case 'READY':
    case 'READY_FOR_PICKUP':
    case 'OUT_FOR_DELIVERY':
      return `${base} bg-amber-50 text-amber-700 border-amber-100`
    case 'CONFIRMED':
    case 'PAYMENT_CONFIRMED':
      return `${base} bg-blue-50 text-blue-700 border-blue-100`
    default:
      return `${base} bg-muted text-muted-foreground border-border`
  }
}

export default function CustomerOrderDetailPage() {
  const params = useParams<{ orderNumber: string }>()
  const router = useRouter()
  const [order, setOrder] = useState<CustomerOrder | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [proposing, setProposing] = useState<'accept' | 'decline' | null>(null)

  useEffect(() => {
    fetch(`/api/orders/me/${encodeURIComponent(params.orderNumber)}`, {
      credentials: 'include',
      cache: 'no-store',
    })
      .then(async (response) => {
        const data = await response.json()
        if (response.status === 401 || response.status === 403) {
          router.replace('/account/login')
        }
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
    try {
      setError('')

      const response = await fetch(
        '/api/payments/retry',
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
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
        name: 'Bluebell Bakehouse',
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
              '/api/payments/verify',
              {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
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

  async function handleAcceptProposal() {
    if (!order) return
    setProposing('accept')
    setError('')
    try {
      const response = await fetch(
        `/api/orders/${encodeURIComponent(order._id)}/proposal/accept`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        },
      )
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to accept proposal')
      // Re-fetch order to reflect changes
      const refreshResponse = await fetch(
        `/api/orders/me/${encodeURIComponent(order.orderNumber)}`,
        {
          credentials: 'include',
          cache: 'no-store',
        },
      )
      const refreshData = await refreshResponse.json()
      if (refreshResponse.ok) {
        setOrder(refreshData.order)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to accept proposal')
    } finally {
      setProposing(null)
    }
  }

  async function handleDeclineProposal() {
    if (!order) return
    setProposing('decline')
    setError('')
    try {
      const response = await fetch(
        `/api/orders/${encodeURIComponent(order._id)}/proposal/decline`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        },
      )
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to decline proposal')
      const refreshResponse = await fetch(
        `/api/orders/me/${encodeURIComponent(order.orderNumber)}`,
        {
          credentials: 'include',
          cache: 'no-store',
        },
      )
      const refreshData = await refreshResponse.json()
      if (refreshResponse.ok) {
        setOrder(refreshData.order)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to decline proposal')
    } finally {
      setProposing(null)
    }
  }

  if (loading) return (
    <main className="mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-champagne-gold/15 text-champagne-gold">
          <ClockIcon className="size-5" aria-hidden="true" />
        </div>
        <p className="mt-4 text-sm text-muted-foreground">Loading your order…</p>
      </div>
    </main>
  )
  if (error) return (
    <main className="mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <p className="text-sm text-destructive">{error}</p>
        <Link
          href="/account/orders"
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl border border-gold-border bg-champagne-gold px-6 py-3 font-semibold text-midnight-navy shadow-sm hover:bg-champagne-gold/90 transition-colors"
        >
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
          Back to my orders
        </Link>
      </div>
    </main>
  )
  if (!order) return null

  return (
    <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <Link
            href="/account/orders"
            className="inline-flex items-center gap-2 text-sm font-medium text-secondary-text hover:text-primary transition-colors"
          >
            <ArrowLeftIcon className="size-4" aria-hidden="true" />
            My orders
          </Link>
          <h1 className="mt-1 font-heading text-3xl font-bold text-primary tracking-tight">
            {order.orderNumber}
          </h1>
          <p className="mt-1 text-sm text-secondary-text">
            {new Date(order.createdAt).toLocaleString('en-IN')}
          </p>
        </div>
        <div className="text-right text-sm">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${statusVariant(order.orderStatus)}`}
          >
            {formatOrderStatus(order.orderStatus)}
          </span>
          <p className="mt-1 text-sm text-secondary-text">
            Payment: {order.paymentMethod}
          </p>
        </div>
      </div>

      {order.proposedSlot?.status === 'PENDING' && (
        <section className="mt-10 rounded-[2rem] border border-caramel bg-caramel/5 p-6 sm:p-8 shadow-sm">
          <h2 className="text-xl font-semibold text-primary">New time suggested</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The bakery has suggested a different time for your order.
          </p>
          <div className="mt-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Original time:</span>
              <span>
                {order.requestedSlot
                  ? new Date(order.requestedSlot).toLocaleString('en-IN')
                  : order.scheduledDate + ' ' + order.scheduledTime}
              </span>
            </div>
            <div className="flex justify-between text-sm font-semibold">
              <span className="text-muted-foreground">Suggested time:</span>
              <span>
                {new Date(order.proposedSlot.time).toLocaleString('en-IN')}
              </span>
            </div>
            {order.proposedSlot.note && (
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">Note:</span> {order.proposedSlot.note}
              </div>
            )}
            {order.proposedSlot.expiresAt && (
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">Expires:</span>{' '}
                {new Date(order.proposedSlot.expiresAt).toLocaleString('en-IN')}
              </div>
            )}
          </div>
          <div className="mt-6 flex gap-3 sm:flex-row">
            <button
              type="button"
              disabled={proposing === 'accept' || isSubmitting}
              onClick={handleAcceptProposal}
              className="flex-1 rounded-xl bg-caramel px-5 py-3 font-medium text-caramel-foreground disabled:opacity-60 hover:bg-caramel/90"
            >
              {proposing === 'accept' ? 'Accepting…' : 'Accept'}
            </button>
            <button
              type="button"
              disabled={proposing === 'decline' || isSubmitting}
              onClick={handleDeclineProposal}
              className="flex-1 rounded-xl border border-destructive px-5 py-3 font-medium text-destructive disabled:opacity-60 hover:bg-destructive/5"
            >
              {proposing === 'decline' ? 'Declining…' : 'Decline'}
            </button>
          </div>
          {error && (
            <div className="mt-5 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {error}
            </div>
          )}
        </section>
      )}

      {order.proposedSlot?.status === 'DECLINED' && (
        <section className="mt-10 rounded-[2rem] border border-destructive bg-destructive/5 p-6 sm:p-8 shadow-sm">
          <h2 className="text-xl font-semibold text-primary">Proposal declined</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            You declined the suggested time. Your order retains its original
            scheduled time. Contact the bakery if you need to arrange a new
            time.
          </p>
        </section>
      )}

      {order.paymentMethod === 'ONLINE' &&
        order.paymentStatus !== 'PAID' &&
        order.orderStatus !== 'CANCELLED' &&
        (order.paymentStatus === 'FAILED' || order.paymentStatus === 'PENDING') && (
          <section className="mt-10 rounded-[2rem] border border-border bg-card p-6 sm:p-8 shadow-sm">
            <h2 className="text-xl font-semibold text-primary">Retry Payment</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your online payment was not completed. You can retry payment for this order.
            </p>
            {error && (
              <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
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
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-caramel px-6 py-4 font-medium text-caramel-foreground shadow-sm hover:bg-caramel/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Processing Payment…' : 'Retry Payment'}
            </button>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              You will not be charged twice for the same order.
            </p>
          </section>
        )}

      <section className="mt-10 rounded-[2rem] border border-border bg-card p-6 sm:p-8 shadow-sm">
        <h2 className="text-xl font-semibold text-primary mb-1">
          Items
        </h2>
        <div className="mt-4 divide-y divide-border">
          {order.items.map((item) => (
            <div
              key={`${item.productId}-${item.variantId}`}
              className="flex justify-between gap-4 py-4"
            >
              <div>
                <p className="font-medium text-foreground">
                  {item.productName}
                </p>
                <p className="text-sm text-muted-foreground">
                  {item.quantity} × ₹{item.unitPrice.toLocaleString('en-IN')}
                </p>
              </div>
              <p className="font-medium text-primary">
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

      <section className="mt-10 grid gap-6 rounded-[2rem] border border-border bg-card p-6 sm:p-8 shadow-sm sm:grid-cols-2">
        <div>
          <h2 className="font-semibold text-primary uppercase tracking-wider text-sm">Customer</h2>
          <p className="mt-2 text-sm">{order.customer?.name ?? order.customerName}</p>
          {order.customer?.email && (
            <p className="mt-1 text-sm text-muted-foreground">{order.customer.email}</p>
          )}
          <p className="mt-1 text-sm text-muted-foreground">{order.customer?.phone ?? order.phone}</p>
        </div>
        <div>
          <h2 className="font-semibold text-primary uppercase tracking-wider text-sm">
            {order.fulfillmentType === 'DELIVERY' ? 'Delivery address' : 'Pickup'}
          </h2>
          <p className="mt-2 text-sm">
            {order.address
              ? `${order.address.addressLine}, ${order.address.city}, ${order.address.pincode}`
              : 'Pick up from Bluebell Bakehouse'}
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
