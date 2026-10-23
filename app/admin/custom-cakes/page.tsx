'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { withAdminAuth } from '@/components/admin/admin-auth'

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

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

function formatStatus(status: CustomCakeRequest['status']) {
  return status
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function AdminCustomCakesPage() {
  const [requests, setRequests] = useState<CustomCakeRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  async function fetchRequests() {
    try {
      setLoading(true)
      setError('')

      const response = await fetch(`${API_URL}/api/custom-cake-requests`, {
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('admin-token')}`,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Unable to fetch requests')
      }

      setRequests(data.requests ?? [])
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
        `${API_URL}/api/custom-cake-requests/${requestId}/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('admin-token')}`,
          },
          body: JSON.stringify({ status }),
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.message || 'Unable to update status',
        )
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
        err instanceof Error
          ? err.message
          : 'Unable to update status',
      )
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <main className="min-h-screen bg-muted/20">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-medium text-primary">
              The Cake Point Admin
            </p>

            <Link
              href="/admin"
              className="text-sm text-muted-foreground hover:underline"
            >
              ← Back to Dashboard
            </Link>

            <h1 className="mt-3 text-3xl font-bold">
              Custom Cake Requests
            </h1>

            <p className="mt-2 text-muted-foreground">
              View and manage custom cake requests from customers.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchRequests}
            disabled={loading}
            className="rounded-lg border bg-background px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading && (
          <div className="mt-8 rounded-2xl border bg-background p-10 text-center">
            Loading requests...
          </div>
        )}

        {!loading && !error && requests.length === 0 && (
          <div className="mt-8 rounded-2xl border bg-background p-10 text-center">
            <h2 className="text-xl font-semibold">
              No custom cake requests yet
            </h2>

            <p className="mt-2 text-muted-foreground">
              Custom cake requests will appear here.
            </p>
          </div>
        )}

        {!loading && requests.length > 0 && (
          <div className="mt-8 space-y-6">
            {requests.map((request) => (
              <section
                key={request._id}
                className="rounded-2xl border bg-background p-6 shadow-sm sm:p-8"
              >
                {/* Header */}
                <div className="flex flex-col justify-between gap-4 border-b pb-6 sm:flex-row">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Reference Number
                    </p>

                    <h2 className="mt-1 text-2xl font-bold">
                      {request.referenceNumber}
                    </h2>

                    <p className="mt-2 text-sm text-muted-foreground">
                      Requested{' '}
                      {new Date(request.createdAt).toLocaleString('en-IN')}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground">
                      Status
                    </p>

                    <p className="mt-1 text-xl font-bold">
                      {formatStatus(request.status)}
                    </p>
                  </div>
                </div>

                {/* Customer details */}
                <div className="grid gap-6 border-b py-6 md:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Customer
                    </p>

                    <p className="mt-1 font-semibold">
                      {request.name}
                    </p>

                    <p className="mt-1 text-sm">
                      {request.phone}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground">
                      Cake Details
                    </p>

                    <p className="mt-1 font-semibold">
                      {request.flavour}
                    </p>

                    <p className="mt-1 text-sm text-muted-foreground">
                      {request.weight}
                    </p>
                  </div>
                </div>

                {/* Theme and message */}
                <div className="border-b py-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Theme
                      </p>

                      <p className="mt-1 font-medium">
                        {request.theme}
                      </p>
                    </div>

                    {request.messageOnCake && (
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Message on Cake
                        </p>

                        <p className="mt-1 font-medium">
                          {request.messageOnCake}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Instructions */}
                {request.instructions && (
                  <div className="border-b py-6">
                    <p className="text-sm text-muted-foreground">
                      Additional Instructions
                    </p>

                    <p className="mt-1 font-medium">
                      {request.instructions}
                    </p>
                  </div>
                )}

                {/* Reference image */}
                {request.referenceImageUrl && (
                  <div className="border-b py-6">
                    <p className="text-sm text-muted-foreground">
                      Reference Image
                    </p>

                    <a
                      href={request.referenceImageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
                    >
                      View Image
                    </a>
                  </div>
                )}

                {/* Status update */}
                <div className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <label
                      htmlFor={`status-${request._id}`}
                      className="text-sm font-medium"
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
                      className="mt-2 w-full rounded-lg border bg-background px-4 py-3 outline-none focus:ring-2 disabled:opacity-60 sm:w-72"
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
    </main>
  )
}

export default withAdminAuth(AdminCustomCakesPage)
