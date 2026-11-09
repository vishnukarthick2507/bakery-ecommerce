import Link from 'next/link'
import { ArrowRightIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  href,
  hrefLabel = 'View all',
  className,
}: {
  id?: string
  eyebrow?: string
  title: string
  description?: string
  href?: string
  hrefLabel?: string
  className?: string
}) {
  return (
    <div className={cn('mb-8 flex flex-col gap-3 sm:mb-12 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="flex max-w-2xl flex-col gap-2">
        {eyebrow && (
          <p className="text-xs font-semibold tracking-widest text-champagne-gold uppercase">
            <span className="rounded-full bg-champagne-gold/15 px-2.5 py-1 border border-champagne-gold/30">
              {eyebrow}
            </span>
          </p>
        )}
        <h2 id={id} className="font-heading text-3xl font-bold text-primary sm:text-4xl tracking-tight">
          {title}
        </h2>
        {description && <p className="mt-2 text-pretty text-secondary-text">{description}</p>}
      </div>
      {href && (
        <Link
          href={href}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-champagne-gold/50 px-4 py-2 text-sm font-semibold text-primary bg-white hover:bg-champagne-gold/10 hover:border-champagne-gold/30 transition-colors"
        >
          {hrefLabel}
          <ArrowRightIcon className="size-4" aria-hidden="true" />
        </Link>
      )}
    </div>
  )
}

export function Section({
  children,
  className,
  labelledBy,
}: {
  children: React.ReactNode
  className?: string
  labelledBy?: string
}) {
  return (
    <section aria-labelledby={labelledBy} className={cn('py-16 sm:py-24', className)}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">{children}</div>
    </section>
  )
}
