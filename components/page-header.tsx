import Link from 'next/link'
import { ChevronRightIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function PageHeader({
  title,
  description,
  breadcrumbs,
}: {
  title: string
  description?: string
  breadcrumbs?: Array<{ href?: string; label: string }>
}) {
  return (
    <div className="border-b border-gold-border bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
        {breadcrumbs && (
          <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-1 text-sm text-foreground">
              {breadcrumbs.map((b, i) => (
                <li key={b.label} className="flex items-center gap-1">
                  {i > 0 && <ChevronRightIcon className="size-3.5 text-foreground" aria-hidden="true" />}
                  {b.href ? (
                    <Link href={b.href} className="hover:text-primary hover:underline transition-colors">
                      {b.label}
                    </Link>
                  ) : (
                    <span aria-current="page" className="text-primary font-medium">
                      {b.label}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}
        <h1 className="font-heading text-3xl font-bold text-primary sm:text-4xl tracking-tight">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-pretty text-foreground">{description}</p>}
      </div>
    </div>
  )
}
