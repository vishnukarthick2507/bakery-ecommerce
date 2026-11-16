'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowLeftIcon, CheckCircle2, ClockIcon } from 'lucide-react'
import { siteConfig, whatsappLink } from '@/lib/site-config'

type CustomCakeRequest = {
  _id: string
  referenceNumber: string
  name: string
  phone: string
  flavour: string
  weight: string
  theme: string
  messageOnCake?: string | null
  instructions?: string | null
  referenceImageUrl?: string | null
  status: 'PENDING' | 'CONTACTED' | 'CONFIRMED' | 'CLOSED'
  proposedPrice?: number | null
  proposedDeliveryDate?: string | null
  proposedDeliveryTime?: string | null
  adminNotes?: string | null
  customerConfirmed?: string | null
  customerConfirmedAt?: string | null
  adminContactedAt?: string | null
  createdAt: string
}

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

export default function CustomerCustomCakeRequestPage() {
  const params = useParams<{ orderId: string }>()
  const router = useRouter()
  const [request, setRequest] = useState<CustomCakeRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [proposing, setProposing] = useState<'CONFIRMED' | 'DECLINED' | null>(null)

  useEffect(() => {
    const requestId = params.orderId
    if (!requestId) {
      setError('Invalid request')
      setLoading(false)
      return
    }

    let active = true
    ;(async () => {
      try {
        const response = await fetch(`/api/custom-cake-requests/${encodeURIComponent(requestId)}`, {
          credentials: 'include',
          cache: 'no-store',
        })
        const data = await response.json().catch(() => ({}))

        if (!active) return

        if (response.status === 401) {
          router.replace('/account/login')
          return
        }
        if (response.status === 403) {
          setError(data.message || 'You are not authorized to view this request.')
          return
        }
        if (!response.ok) {
          throw new Error(data.message || 'Unable to load request.')
        }
        setRequest(data.request ?? null)
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Unable to load request.')
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [params.orderId, router])

  async function handleRespond(response: 'CONFIRMED' | 'DECLINED') {
    if (!request || proposing) return
    setProposing(response)
    setError('')
    try {
      const responseData = await fetch(
        `/api/custom-cake-requests/${encodeURIComponent(
          request._id,
        )}/respond`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ response }),
        },
      )
      const data = await responseData.json()
      if (!responseData.ok) throw new Error(data.message || 'Unable to respond')
      const refreshResponse = await fetch(
        `/api/custom-cake-requests/${encodeURIComponent(request._id)}`,
        {
          credentials: 'include',
          cache: 'no-store',
        },
      )
      const refreshData = await refreshResponse.json()
      if (refreshResponse.ok) {
        setRequest(refreshData.request)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to respond')
    } finally {
      setProposing(null)
    }
  }

  if (loading) return (
    <main className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-champagne-gold/15 text-primary">
          <ClockIcon className="size-5" aria-hidden="true" />
        </div>
        <p className="mt-4 text-sm text-muted-foreground">Loading your request…</p>
      </div>
    </main>
  )

  if (error) return (
    <main className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <p className="text-sm text-destructive">{error}</p>
        <Link
          href="/account/custom-cake-requests"
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl border border-gold-border bg-champagne-gold px-6 py-3 font-semibold text-midnight-navy shadow-sm hover:bg-champagne-gold/90 transition-colors"
        >
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
          Back to custom cake requests
        </Link>
      </div>
    </main>
  )

  if (!request) return null

  const isProposalPending =
    request.status === 'CONTACTED' && request.customerConfirmed === 'PENDING'
  const isConfirmed =
    request.status === 'CONFIRMED' || request.customerConfirmed === 'CONFIRMED'
  const isDeclined =
    request.customerConfirmed === 'DECLINED'

  return (
    <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <Link
            href="/account/custom-cake-requests"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary transition-colors"
          >
            <ArrowLeftIcon className="size-4" aria-hidden="true" />
            My custom cake requests
          </Link>
          <h1 className="mt-1 font-heading text-3xl font-bold text-primary tracking-tight">
            {request.referenceNumber}
          </h1>
          <p className="mt-1 text-sm text-secondary-text">
            {new Date(request.createdAt).toLocaleString('en-IN')}
          </p>
        </div>
        <div className="text-right text-sm">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${isConfirmed
              ? 'bg-emerald/10 text-emerald-700 border-emerald-100'
              : isDeclined
                ? 'bg-destructive/10 text-destructive-700 border-destructive-100'
                : 'bg-muted text-muted-foreground border-border'}`}
          >
            {formatStatus(request.status, request.customerConfirmed)}
          </span>
        </div>
      </div>

      {error && (
        <div className="mt-8 rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive shadow-sm">
          {error}
        </div>
      )}

      {/* Request details */}
      <section className="mt-8 rounded-[2rem] border border-border bg-card p-6 sm:p-8 shadow-sm">
        <div className="grid gap-7 md:grid-cols-2">
          <div>
            <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">
              Customer
            </p>
            <p className="mt-2 font-semibold text-primary">{request.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">{request.phone}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">
              Cake Details
            </p>
            <p className="mt-2 font-semibold text-primary">{request.flavour}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {request.weight}
            </p>
          </div>
        </div>
        <div className="mt-6 border-t border-border pt-6">
          <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">
            Theme
          </p>
          <p className="mt-2 font-medium text-primary">{request.theme}</p>
        </div>
        {request.messageOnCake && (
          <div className="mt-6 border-t border-border pt-6">
            <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">
              Message on Cake
            </p>
            <p className="mt-2 font-medium text-primary">
              “{request.messageOnCake}”
            </p>
          </div>
        )}
        {request.instructions && (
          <div className="mt-6 border-t border-border pt-6">
            <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">
              Special Instructions
            </p>
            <p className="mt-2 font-medium text-primary">{request.instructions}</p>
          </div>
        )}
        {request.referenceImageUrl && (
          <div className="mt-6 border-t border-border pt-6">
            <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">
              Reference Image
            </p>
            <a
              href={request.referenceImageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-sm font-medium text-caramel hover:underline"
            >
              View Image
            </a>
          </div>
        )}
      </section>

      {/* Proposed details section */}
      {request.status === 'CONTACTED' || request.status === 'CONFIRMED' ? (
        <section className="mt-10 rounded-[2rem] border border-caramel bg-caramel/5 p-6 sm:p-8 shadow-sm">
          <div className="flex items-start justify-between mb-6">
            <h2 className="text-xl font-semibold text-primary">
              Proposed Details
            </h2>
            {isProposalPending && (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-caramel/30 bg-caramel/10 px-2.5 py-0.5 text-xs font-semibold text-caramel"
              >
                Awaiting your response
              </span>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-caramel/30 bg-caramel/10 p-4">
              <p className="text-xs font-semibold text-caramel uppercase tracking-wider mb-2">
                Proposed Price
              </p>
              <p className="text-lg font-semibold text-primary">
                ₹{(request.proposedPrice ?? 0).toLocaleString('en-IN')}
              </p>
            </div>
            <div className="rounded-xl border border-caramel/30 bg-caramel/10 p-4">
              <p className="text-xs font-semibold text-caramel uppercase tracking-wider mb-2">
                Delivery Date
              </p>
              <p className="mt-1 text-sm font-semibold text-primary">
                {request.proposedDeliveryDate ?? '—'}
              </p>
            </div>
            <div className="rounded-xl border border-caramel/30 bg-caramel/10 p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">
                Delivery Time
              </p>
              <p className="mt-1 font-medium text-primary">
                {request.proposedDeliveryTime ?? '—'}
              </p>
            </div>
          </div>
          {request.adminNotes && (
            <div className="mt-6 rounded-xl border border-caramel/30 bg-caramel/10 p-4">
              <p className="text-xs font-semibold text-caramel uppercase tracking-wider mb-2">
                Admin Notes
              </p>
              <p className="mt-1 text-sm text-primary">{request.adminNotes}</p>
            </div>
          )}
          {request.adminContactedAt && (
            <div className="mt-6 rounded-xl border border-caramel/30 bg-caramel/10 p-4">
              <p className="text-xs font-semibold text-caramel uppercase tracking-wider mb-2">
                Proposed On
              </p>
              <p className="mt-1 text-sm text-primary">
                {formatDateTime(request.adminContactedAt)}
              </p>
            </div>
          )}
        </section>
      ) : null}

      {/* Customer response section */}
      {isProposalPending ? (
        <section className="mt-10 rounded-[2rem] border border-caramel bg-caramel/5 p-6 sm:p-8 shadow-sm">
          <h2 className="text-xl font-semibold text-primary">
            Respond to Proposal
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The bakery has proposed a new price and delivery time for your
            custom cake order.
          </p>
          <div className="mt-6 flex gap-3 sm:flex-row">
            <button
              type="button"
              disabled={proposing === 'CONFIRMED'}
              onClick={() => handleRespond('CONFIRMED')}
              className="flex-1 rounded-xl bg-caramel px-6 py-4 font-medium text-caramel-foreground disabled:opacity-60 hover:bg-caramel/90 transition-colors"
            >
              {proposing === 'CONFIRMED' ? 'Accepting…' : 'Accept Proposal'}
            </button>
            <button
              type="button"
              disabled={proposing === 'DECLINED'}
              onClick={() => handleRespond('DECLINED')}
              className="flex-1 rounded-xl border border-destructive px-6 py-4 font-medium text-destructive disabled:opacity-60 hover:bg-destructive/5 transition-colors"
            >
              {proposing === 'DECLINED' ? 'Declining…' : 'Decline'}
            </button>
          </div>
          {error && (
            <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {error}
            </div>
          )}
        </section>
      ) : null}

      {/* Confirmed status */}
      {isConfirmed && (
        <section className="mt-10 rounded-[2rem] border border-emerald/30 bg-emerald/5 p-6 sm:p-8 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex size-7 items-center justify-center rounded-full bg-emerald/10 text-emerald shrink-0">
              <CheckCircle2 className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-primary">
                Proposal Accepted
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Your custom cake proposal has been confirmed. The bakery will
                contact you to confirm delivery details.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Declined status */}
      {isDeclined && (
        <section className="mt-10 rounded-[2rem] border border-destructive bg-destructive/5 p-6 sm:p-8 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex size-7 items-center justify-center rounded-full bg-destructive/10 text-destructive shrink-0">
              <ArrowLeftIcon className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-primary">
                Proposal Declined
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                You declined the proposed price and delivery time. Your order
                remains pending. Please contact the bakery to discuss further.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* WhatsApp contact */}
      <section className="mt-10 rounded-[2rem] border border-caramel bg-caramel/5 p-6 sm:p-8 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-7 items-center justify-center rounded-full bg-caramel/10 text-caramel shrink-0">
            <span className="text-lg">💬</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-primary">
              Have Questions?
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Contact Bluebell Bakehouse directly on WhatsApp
            </p>
          </div>
        </div>
        <a
          href={whatsappLink(
            `Hi ${siteConfig.name}! I'd like to discuss my custom cake request ${request.referenceNumber}.`,
          )}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-caramel px-6 py-3 font-medium text-caramel hover:bg-caramel/90 transition-colors"
        >
          <span className="text-lg">💬</span>
          Chat on WhatsApp
        </a>
      </section>
    </main>
  )
}

function formatStatus(
  status: CustomCakeRequest['status'],
  customerConfirmed?: CustomCakeRequest['customerConfirmed'] | null,
): string {
  if (customerConfirmed === 'CONFIRMED') return 'Confirmed'
  if (customerConfirmed === 'DECLINED') return 'Declined'
  if (status === 'CONTACTED') return 'Proposal Sent'
  return status
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}