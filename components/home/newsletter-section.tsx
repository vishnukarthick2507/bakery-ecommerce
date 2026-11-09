import Link from 'next/link'
import { MailIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function NewsletterSection() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-champagne-gold/40 bg-champagne-gold/10 p-10 md:p-16 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/50 px-3 py-1 text-xs font-semibold text-champagne-gold mb-6">
            <MailIcon className="size-4" aria-hidden="true" />
            Join our bakery news
          </div>
          <h2 className="font-heading text-2xl font-bold text-primary sm:text-3xl tracking-tight">
            Fresh from the oven, straight to your inbox
          </h2>
          <p className="mt-4 text-secondary-text">
            Be the first to know about new bakes, seasonal treats and bakery
            events.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <input
              type="email"
              placeholder="you@example.com"
              className="flex-1 rounded-lg border border-gold-border bg-white px-5 py-3 text-sm text-primary placeholder-secondary-text/50 focus:border-champagne-gold focus:ring-2 focus:ring-champagne-gold/30 outline-none"
            />
            <Link
              href="/contact"
              className="rounded-lg bg-champagne-gold px-6 py-3 font-semibold text-midnight-navy shadow-sm hover:bg-champagne-gold/90 transition-colors"
            >
              Subscribe
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
