'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { LogOutIcon, UserIcon, MailIcon, PhoneIcon, CalendarIcon, ShoppingBagIcon } from 'lucide-react'
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

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-champagne-gold/15 text-champagne-gold">
            <ShoppingBagIcon className="size-5" aria-hidden="true" />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Loading your account…</p>
        </div>
      </main>
    )
  }

  if (!profile) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          {error ? (
            <>
              <p className="text-sm text-destructive">{error}</p>
              <button
                onClick={() => router.replace('/account/landing')}
                className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl border border-gold-border bg-champagne-gold px-6 py-3 font-semibold text-midnight-navy shadow-sm hover:bg-champagne-gold/90 transition-colors"
              >
                Sign in
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">Redirecting to sign in…</p>
            </>
          )}
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-champagne-gold tracking-widest uppercase">
            Bluebell Bakehouse
          </p>
          <h1 className="mt-1 font-heading text-3xl font-bold text-primary tracking-tight">
            My account
          </h1>
        </div>
        <button
          onClick={logout}
          className="inline-flex items-center gap-2 rounded-xl border border-gold-border bg-white px-5 py-2.5 text-sm font-semibold text-secondary-text shadow-sm hover:bg-gold-border/50 hover:text-primary transition-colors"
        >
          <LogOutIcon className="size-4" aria-hidden="true" />
          Sign out
        </button>
      </div>

      <section className="mt-12 rounded-xl border border-gold-border bg-white shadow-sm">
        <div className="p-8 sm:p-10">
          <h2 className="font-heading text-xl font-bold text-primary mb-8">
            Account information
          </h2>
          <dl className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <dt className="text-sm font-semibold text-secondary-text uppercase tracking-wider">
                Full name
              </dt>
              <dd className="text-base font-medium text-primary">{profile.name}</dd>
            </div>
            <div className="flex flex-col gap-1.5">
              <dt className="text-sm font-semibold text-secondary-text uppercase tracking-wider">
                Email
              </dt>
              <dd className="flex items-center gap-2 text-base font-medium text-primary">
                <MailIcon className="size-4 text-secondary-text" aria-hidden="true" />
                {profile.email}
              </dd>
            </div>
            <div className="flex flex-col gap-1.5">
              <dt className="text-sm font-semibold text-secondary-text uppercase tracking-wider">
                Phone
              </dt>
              <dd className="flex items-center gap-2 text-base font-medium text-primary">
                <PhoneIcon className="size-4 text-secondary-text" aria-hidden="true" />
                {profile.phone}
              </dd>
            </div>
            <div className="flex flex-col gap-1.5">
              <dt className="text-sm font-semibold text-secondary-text uppercase tracking-wider">
                Member since
              </dt>
              <dd className="text-base font-medium text-primary">
                <CalendarIcon className="size-4 text-secondary-text mr-2" aria-hidden="true" />
                {new Date(profile.createdAt).toLocaleDateString('en-IN')}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        <Link
          href="/account/orders"
          className="flex flex-col items-center justify-center py-10 rounded-xl border border-gold-border bg-white shadow-sm hover:bg-gold-border/50 hover:text-primary transition-all"
        >
          <ShoppingBagIcon className="mb-3 size-5 text-champagne-gold" aria-hidden="true" />
          <span className="font-semibold text-primary">My orders</span>
          <span className="mt-1 text-xs text-secondary-text">View order history &amp; tracking</span>
        </Link>

        <Link
          href="/account/edit-profile"
          className="flex flex-col items-center justify-center py-10 rounded-xl border border-gold-border bg-white shadow-sm hover:bg-gold-border/50 hover:text-primary transition-all"
        >
          <UserIcon className="mb-3 size-5 text-champagne-gold" aria-hidden="true" />
          <span className="font-semibold text-primary">Edit profile</span>
          <span className="mt-1 text-xs text-secondary-text">Update your personal details</span>
        </Link>
      </div>
    </main>
  )
}
