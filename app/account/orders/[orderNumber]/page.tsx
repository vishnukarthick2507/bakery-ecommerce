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
  const [proposing, setProposing] = useState<'accept' | 'decline' | 'alternative' | null>(null)
  const [alternativeDate, setAlternativeDate] = useState('')
  const [alternativeTime, setAlternativeTime] = useState('')
  const [alternativeNote, setAlternativeNote] = useState('')
const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null)
const [showAlternativeForm, setShowAlternativeForm] = useState(false)
const [switchToPickupConfirmed, setSwitchToPickupConfirmed] = useState(false)

function formatDateTime(dateString: string): string {
  try {
    return new Date(dateString).toLocaleString('en-IN', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateString
  }
}

function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString('en-IN', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return dateString
  }
}

function formatTime(dateString: string): string {
  try {
    return new Date(dateString).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateString
  }
}

function getCountdownSeconds(expiresAt: string | undefined): number | null {
  if (!expiresAt) return null
  const expiry = new Date(expiresAt).getTime()
  const now = new Date().getTime()
  const seconds = Math.max(0, Math.floor((expiry - now) / 1000))
  return seconds > 0 ? seconds : null
}

function formatCountdown(seconds: number | null): string {
  if (seconds === null) return 'Expired'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

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

  useEffect(() => {
    const expiresAt = order?.proposedSlot?.expiresAt
    const status = order?.proposedSlot?.status

    if (!expiresAt || status !== 'PENDING') {
      setCountdownSeconds(null)
      return
    }

    const updateCountdown = () => {
      const seconds = getCountdownSeconds(expiresAt)
      setCountdownSeconds(seconds)
      return seconds
    }

    const initial = updateCountdown()
    if (initial === null) {
      return
    }

    const timerId = setInterval(() => {
      const remaining = updateCountdown()
      if (remaining === null) {
        clearInterval(timerId)
      }
    }, 1000)

    return () => clearInterval(timerId)
  }, [order?.proposedSlot?.expiresAt, order?.proposedSlot?.status])

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
        setShowAlternativeForm(false)
        setAlternativeDate('')
        setAlternativeTime('')
        setAlternativeNote('')
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
        setShowAlternativeForm(true)
        setAlternativeDate('')
        setAlternativeTime('')
        setAlternativeNote('')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to decline proposal')
    } finally {
      setProposing(null)
    }
  }

  async function handleRequestAlternative() {
    if (!order || !alternativeDate || !alternativeTime) return
    setProposing('alternative')
    setError('')
    try {
      const time = new Date(`${alternativeDate}T${alternativeTime}:00`).toISOString()
      const response = await fetch(`/api/orders/${encodeURIComponent(order._id)}/proposal/request-alternative`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ time, note: alternativeNote.trim() }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to request another time')
      const refresh = await fetch(`/api/orders/me/${encodeURIComponent(order.orderNumber)}`, { credentials: 'include', cache: 'no-store' })
      const refreshed = await refresh.json()
      if (refresh.ok) setOrder(refreshed.order)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to request another time')
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

      {order.proposedSlot?.status === 'ACCEPTED' && (
        <section className="mt-8 rounded-[2rem] border border-emerald/30 bg-emerald/5 p-6 sm:p-8 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex size-7 items-center justify-center rounded-full bg-emerald/10 text-emerald shrink-0">
              <ClockIcon className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-primary">Schedule Updated</h2>
              <p className="mt-1 text-sm text-secondary-text">
                Your delivery/pickup time has been changed to{' '}
                <span className="font-semibold text-emerald">
                  {formatDateTime(order.confirmedSlot || order.proposedSlot.time)}
                </span>
                .
              </p>
            </div>
          </div>
        </section>
      )}

      {order.proposedSlot?.status === 'PENDING' && (
        <section className="mt-10 rounded-[2rem] border border-caramel bg-caramel/5 p-6 sm:p-8 shadow-sm">
          <div className="flex items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-primary">
                We need to change your delivery time
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                The bakery has suggested a different time for your order.
              </p>
            </div>
            <div className="text-right flex-1 sm:flex-none">
              <div className="text-sm font-semibold text-caramel">
                {formatCountdown(countdownSeconds)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Time left to respond
              </p>
            </div>
          </div>
          <div className="mt-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-caramel/30 bg-caramel/10 p-4">
                <p className="text-xs font-semibold text-caramel uppercase tracking-wider mb-2">
                  Original time
                </p>
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <ClockIcon className="size-4" aria-hidden="true" />
                  <span>
                    {order.requestedSlot
                      ? formatDateTime(order.requestedSlot)
                      : `${formatDate(order.scheduledDate)} · ${formatTime(order.scheduledTime)}`}
                  </span>
                </p>
              </div>
              <div className="rounded-xl border border-caramel bg-caramel/20 p-4">
                <p className="text-xs font-semibold text-caramel uppercase tracking-wider mb-2">
                  Suggested time
                </p>
                <p className="text-sm font-semibold text-primary flex items-center gap-2">
                  <ClockIcon className="size-4" aria-hidden="true" />
                  <span>
                    {formatDateTime(order.proposedSlot.time)}
                  </span>
                </p>
                {order.proposedSlot.note && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    <span className="font-medium">Note:</span>{' '}
                    {order.proposedSlot.note}
                  </p>
                )}
              </div>
            </div>
            {order.rescheduleProposals?.find((proposal) => proposal.status === 'PENDING') && (
              <div className="rounded-xl border border-caramel/30 bg-caramel/5 p-3 text-xs text-muted-foreground">
                <span className="font-medium">Reason:</span>{' '}
                {order.rescheduleProposals.find((proposal) => proposal.status === 'PENDING')?.reason}
              </div>
            )}
          </div>
          <div className="mt-6 flex gap-3 sm:flex-row">
            <button
              type="button"
              disabled={proposing !== null || isSubmitting}
              onClick={handleAcceptProposal}
              className="flex-1 rounded-xl bg-caramel px-5 py-3 font-medium text-caramel-foreground disabled:opacity-60 hover:bg-caramel/90"
            >
              {proposing === 'accept' ? 'Accepting…' : 'Accept new time'}
            </button>
            <button
              type="button"
              disabled={proposing !== null || isSubmitting}
              onClick={handleDeclineProposal}
              className="flex-1 rounded-xl border border-destructive px-5 py-3 font-medium text-destructive disabled:opacity-60 hover:bg-destructive/5"
            >
              {proposing === 'decline' ? 'Declining…' : 'Decline'}
            </button>
          </div>
          {countdownSeconds === null && (
            <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              Your response time has expired. Your original confirmed delivery
              slot remains unchanged. The bakery will follow up with you.
            </div>
          )}
          {countdownSeconds !== null && showAlternativeForm && (
            <div className="mt-6 grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2">
              <label className="text-sm">
                Preferred date
                <input
                  aria-label="Preferred alternative date"
                  type="date"
                  value={alternativeDate}
                  onChange={(event) => setAlternativeDate(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-border p-2"
                />
              </label>
              <label className="text-sm">
                Preferred time
                <input
                  aria-label="Preferred alternative time"
                  type="time"
                  value={alternativeTime}
                  onChange={(event) => setAlternativeTime(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-border p-2"
                />
              </label>
              <label className="text-sm sm:col-span-2">
                Explanation (optional)
                <textarea
                  value={alternativeNote}
                  onChange={(event) => setAlternativeNote(event.target.value)}
                  maxLength={500}
                  className="mt-1 w-full rounded-lg border border-border p-2"
                  rows={2}
                />
              </label>
              <button
                type="button"
                disabled={proposing !== null || !alternativeDate || !alternativeTime}
                onClick={handleRequestAlternative}
                className="rounded-xl border border-caramel px-4 py-3 text-sm text-caramel disabled:opacity-60 sm:col-span-2"
              >
                {proposing === 'alternative' ? 'Sending request…' : 'Request another time'}
              </button>
            </div>
          )}
          {error && (
            <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {error}
            </div>
          )}
        </section>
      )}

      {order.rescheduleProposals && order.rescheduleProposals.length > 0 && (
        <section className="mt-10 rounded-[2rem] border border-border bg-card p-6 sm:p-8 shadow-sm">
          <h2 className="text-xl font-semibold text-primary">Delivery reschedule history</h2>
          <div className="mt-4 space-y-3">
            {order.rescheduleProposals.map((proposal) => (
              <article key={proposal.proposalId} className="rounded-xl bg-cream/40 p-4 text-sm space-y-1">
                <p>Previous confirmed time: {proposal.previousConfirmedSlot ? new Date(proposal.previousConfirmedSlot).toLocaleString('en-IN') : 'Not recorded'}</p>
                <p>Suggested time: {new Date(proposal.proposedSlot).toLocaleString('en-IN')}</p>
                <p>Reason: {proposal.reason}</p>
                <p>Proposal date: {new Date(proposal.proposedAt).toLocaleString('en-IN')}</p>
                <p>Response: {proposal.customerResponse?.replaceAll('_', ' ') ?? 'Awaiting response'}{proposal.customerResponseAt ? ` · ${new Date(proposal.customerResponseAt).toLocaleString('en-IN')}` : ''}</p>
                {proposal.customerAlternativeSlot && <p>Requested alternative: {new Date(proposal.customerAlternativeSlot).toLocaleString('en-IN')}{proposal.customerAlternativeNote ? ` · ${proposal.customerAlternativeNote}` : ''}</p>}
                <p>Status: {proposal.status.replaceAll('_', ' ')}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {order.proposedSlot?.status === 'DECLINED' && (
        <section className="mt-10 rounded-[2rem] border border-destructive bg-destructive/5 p-6 sm:p-8 shadow-sm">
          <h2 className="text-xl font-semibold text-primary">Proposal declined</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            You declined the suggested time. Your order retains its original
            scheduled time.
          </p>
          {showAlternativeForm && (
            <div className="mt-6 grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2">
              <label className="text-sm">
                Preferred date
                <input
                  aria-label="Preferred alternative date"
                  type="date"
                  value={alternativeDate}
                  onChange={(event) => setAlternativeDate(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-border p-2"
                />
              </label>
              <label className="text-sm">
                Preferred time
                <input
                  aria-label="Preferred alternative time"
                  type="time"
                  value={alternativeTime}
                  onChange={(event) => setAlternativeTime(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-border p-2"
                />
              </label>
              <label className="text-sm sm:col-span-2">
                Explanation (optional)
                <textarea
                  value={alternativeNote}
                  onChange={(event) => setAlternativeNote(event.target.value)}
                  maxLength={500}
                  className="mt-1 w-full rounded-lg border border-border p-2"
                  rows={2}
                />
              </label>
              <button
                type="button"
                disabled={proposing !== null || !alternativeDate || !alternativeTime}
                onClick={handleRequestAlternative}
                className="rounded-xl border border-caramel px-4 py-3 text-sm text-caramel disabled:opacity-60 sm:col-span-2"
              >
                {proposing === 'alternative' ? 'Sending request…' : 'Request another time'}
              </button>
            </div>
          )}
          <div className="mt-6 rounded-xl border border-caramel/30 bg-caramel/5 p-4">
            <h3 className="text-sm font-semibold text-caramel uppercase tracking-wider mb-2">
              Switch to store pickup
            </h3>
            <p className="text-sm text-muted-foreground">
              Pickup changes cannot be made online. Please contact Bluebell
              Bakehouse directly to switch your order to store pickup.
            </p>
          </div>
        </section>
      )}

      {order.proposedSlot?.status === 'ALTERNATIVE_REQUESTED' && (
        <section className="mt-10 rounded-[2rem] border border-caramel bg-caramel/5 p-6 sm:p-8 shadow-sm">
          <h2 className="text-xl font-semibold text-primary">Alternative time requested</h2>
          <p className="mt-2 text-sm text-muted-foreground">Your confirmed delivery schedule has not changed. The bakery will review your preferred time.</p>
        </section>
      )}

      {order.proposedSlot?.status === 'EXPIRED' && (
        <section className="mt-10 rounded-[2rem] border border-destructive bg-destructive/5 p-6 sm:p-8 shadow-sm">
          <h2 className="text-xl font-semibold text-primary">Your response time has expired</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The bakery's suggested time is no longer available. Your original
            confirmed delivery slot remains unchanged. The bakery will follow up
            with you shortly.
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
          {order.proposedSlot?.status === 'ACCEPTED' && order.confirmedSlot ? (
            <>
              <p className="mt-1 text-sm text-emerald font-semibold flex items-center gap-1">
                <ClockIcon className="size-4" aria-hidden="true" />
                Current schedule:{' '}
                {new Date(order.confirmedSlot).toLocaleString('en-IN')}
              </p>
              <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                <span className="text-line-through">Previously scheduled:</span>{' '}
                {order.rescheduleProposals?.find((p) => p.customerResponse === 'ACCEPTED')?.previousConfirmedSlot
                  ? new Date(
                      order.rescheduleProposals.find(
                        (p) => p.customerResponse === 'ACCEPTED',
                      )!.previousConfirmedSlot as string,
                    ).toLocaleString('en-IN')
                  : order.scheduledDate + ' · ' + order.scheduledTime
                }
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              {order.scheduledDate} · {order.scheduledTime}
            </p>
          )}
          <p className="mt-1 text-sm text-muted-foreground">{order.paymentMethod}</p>
        </div>
      </section>
    </main>
  )
}
