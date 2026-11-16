'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeftIcon, ShoppingBagIcon, ClockIcon } from 'lucide-react'

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
  customerConfirmed?: string | null
  createdAt: string
}

function formatStatus(status: CustomCakeRequest['status'], customerConfirmed?: string | null): string {
  if (customerConfirmed === 'CONFIRMED') return 'Confirmed'
  if (customerConfirmed === 'DECLINED') return 'Declined'
  return status
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function statusBadgeClassName(status: CustomCakeRequest['status'], customerConfirmed?: string | null): string {
  if (customerConfirmed === 'CONFIRMED') return 'bg-emerald/10 text-emerald-700 border-emerald-100'
  if (customerConfirmed === 'DECLINED') return 'bg-destructive/10 text-destructive-700 border-destructive-100'
  if (status === 'CONTACTED') return 'bg-caramel/10 text-caramel-700 border-caramel-100'
  return 'bg-muted text-muted-foreground border-border'
}

export default function CustomerCustomCakeRequestsPage() {
  const router = useRouter()
  const [requests, setRequests] = useState<CustomCakeRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const response = await fetch('/api/custom-cake-requests/my', {
          credentials: 'include',
          cache: 'no-store',
        })
        const data = await response.json().catch(() => ({}))

        if (!active) return

        if (response.status === 401 || response.status === 403) {
          router.replace('/account/login')
          return
        }
        if (!response.ok) {
          throw new Error(data.message || 'Unable to load requests.')
        }
        setRequests(Array.isArray(data.requests) ? data.requests : [])
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Unable to load requests.')
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [router])

  if (loading) return (
    <main className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-champagne-gold/15 text-primary">
          <ShoppingBagIcon className="size-5" aria-hidden="true" />
        </div>
        <p className="mt-4 text-sm text-muted-foreground">Loading your custom cake requests…</p>
      </div>
    </main>
  )

  if (error) return (
    <main className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <p className="text-sm text-destructive">{error}</p>
        <Link
          href="/account"
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl border border-gold-border bg-champagne-gold px-6 py-3 font-semibold text-midnight-navy shadow-sm hover:bg-champagne-gold/90 transition-colors"
        >
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
          My Account
        </Link>
      </div>
    </main>
  )

  if (!requests.length) return (
    <main className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8">
      <section className="mt-12 flex flex-col items-center justify-center min-h-[60vh] rounded-xl border border-gold-border bg-card p-12 text-center shadow-sm">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-champagne-gold/15 text-primary mb-4">
          <ShoppingBagIcon className="size-6" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-bold text-primary mb-2">No custom cake requests yet</h2>
        <p className="text-sm text-muted-foreground mb-8">
          Your custom cake requests will appear here once you place one.
        </p>
        <Link
          href="/custom-cake"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-gold-border bg-champagne-gold px-8 py-3.5 font-semibold text-midnight-navy shadow-sm hover:bg-champagne-gold/90 transition-colors"
        >
          Browse Custom Cakes
        </Link>
      </section>
    </main>
  )

  return (
    <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between gap-4">
        <div>
          <Link
            href="/account"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary transition-colors"
          >
            <ArrowLeftIcon className="size-4" aria-hidden="true" />
            My Account
          </Link>
          <h1 className="mt-1 font-heading text-3xl font-bold text-primary tracking-tight">
            My Custom Cake Requests
          </h1>
        </div>
      </div>

      <section className="mt-12 divide-y divide-gold-border rounded-xl border border-gold-border bg-card shadow-sm">
        {requests.map((request) => (
          <Link
            key={request._id}
            href={`/account/custom-cake-requests/${request._id}`}
            className="block p-6 sm:p-8 hover:bg-champagne-gold/5 transition-colors"
          >
            <div className="flex flex-wrap justify-between gap-4 items-start sm:flex-nowrap">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div>
                  <p className="font-semibold text-primary">{request.referenceNumber}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(request.createdAt).toLocaleString('en-IN')}
                  </p>
                </div>
                <p className="text-base font-semibold text-primary">
                  ₹{(request.proposedPrice ?? 0).toLocaleString('en-IN')}
                </p>
              </div>
              <div className="flex items-center gap-3 mt-4 sm:mt-0 sm:ml-auto">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${statusBadgeClassName(request.status, request.customerConfirmed)}`}
                >
                  {formatStatus(request.status, request.customerConfirmed)}
                </span>
              </div>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              {request.flavour} · {request.weight} · {request.theme}
            </p>
            {request.proposedDeliveryDate && (
              <p className="mt-2 text-sm text-muted-foreground flex items-center gap-1">
                <ClockIcon className="size-3.5" aria-hidden="true" />
                <span>
                  {request.proposedDeliveryDate}
                  {request.proposedDeliveryTime ? ` · ${request.proposedDeliveryTime}` : ''}
                </span>
              </p>
            )}
          </Link>
      ))}
      </section>
    </main>
  )
}