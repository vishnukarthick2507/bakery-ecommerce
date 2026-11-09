'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { CustomerProfile } from '@/lib/customer-auth'

export default function EditProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<CustomerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me', {
      credentials: 'include',
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            router.replace('/account/login')
          }
          throw new Error('Unable to load profile.')
        }
        const data = await response.json()
        if (!data?.user) {
          router.replace('/account/login')
          throw new Error('Unable to load profile.')
        }
        setProfile(data.user)
        setName(data.user.name)
        setPhone(data.user.phone ?? '')
      })
      .catch((requestError: unknown) => {
        setError(requestError instanceof Error ? requestError.message : 'Unable to load profile.')
      })
      .finally(() => setLoading(false))
  }, [router])

  if (loading) return (
    <main className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <div className="rounded-[2rem] border border-border bg-card p-12 text-center shadow-sm">
        <p className="text-muted-foreground">Loading profile…</p>
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
              onClick={() => router.replace('/account/login')}
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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          ...(phone.trim() ? { phone: phone.replace(/\s+/g, "").replace(/-/g, "") } : {}),
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error((data as { message?: string })?.message || 'Unable to update profile.')
      }
      setProfile((prev) => prev ? { ...prev, name: name.trim(), phone } : prev)
      router.replace('/account')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update profile.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/account"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← My account
          </Link>
          <h1 className="mt-3 text-3xl font-semibold text-primary tracking-tight">
            Edit profile
          </h1>
          <p className="mt-2 text-muted-foreground">
            Update your name and phone number.
          </p>
        </div>
      </div>

      {error && (
        <div role="alert" className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive shadow-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-8 rounded-[2rem] border border-border bg-card p-8 sm:p-10 shadow-sm">
        <div className="grid gap-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              Full name
            </label>
            <input
              type="text"
              autoComplete="name"
              required
              minLength={2}
              maxLength={100}
              value={name}
              onChange={(event) => {
                setName(event.target.value)
              }}
              placeholder="Priya"
              className="w-full rounded-xl border border-border px-4 py-3 outline-none focus:ring-2 focus:ring-caramel"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              Mobile number
            </label>
            <input
              type="tel"
              autoComplete="tel"
              required
              maxLength={15}
              value={phone}
              onChange={(event) => {
                setPhone(event.target.value)
              }}
              placeholder="9840916058"
              className="w-full rounded-xl border border-border px-4 py-3 outline-none focus:ring-2 focus:ring-caramel"
            />
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            Your email address cannot be changed here. To update your email,
            contact us on WhatsApp.
          </p>

          <div className="mt-8 flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-caramel px-6 py-3.5 font-medium text-caramel-foreground shadow-sm hover:bg-caramel/90 disabled:opacity-60 transition-colors"
            >
              {submitting ? 'Saving…' : 'Save changes'}
            </button>
            <Link
              href="/account"
              className="text-sm text-muted-foreground hover:underline"
            >
              Cancel
            </Link>
          </div>
        </div>
      </form>
    </main>
  )
}
