'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { MailIcon, UserPlusIcon, UserRoundIcon } from 'lucide-react'
import { siteConfig } from '@/lib/site-config'

export default function AccountLandingPage() {
  const router = useRouter()

  useEffect(() => {
    // If the customer already has a valid session, send them straight to the
    // dashboard instead of showing the sign-in / sign-up choice.
    fetch('/api/auth/me', {
      credentials: 'include',
      cache: 'no-store',
    })
      .then(async (response) => {
        if (response.ok) {
          const data = await response.json()
          if (data?.user) {
            router.replace('/account')
          }
        }
      })
      .catch(() => {
        // Not authenticated (or transient network error): stay on the landing
        // page so the customer can sign in or create an account.
      })
  }, [router])

  return (
    <main className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <div className="rounded-[2rem] border border-border bg-card p-8 sm:p-12 shadow-sm">
        <div className="text-center">
          <p className="text-sm font-semibold text-primary tracking-wide uppercase">
            {siteConfig.name}
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-primary tracking-tight">
            Your account
          </h1>
          <p className="mt-4 text-muted-foreground leading-relaxed">
            Sign in to your existing account, or create a new one to place
            orders and track your cakes.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {/* Sign in — existing customers */}
          <Link
            href="/account/login"
            className="flex flex-col items-center justify-center rounded-xl border border-border bg-background p-8 sm:p-10 text-primary hover:bg-cream hover:border-caramel/20 transition-all"
            aria-label="Sign in to your account"
          >
            <UserRoundIcon className="mb-4 size-6 text-caramel" aria-hidden="true" />
            <h2 className="text-lg font-semibold text-primary">Sign in</h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed text-center">
              Existing customer? Sign in with your email and password, or
              request a one-time password.
            </p>
          </Link>

          {/* Create account — new customers */}
          <Link
            href="/account/register"
            className="flex flex-col items-center justify-center rounded-xl border border-border bg-background p-8 sm:p-10 text-primary hover:bg-cream hover:border-caramel/20 transition-all"
            aria-label="Create a new account"
          >
            <UserPlusIcon className="mb-4 size-6 text-caramel" aria-hidden="true" />
            <h2 className="text-lg font-semibold text-primary">Create account</h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed text-center">
              New to S.V. Sweets & Bakers? Register with your email and phone
              to place your first order.
            </p>
          </Link>
        </div>

        <div className="mt-10 border-t border-border pt-8 text-center">
          <p className="text-sm text-muted-foreground">
            Need help?{' '}
            <a
              href="/contact"
              className="text-primary font-medium hover:underline transition-colors"
            >
              Contact us
            </a>
          </p>
        </div>
      </div>
    </main>
  )
}
