'use client'

import { Skeleton } from '@/components/ui/skeleton'

interface ChartContainerProps {
  title?: string
  subtitle?: string
  children: React.ReactNode
  loading?: boolean
  empty?: boolean
  emptyMessage?: string
}

export function ChartContainer({
  title,
  subtitle,
  children,
  loading = false,
  empty = false,
  emptyMessage = 'No data available',
}: ChartContainerProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-gold-border bg-white p-6 shadow-sm">
        {title && (
          <div className="mb-6">
            <h3 className="font-heading text-lg font-bold text-primary">{title}</h3>
            {subtitle && <p className="mt-1 text-sm text-secondary-text">{subtitle}</p>}
          </div>
        )}
        <div className="h-64 flex items-center justify-center">
          <div className="flex flex-col gap-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (empty) {
    return (
      <div className="rounded-xl border border-gold-border bg-white p-6 shadow-sm text-center">
        {title && (
          <div className="mb-6">
            <h3 className="font-heading text-lg font-bold text-primary">{title}</h3>
            {subtitle && <p className="mt-1 text-sm text-secondary-text">{subtitle}</p>}
          </div>
        )}
        <div className="h-64 flex flex-col items-center justify-center">
          <p className="text-sm text-secondary-text">{emptyMessage}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gold-border bg-white p-6 shadow-sm">
      {title && (
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="font-heading text-lg font-bold text-primary">{title}</h3>
            {subtitle && <p className="mt-1 text-sm text-secondary-text">{subtitle}</p>}
          </div>
        </div>
      )}
      {children}
    </div>
  )
}
