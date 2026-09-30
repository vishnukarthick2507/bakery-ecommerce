'use client'

import Image from 'next/image'
import Link from 'next/link'
import { MinusIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AvailabilityBadge } from '@/components/product/availability-badge'
import { formatPrice } from '@/lib/format'
import type { PricedLine } from '@/lib/api'
import { CART_MAX_QTY, useCart } from './cart-provider'

export function CartLine({ line, onNavigate }: { line: PricedLine; onNavigate?: () => void }) {
  const { updateQuantity, removeItem } = useCart()
  const { product, variant, item, lineTotal } = line

  return (
    <li className="flex gap-3 py-4">
      <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-cream">
        <Image src={product.image || '/placeholder.svg'} alt="" fill sizes="80px" className="object-cover" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/products/${product.slug}`}
            onClick={onNavigate}
            className="text-sm leading-snug font-semibold hover:underline"
          >
            {product.name}
          </Link>
          <span className="text-sm font-semibold">{formatPrice(lineTotal)}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {variant.label} · {formatPrice(variant.price)} each
        </p>
        {product.availability !== 'AVAILABLE_NOW' && (
          <AvailabilityBadge product={product} className="h-auto whitespace-normal" />
        )}
        <div className="mt-1 flex items-center justify-between">
          <div className="flex items-center rounded-lg border" role="group" aria-label={`Quantity for ${product.name}`}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => updateQuantity(item.productId, item.variantId, item.quantity - 1)}
              aria-label="Decrease quantity"
            >
              <MinusIcon />
            </Button>
            <span className="w-8 text-center text-sm font-medium tabular-nums" aria-live="polite">
              {item.quantity}
            </span>
            <Button
              variant="ghost"
              size="icon"
              disabled={item.quantity >= CART_MAX_QTY}
              onClick={() => updateQuantity(item.productId, item.variantId, item.quantity + 1)}
              aria-label="Increase quantity"
            >
              <PlusIcon />
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => removeItem(item.productId, item.variantId)}
            aria-label={`Remove ${product.name} from cart`}
          >
            <Trash2Icon data-icon="inline-start" />
            Remove
          </Button>
        </div>
      </div>
    </li>
  )
}
