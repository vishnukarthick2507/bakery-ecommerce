import { StarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { discountPercent, formatPrice } from '@/lib/format'

export function Rating({
  value,
  count,
  className,
}: {
  value: number
  count?: number
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-1 text-sm', className)}>
      <StarIcon className="size-4 fill-caramel text-caramel" aria-hidden="true" />
      <span className="font-medium">{value.toFixed(1)}</span>
      {count !== undefined && <span className="text-muted-foreground">({count})</span>}
      <span className="sr-only">
        Rated {value.toFixed(1)} out of 5{count !== undefined ? ` from ${count} reviews` : ''}
      </span>
    </div>
  )
}

export function StarRow({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${value} out of 5 stars`} role="img">
      {Array.from({ length: 5 }, (_, i) => (
        <StarIcon
          key={i}
          aria-hidden="true"
          className={cn('size-4', i < Math.round(value) ? 'fill-caramel text-caramel' : 'text-border')}
        />
      ))}
    </div>
  )
}

export function VegMark({ isVeg, className }: { isVeg: boolean; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex size-4 shrink-0 items-center justify-center rounded-sm border-2 bg-background',
        isVeg ? 'border-success' : 'border-destructive',
        className,
      )}
      title={isVeg ? 'Eggless / Vegetarian' : 'Contains egg or meat'}
    >
      <span className={cn('size-1.5 rounded-full', isVeg ? 'bg-success' : 'bg-destructive')} />
      <span className="sr-only">{isVeg ? 'Vegetarian, eggless' : 'Non-vegetarian or contains egg'}</span>
    </span>
  )
}

export function Price({
  price,
  mrp,
  size = 'default',
}: {
  price: number
  mrp: number
  size?: 'default' | 'lg'
}) {
  const off = discountPercent(price, mrp)
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className={cn('font-semibold text-foreground', size === 'lg' ? 'text-2xl' : 'text-base')}>
        {formatPrice(price)}
      </span>
      {off > 0 && (
        <>
          <span className="text-sm text-muted-foreground line-through">
            <span className="sr-only">Original price </span>
            {formatPrice(mrp)}
          </span>
          <span className="text-sm font-semibold text-success">{off}% off</span>
        </>
      )}
    </div>
  )
}
