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
    <div className={cn('mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="flex max-w-2xl flex-col gap-2">
        {eyebrow && (
          <p className="text-xs font-semibold tracking-widest text-caramel-foreground uppercase">
            <span className="rounded-full bg-caramel/20 px-2.5 py-1">{eyebrow}</span>
          </p>
        )}
        <h2 id={id} className="text-2xl font-bold text-navy sm:text-3xl lg:text-4xl">
          {title}
        </h2>
        {description && <p className="text-pretty text-muted-foreground">{description}</p>}
      </div>
      {href && (
        <Link
          href={href}
          className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-primary hover:underline"
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
    <section aria-labelledby={labelledBy} className={cn('py-12 sm:py-16', className)}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6">{children}</div>
    </section>
  )
}
