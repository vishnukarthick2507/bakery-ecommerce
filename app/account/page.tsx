'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { CustomerProfile } from '@/lib/customer-auth'

export default function AccountPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<CustomerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/auth/me', {
      credentials: 'include',
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok) {
          // A 401/403 means the customer session is genuinely invalid: clear it
          // and send the user back to the account landing page, which offers
          // both sign-in and account creation. Any other status (e.g. 5xx) is a
          // transient server error: keep the valid session and surface the error.
          if (response.status === 401 || response.status === 403) {
            router.replace('/account/landing')
          }
          throw new Error('Unable to load account.')
        }
        const data = await response.json()
        if (!data?.user) {
          router.replace('/account/landing')
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
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    } finally {
      router.replace('/account/login')
    }
  }

  if (loading) return (
    <main className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <div className="rounded-[2rem] border border-border bg-card p-12 text-center shadow-sm">
        <p className="text-muted-foreground">Loading account…</p>
      </div>
    </main>
  )
  if (!profile) return (
    <main className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <div className="rounded-[2rem] border border-border bg-card p-12 text-center shadow-sm">
        {error ? (
          <>
            <p className="text-destructive">{error}</p>
            <button
              onClick={() => router.replace('/account/landing')}
              className="mt-4 inline-flex rounded-xl border border-border px-5 py-2.5 text-sm font-medium hover:bg-cream/50 text-caramel transition-colors"
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
    <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-primary tracking-wide uppercase">
            S.V. Bakery
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-primary tracking-tight">
            My account
          </h1>
        </div>
        <button
          onClick={logout}
          className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium hover:bg-cream/50 text-caramel transition-colors"
        >
          Sign out
        </button>
      </div>

      <section className="mt-10 rounded-[2rem] border border-border bg-card p-8 sm:p-10 shadow-sm">
        <h2 className="text-xl font-semibold text-primary">Account information</h2>
        <dl className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">
              Full name
            </dt>
            <dd className="mt-2 font-medium text-foreground">{profile.name}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">
              Email
            </dt>
            <dd className="mt-2 font-medium text-foreground">{profile.email}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">
              Phone
            </dt>
            <dd className="mt-2 font-medium text-foreground">{profile.phone}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">
              Member since
            </dt>
            <dd className="mt-2 font-medium text-foreground">
              {new Date(profile.createdAt).toLocaleDateString('en-IN')}
            </dd>
          </div>
        </dl>
      </section>

      <Link
        href="/account/orders"
        className="mt-10 inline-flex items-center justify-center gap-2 rounded-xl bg-caramel px-6 py-3.5 font-medium text-caramel-foreground shadow-sm hover:bg-caramel/90 transition-colors"
      >
        View my orders
      </Link>

      <Link
        href="/account/edit-profile"
        className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-border px-6 py-3.5 font-medium text-foreground hover:bg-cream transition-colors"
      >
        Edit profile
      </Link>
    </main>
  )
}
