'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { withAdminAuth } from '@/components/admin/admin-auth'
import AdminLayout from '@/components/admin/admin-layout'

type CustomCakeRequest = {
  _id: string
  referenceNumber: string
  name: string
  phone: string
  flavour: string
  weight: string
  theme: string
  messageOnCake: string
  instructions: string
  referenceImageUrl: string
  status: 'PENDING' | 'CONTACTED' | 'CONFIRMED' | 'CLOSED'
  createdAt: string
  proposedPrice?: number | null
  proposedDeliveryDate?: string | null
  proposedDeliveryTime?: string | null
  adminNotes?: string | null
  customerConfirmed?: string | null
  customerConfirmedAt?: string | null
  adminContactedAt?: string | null
  convertedOrderId?: string | { _id?: string } | null
  convertedAt?: string | null
}

function formatStatus(status: CustomCakeRequest['status']) {
  return status
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function statusBadge(status: CustomCakeRequest['status']) {
  const isPending = status === 'PENDING'
  const isConfirmed = status === 'CONFIRMED'
  const isClosed = status === 'CLOSED'
  return (
    <span
      className={
        isPending
          ? 'inline-flex items-center gap-1 rounded-full border border-caramel/20 bg-caramel/10 px-2.5 py-0.5 text-xs font-semibold text-caramel'
          : isConfirmed
            ? 'inline-flex items-center gap-1 rounded-full border border-emerald/20 bg-emerald/10 px-2.5 py-0.5 text-xs font-semibold text-emerald'
            : isClosed
              ? 'inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/5 px-2.5 py-0.5 text-xs font-semibold text-destructive'
              : 'inline-flex items-center gap-1 rounded-full border border-border/50 bg-cream px-2.5 py-0.5 text-xs font-semibold text-muted-foreground'
      }
    >
      {formatStatus(status)}
    </span>
  )
}

function AdminCustomCakesPage() {
  const [requests, setRequests] = useState<CustomCakeRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [proposingId, setProposingId] = useState<string | null>(null)
  const [convertingId, setConvertingId] = useState<string | null>(null)
  const [convertDialogId, setConvertDialogId] = useState<string | null>(null)
  const [convertSuccess, setConvertSuccess] = useState<Record<string, { orderNumber: string; orderId?: string; message?: string }>>({})
  const [proposalForm, setProposalForm] = useState<{
    orderId: string | null
    proposedPrice: string
    proposedDeliveryDate: string
    proposedDeliveryTime: string
    adminNotes: string
  } | null>(null)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [search, setSearch] = useState('')

  async function fetchRequests() {
    try {
      setLoading(true)
      setError('')

      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', String(limit))
      if (search.trim()) params.set('search', search.trim())

      const response = await fetch(
        `/api/custom-cake-requests?${params}`,
        {
          cache: 'no-store',
          credentials: 'include',
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Unable to fetch requests')
      }

      // Handle both paginated object and plain array (backward compatible)
      let fetchedRequests: CustomCakeRequest[] = []
      let fetchedTotal = 0
      let fetchedTotalPages = 0

      if (Array.isArray(data)) {
        fetchedRequests = data
        fetchedTotal = data.length
        fetchedTotalPages = 1
      } else {
        fetchedRequests = data.requests ?? []
        fetchedTotal = data.pagination?.total ?? 0
        fetchedTotalPages = data.pagination?.totalPages ?? 1
      }

      setRequests(fetchedRequests)
      setTotal(fetchedTotal)
      setTotalPages(fetchedTotalPages)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to load requests',
      )
    } finally {
      setLoading(false)
    }
  }

  async function convertRequest(requestId: string) {
    try {
      setConvertingId(requestId)
      setError('')

      const response = await fetch(
        `/api/custom-cake-requests/${requestId}/convert`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.message || 'Unable to convert request to order')
      }

      const orderNumber = data?.order?.orderNumber
      const orderId = data?.order?.id
      if (orderNumber) {
        setConvertSuccess((prev) => ({
          ...prev,
          [requestId]: {
            orderNumber,
            orderId,
            message: data?.message,
          },
        }))
      }

      setConvertDialogId(null)
      await fetchRequests()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to convert request to order',
      )
    } finally {
      setConvertingId(null)
    }
  }

  function isRequestConverted(request: CustomCakeRequest) {
    return Boolean(request.convertedOrderId || convertSuccess[request._id]?.orderNumber)
  }

  function canConvertRequest(request: CustomCakeRequest) {
    return request.status === 'CONTACTED' && request.customerConfirmed === 'CONFIRMED' && !isRequestConverted(request)
  }

  useEffect(() => {
    fetchRequests()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit])

  async function updateStatus(
    requestId: string,
    status: CustomCakeRequest['status'],
  ) {
    try {
      setUpdatingId(requestId)
      setError('')

      const response = await fetch(
        `/api/custom-cake-requests/${requestId}/status`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status }),
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Unable to update status')
      }

      setRequests((currentRequests) =>
        currentRequests.map((request) =>
          request._id === requestId
            ? data.request
            : request,
        ),
      )
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to update status',
      )
    } finally {
      setUpdatingId(null)
    }
  }

  async function proposeProposal(requestId: string) {
    if (!proposalForm || proposalForm.orderId !== requestId) return

    const formOrderId = proposalForm.orderId

    try {
      setProposingId(requestId)
      setError('')

      const response = await fetch(
        `/api/custom-cake-requests/${formOrderId}/propose`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            proposedPrice: Number(proposalForm.proposedPrice),
            proposedDeliveryDate: proposalForm.proposedDeliveryDate,
            proposedDeliveryTime: proposalForm.proposedDeliveryTime,
            adminNotes: proposalForm.adminNotes.trim(),
          }),
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Unable to submit proposal')
      }

      setRequests((currentRequests) =>
        currentRequests.map((request) =>
          request._id === formOrderId
            ? {
              ...data.request,
              proposedPrice: proposalForm.proposedPrice
                ? Number(proposalForm.proposedPrice)
                : request.proposedPrice,
              proposedDeliveryDate: proposalForm.proposedDeliveryDate
                ? proposalForm.proposedDeliveryDate
                : request.proposedDeliveryDate,
              proposedDeliveryTime: proposalForm.proposedDeliveryTime
                ? proposalForm.proposedDeliveryTime
                : request.proposedDeliveryTime,
              adminNotes: proposalForm.adminNotes
                ? proposalForm.adminNotes
                : request.adminNotes,
            }
            : request,
        ),
      )

      closeProposalForm()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to submit proposal',
      )
    } finally {
      setProposingId(null)
    }
  }

  function openProposalForm(requestId: string) {
    const request = requests.find((r) => r._id === requestId)
    if (!request) return

    setProposalForm({
      orderId: requestId,
      proposedPrice: String(request.proposedPrice ?? ''),
      proposedDeliveryDate: request.proposedDeliveryDate ?? '',
      proposedDeliveryTime: request.proposedDeliveryTime ?? '',
      adminNotes: request.adminNotes ?? '',
    })
    setError('')
  }

  function closeProposalForm() {
    setProposalForm(null)
    setError('')
  }

  function formatDateInput(dateString?: string | null): string {
    if (!dateString) return ''
    return dateString
  }

  return (
    <AdminLayout>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-semibold text-caramel uppercase tracking-wider">
              Bluebell Bakehouse Admin
            </p>

            <Link
              href="/admin"
              className="text-sm text-muted-foreground hover:underline"
            >
              ← Back to Dashboard
            </Link>

            <h1 className="mt-2 text-3xl font-bold text-primary tracking-tight">
              Custom Cake Requests
            </h1>

            <p className="mt-3 text-muted-foreground leading-relaxed">
              View and manage custom cake requests from customers.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={fetchRequests}
              disabled={loading}
              className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-caramel hover:bg-cream/50 disabled:opacity-60 transition-colors"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
            <label className="grid gap-2 text-sm font-semibold text-foreground">
              Search
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name, phone, reference number"
                className="h-11 rounded-xl border border-border bg-card px-3 font-normal outline-none focus:ring-2 focus:ring-caramel"
              />
            </label>
            <Link
              href="/"
              className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-caramel hover:bg-cream/50 transition-colors"
            >
              View Store
            </Link>
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-[2rem] border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive shadow-sm">
            {error}
          </div>
        )}

        {loading && (
          <div className="mt-10 rounded-[2rem] border border-border bg-card p-12 text-center shadow-sm">
            Loading requests...
          </div>
        )}

        {!loading && !error && requests.length === 0 && (
          <div className="mt-10 rounded-[2rem] border border-border bg-card p-12 text-center shadow-sm">
            <h2 className="text-xl font-semibold text-primary">
              No custom cake requests yet
            </h2>

            <p className="mt-3 text-muted-foreground">
              Custom cake requests will appear here.
            </p>
          </div>
        )}

        {!loading && requests.length > 0 && (
          <div className="mt-10 space-y-8">
            {requests.map((request) => (
              <section
                key={request._id}
                className="rounded-[2rem] border border-border bg-card p-8 shadow-sm sm:p-10"
              >
                {/* Header */}
                <div className="flex flex-col justify-between gap-5 border-b border-border pb-7 sm:flex-row">
                  <div>
                    <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">
                      Reference Number
                    </p>

                    <h2 className="mt-1.5 text-2xl font-bold text-primary tracking-tight">
                      {request.referenceNumber}
                    </h2>

                    <p className="mt-3 text-sm text-muted-foreground">
                      Requested{' '}
                      {new Date(request.createdAt).toLocaleString('en-IN')}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">
                      Status
                    </p>
                    <p className="mt-1 flex items-center justify-end gap-2">
                      <span className="font-semibold text-primary">
                        {formatStatus(request.status)}
                      </span>
                      {statusBadge(request.status)}
                    </p>
                  </div>
                </div>

                {/* Customer details */}
                <div className="grid gap-7 border-b border-border py-7 md:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">
                      Customer
                    </p>

                    <p className="mt-2 font-semibold text-primary">
                      {request.name}
                    </p>

                    <p className="mt-1 text-sm">
                      {request.phone}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">
                      Cake Details
                    </p>

                    <p className="mt-2 font-semibold text-primary">
                      {request.flavour}
                    </p>

                    <p className="mt-1 text-sm text-muted-foreground">
                      {request.weight}
                    </p>
                  </div>
                </div>

                {/* Theme and message */}
                <div className="border-b border-border py-7">
                  <div className="grid gap-7 md:grid-cols-2">
                    <div>
                      <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">
                        Theme
                      </p>

                      <p className="mt-2 font-medium text-primary">
                        {request.theme}
                      </p>
                    </div>

                    {request.messageOnCake && (
                      <div>
                        <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">
                          Message on Cake
                        </p>

                        <p className="mt-2 font-medium text-primary">
                          {request.messageOnCake}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Instructions */}
                {request.instructions && (
                  <div className="border-b border-border py-7">
                    <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">
                      Additional Instructions
                    </p>

                    <p className="mt-2 font-medium text-primary">
                      {request.instructions}
                    </p>
                  </div>
                )}

                {/* Reference image */}
                {request.referenceImageUrl && (
                  <div className="border-b border-border py-7">
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

                {/* Proposed details (shown after admin proposes) */}
                {request.status === 'CONTACTED' || request.status === 'CONFIRMED' ? (
                  <div className="border-b border-border py-7">
                    <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">
                      Proposed Details
                    </p>

                    <div className="mt-2 grid gap-3 md:grid-cols-2">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">
                          Proposed Price
                        </p>
                        <p className="mt-1 font-medium text-primary">
                          ₹{(request.proposedPrice ?? 0).toLocaleString('en-IN')}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">
                          Delivery Date
                        </p>
                        <p className="mt-1 font-medium text-primary">
                          {request.proposedDeliveryDate ?? '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">
                          Delivery Time
                        </p>
                        <p className="mt-1 font-medium text-primary">
                          {request.proposedDeliveryTime ?? '—'}
                        </p>
                      </div>
                      {request.adminNotes && (
                        <div className="md:col-span-2">
                          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">
                            Admin Notes
                          </p>
                          <p className="mt-1 font-medium text-primary">
                            {request.adminNotes}
                          </p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">
                          Customer Response
                        </p>
                        <p className="mt-1 font-medium">
                          {request.customerConfirmed === 'CONFIRMED' ? (
                            <span className="text-emerald">
                              Confirmed
                            </span>
                          ) : request.customerConfirmed === 'DECLINED' ? (
                            <span className="text-destructive">
                              Declined
                            </span>
                          ) : (
                            <span className="text-amber">
                              Pending
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Conversion actions / status */}
                    {(canConvertRequest(request) || isRequestConverted(request)) && (
                      <div className="mt-6 rounded-xl border border-border bg-cream/30 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-primary">
                              {isRequestConverted(request) ? 'Order Conversion' : 'Ready to Convert'}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {isRequestConverted(request)
                                ? (convertSuccess[request._id]?.message || 'This custom cake request has already been converted to an order.')
                                : 'Customer has confirmed the proposal. Convert this request into a PAY_AT_STORE order (payment remains pending).'}
                            </p>
                            {convertSuccess[request._id]?.orderNumber && (
                              <div className="mt-3 flex flex-wrap items-center gap-3">
                                <span className="inline-flex items-center rounded-full border border-emerald/20 bg-emerald/10 px-2.5 py-1 text-xs font-semibold text-emerald">
                                  Order {convertSuccess[request._id].orderNumber}
                                </span>
                                <Link
                                  href="/admin/orders"
                                  className="text-sm font-medium text-caramel underline underline-offset-2 hover:text-caramel/80"
                                >
                                  View in Admin Orders
                                </Link>
                              </div>
                            )}
                            {isRequestConverted(request) && !convertSuccess[request._id]?.orderNumber && (
                              <p className="mt-2 text-sm text-muted-foreground">
                                Converted order exists for this request. Open Admin Orders to view details.
                                {' '}
                                <Link href="/admin/orders" className="font-medium text-caramel underline underline-offset-2 hover:text-caramel/80">View in Admin Orders</Link>
                              </p>
                            )}
                          </div>

                          {canConvertRequest(request) && (
                            <div className="shrink-0">
                              <button
                                type="button"
                                onClick={() => setConvertDialogId(request._id)}
                                disabled={convertingId === request._id}
                                className="rounded-xl bg-caramel px-5 py-2.5 text-sm font-semibold text-caramel-foreground shadow-sm hover:bg-caramel/90 disabled:opacity-60 transition-colors"
                              >
                                {convertingId === request._id ? 'Converting...' : 'Convert to Order'}
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Confirmation dialog */}
                        {convertDialogId === request._id && (
                          <div className="mt-4 rounded-xl border border-caramel/30 bg-card p-4 shadow-sm">
                            <h3 className="text-sm font-semibold text-primary">Confirm conversion to order</h3>
                            <p className="mt-2 text-sm text-muted-foreground">
                              This will create a normal order from this accepted custom cake proposal with <span className="font-medium text-foreground">Pay at Store</span> payment (status remains <span className="font-medium text-foreground">Pending</span>).
                            </p>
                            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                              <div>
                                <dt className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Accepted Price</dt>
                                <dd className="mt-0.5 font-medium text-primary">₹{(request.proposedPrice ?? 0).toLocaleString('en-IN')}</dd>
                              </div>
                              <div>
                                <dt className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Payment</dt>
                                <dd className="mt-0.5 font-medium text-primary">PAY_AT_STORE (Pending)</dd>
                              </div>
                              <div>
                                <dt className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Pickup Date</dt>
                                <dd className="mt-0.5 font-medium text-primary">{request.proposedDeliveryDate ?? '—'}</dd>
                              </div>
                              <div>
                                <dt className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Pickup Time</dt>
                                <dd className="mt-0.5 font-medium text-primary">{request.proposedDeliveryTime ?? '—'}</dd>
                              </div>
                            </dl>
                            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                              <button
                                type="button"
                                onClick={() => setConvertDialogId(null)}
                                disabled={convertingId === request._id}
                                className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-caramel hover:bg-cream/50 disabled:opacity-60 transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => convertRequest(request._id)}
                                disabled={convertingId === request._id}
                                className="rounded-xl bg-caramel px-4 py-2.5 text-sm font-semibold text-caramel-foreground shadow-sm hover:bg-caramel/90 disabled:opacity-60 transition-colors"
                              >
                                {convertingId === request._id ? 'Converting...' : 'Confirm & Convert'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : null}

                {/* Proposal form (admin can propose price and delivery) */}
                {request.status === 'PENDING' ? (
                  <div className="border-b border-border py-7">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">
                        Propose Price & Delivery
                      </p>
                      {proposalForm?.orderId === request._id && (
                        <button
                          type="button"
                          onClick={closeProposalForm}
                          className="text-sm text-muted-foreground hover:text-foreground underline"
                        >
                          Cancel
                        </button>
                      )}
                    </div>

                    {proposalForm?.orderId === request._id ? (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault()
                          proposeProposal(request._id)
                        }}
                        className="space-y-3"
                      >
                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <label
                              htmlFor={`proposed-price-${request._id}`}
                              className="mb-2 block text-sm font-medium text-foreground"
                            >
                              Proposed Price (₹)
                            </label>
                            <input
                              id={`proposed-price-${request._id}`}
                              type="number"
                              min="0"
                              step="0.01"
                              value={proposalForm.proposedPrice}
                              onChange={(event) =>
                                setProposalForm((prev) => {
                                  if (!prev) return prev
                                  return {
                                    ...prev,
                                    proposedPrice: event.target.value,
                                  }
                                })}
                              required
                              className="w-full rounded-xl border border-border bg-card px-4 py-3 outline-none focus:ring-2 focus:ring-caramel"
                            />
                          </div>
                          <div>
                            <label
                              htmlFor={`proposed-date-${request._id}`}
                              className="mb-2 block text-sm font-medium text-foreground"
                            >
                              Delivery Date
                            </label>
                            <input
                              id={`proposed-date-${request._id}`}
                              type="date"
                              value={proposalForm.proposedDeliveryDate}
                              onChange={(event) =>
                                setProposalForm((prev) => {
                                  if (!prev) return prev
                                  return {
                                    ...prev,
                                    proposedDeliveryDate: event.target.value,
                                  }
                                })}
                              required
                              className="w-full rounded-xl border border-border bg-card px-4 py-3 outline-none focus:ring-2 focus:ring-caramel"
                            />
                          </div>
                          <div>
                            <label
                              htmlFor={`proposed-time-${request._id}`}
                              className="mb-2 block text-sm font-medium text-foreground"
                            >
                              Delivery Time
                            </label>
                            <input
                              id={`proposed-time-${request._id}`}
                              type="text"
                              placeholder="e.g., 2:00 PM - 4:00 PM"
                              value={proposalForm.proposedDeliveryTime}
                              onChange={(event) =>
                                setProposalForm((prev) => {
                                  if (!prev) return prev
                                  return {
                                    ...prev,
                                    proposedDeliveryTime: event.target.value,
                                  }
                                })}
                              required
                              className="w-full rounded-xl border border-border bg-card px-4 py-3 outline-none focus:ring-2 focus:ring-caramel"
                            />
                          </div>
                        </div>
                        <div>
                          <label
                            htmlFor={`admin-notes-${request._id}`}
                            className="mb-2 block text-sm font-medium text-foreground"
                          >
                            Admin Notes
                          </label>
                          <textarea
                            id={`admin-notes-${request._id}`}
                            rows={3}
                            value={proposalForm.adminNotes}
                            onChange={(event) =>
                              setProposalForm((prev) => {
                                if (!prev) return prev
                                return {
                                  ...prev,
                                  adminNotes: event.target.value,
                                }
                              })}
                            className="w-full rounded-xl border border-border bg-card px-4 py-3 outline-none focus:ring-2 focus:ring-caramel"
                          />
                        </div>
                        <div className="flex gap-3 pt-4">
                          <button
                            type="button"
                            onClick={closeProposalForm}
                            disabled={proposingId === proposalForm?.orderId}
                            className="flex-1 rounded-xl border border-border px-5 py-3 text-sm font-medium text-caramel hover:bg-cream/50 disabled:opacity-60 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={proposingId === proposalForm?.orderId}
                            className="flex-1 rounded-xl bg-caramel px-5 py-3 text-sm font-semibold text-caramel-foreground shadow-sm hover:bg-caramel/90 disabled:opacity-60 transition-colors"
                          >
                            {proposingId === proposalForm?.orderId ? 'Proposing...' : 'Submit Proposal'}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openProposalForm(request._id)}
                        className="w-full rounded-xl border border-caramel px-5 py-3 text-sm font-medium text-caramel hover:bg-caramel/5 transition-colors"
                      >
                        Propose Price & Delivery
                      </button>
                    )}
                  </div>
                ) : null}

                {/* Status update */}
                <div className="flex flex-col gap-5 pt-7 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <label
                      htmlFor={`status-${request._id}`}
                      className="text-sm font-medium text-foreground"
                    >
                      Update Status
                    </label>

                    <select
                      id={`status-${request._id}`}
                      value={request.status}
                      disabled={updatingId === request._id}
                      onChange={(event) =>
                        updateStatus(
                          request._id,
                          event.target.value as CustomCakeRequest['status'],
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-border bg-card px-4 py-3 outline-none focus:ring-2 focus:ring-caramel disabled:opacity-60 sm:w-72"
                    >
                      <option value="PENDING">
                        Pending
                      </option>

                      <option value="CONTACTED">
                        Contacted
                      </option>

                      <option value="CONFIRMED">
                        Confirmed
                      </option>

                      <option value="CLOSED">
                        Closed
                      </option>
                    </select>
                  </div>

                  {updatingId === request._id && (
                    <p className="text-sm text-muted-foreground">
                      Updating status...
                    </p>
                  )}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground">
            Showing {total} custom cake request{' '}
            {total !== 1 ? 's' : ''}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
            >
              Previous
            </button>

            <span className="text-sm font-medium text-muted-foreground">
              Page {page} of {totalPages}
            </span>

            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
            >
              Next
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">
              Per page:
            </label>
            <select
              value={limit}
              onChange={(event) => {
                setPage(1)
                setLimit(Number(event.target.value))
              }}
              className="rounded-lg border border-border px-3 py-2 text-sm"
            >
              {[10, 20, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

export default withAdminAuth(AdminCustomCakesPage)
