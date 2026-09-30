import { CalendarClockIcon, CircleCheckIcon, ClockIcon, CircleSlashIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatReadyTime } from '@/lib/format'
import type { Product } from '@/lib/types'

export function availabilityLabel(product: Pick<Product, 'availability' | 'readyInMinutes' | 'preOrderHours'>) {
  switch (product.availability) {
    case 'AVAILABLE_NOW':
      return 'Available now'
    case 'READY_IN_TIME':
      return formatReadyTime(product.readyInMinutes ?? 120)
    case 'PRE_ORDER':
      return product.preOrderHours ? `Pre-order · ${product.preOrderHours}h notice` : 'Pre-order'
    case 'SOLD_OUT':
      return 'Sold out'
  }
}

export function AvailabilityBadge({
  product,
  className,
}: {
  product: Pick<Product, 'availability' | 'readyInMinutes' | 'preOrderHours'>
  className?: string
}) {
  const label = availabilityLabel(product)
  switch (product.availability) {
    case 'AVAILABLE_NOW':
      return (
        <Badge variant="success" className={className}>
          <CircleCheckIcon data-icon="inline-start" />
          {label}
        </Badge>
      )
    case 'READY_IN_TIME':
      return (
        <Badge variant="caramel" className={className}>
          <ClockIcon data-icon="inline-start" />
          {label}
        </Badge>
      )
    case 'PRE_ORDER':
      return (
        <Badge variant="secondary" className={className}>
          <CalendarClockIcon data-icon="inline-start" />
          {label}
        </Badge>
      )
    case 'SOLD_OUT':
      return (
        <Badge variant="muted" className={className}>
          <CircleSlashIcon data-icon="inline-start" />
          {label}
        </Badge>
      )
  }
}
