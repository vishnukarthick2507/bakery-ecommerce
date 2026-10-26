import { CircleCheckIcon, CircleSlashIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { Product } from '@/lib/types'

export function availabilityLabel(product: Pick<Product, 'availability'>) {
  switch (product.availability) {
    case 'AVAILABLE_NOW':
      return 'Available now'
    case 'SOLD_OUT':
      return 'Sold out'
  }
}

export function AvailabilityBadge({
  product,
  className,
}: {
  product: Pick<Product, 'availability'>
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
    case 'SOLD_OUT':
      return (
        <Badge variant="secondary" className={className}>
          <CircleSlashIcon data-icon="inline-start" />
          {label}
        </Badge>
      )
  }
}
