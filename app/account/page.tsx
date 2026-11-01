'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { clearCustomerSession, customerAuthHeaders, type CustomerProfile } from '@/lib/customer-auth'

export default function AccountPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<CustomerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const token = window.localStorage.getItem('customer-token')
    if (!token) {
      router.replace('/account/login')
      return
    }

    fetch('/api/auth/me', {
      headers: customerAuthHeaders(),
      credentials: 'include',
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok) {
          // A 401/403 means the customer session is genuinely invalid: clear it
          // and send the user back to login. Any other status (e.g. 5xx) is a
          // transient server error: keep the valid session and surface the error.
          if (response.status === 401 || response.status === 403) {
            clearCustomerSession()
            router.replace('/account/login')
          }
          throw new Error('Unable to load account.')
        }
        const data = await response.json()
        if (!data?.user) {
          // Unexpected response shape: keep the valid customer session rather
          // than clearing it over a temporary/server formatting issue.
          throw new Error('Unable to load account.')
        }
        setProfile(data.user)
      })
      .catch((requestError: unknown) => {
        // Network or transient errors must not clear a valid customer session.
        setError(requestError instanceof Error ? requestError.message : 'Unable to load account.')
      })
      .finally(() => setLoading(false))
  }, [router])

  async function logout() {
    const headers = customerAuthHeaders()
    try {
      await fetch('/api/auth/logout', { method: 'POST', headers, credentials: 'include' })
    } finally {
      clearCustomerSession()
      router.replace('/account/login')
    }
  }

  if (loading) return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <div className="rounded-xl border border-border p-10 text-center">
        <p className="text-muted-foreground">Loading account…</p>
      </div>
    </main>
  )
  if (!profile) return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <div className="rounded-xl border border-border p-10 text-center">
        {error ? (
          <>
            <p className="text-destructive">{error}</p>
            <button
              onClick={() => router.replace('/account/login')}
              className="mt-4 inline-flex rounded-lg border border-border px-5 py-2 text-sm font-medium hover:bg-muted"
            >
              Sign in
            </button>
          </>
        ) : (
          <p className="text-muted-foreground">Redirecting to sign in…</p>
        )}
      </div>
    </main>
  )

  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-primary">S.V. Bakery</p>
          <h1 className="mt-2 text-3xl font-semibold text-primary">My account</h1>
        </div>
        <button
          onClick={logout}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          Sign out
        </button>
      </div>

      <section className="mt-8 rounded-xl border border-border bg-white p-6 sm:p-8 shadow-sm">
        <h2 className="text-xl font-semibold text-primary">Account information</h2>
        <dl className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-muted-foreground">Full name</dt>
            <dd className="mt-1 font-medium">{profile.name}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Email</dt>
            <dd className="mt-1 font-medium">{profile.email}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Phone</dt>
            <dd className="mt-1 font-medium">{profile.phone}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Member since</dt>
            <dd className="mt-1 font-medium">{new Date(profile.createdAt).toLocaleDateString('en-IN')}</dd>
          </div>
        </dl>
      </section>

      <Link
        href="/account/orders"
        className="mt-8 inline-flex rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground hover:opacity-90"
      >
        View my orders
      </Link>
    </main>
  )
}
