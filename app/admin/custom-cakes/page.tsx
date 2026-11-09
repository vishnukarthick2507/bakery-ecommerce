'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { withAdminAuth } from '@/components/admin/admin-auth'
import AdminNav from '@/components/admin/admin-nav'

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
  status: 'PENDING' | 'CONTACTED' | 'CLOSED'
  createdAt: string
}

function formatStatus(status: CustomCakeRequest['status']) {
  return status
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function statusBadge(status: CustomCakeRequest['status']) {
  const isPending = status === 'PENDING'
  const isClosed = status === 'CLOSED'
  return (
    <span
      className={
        isPending
          ? 'inline-flex items-center gap-1 rounded-full border border-caramel/20 bg-caramel/10 px-2.5 py-0.5 text-xs font-semibold text-caramel'
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

  useEffect(() => {
    fetchRequests()
  }, [])

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

  return (
    <main className="min-h-screen bg-cream/30">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-semibold text-caramel uppercase tracking-wider">
              S.V. Bakery Admin
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

        <AdminNav className="mt-8" />

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
    </main>
  )
}

export default withAdminAuth(AdminCustomCakesPage)
