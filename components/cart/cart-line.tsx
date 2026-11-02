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
    <li className="flex gap-4 py-5 border-b border-border last:border-0">
      <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-muted">
        <Image src={product.image || '/placeholder.svg'} alt={product.name} fill sizes="80px" className="object-cover object-center" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/products/${product.slug}`}
            onClick={onNavigate}
            className="text-sm leading-snug font-semibold text-foreground hover:text-primary transition-colors"
          >
            {product.name}
          </Link>
          <span className="text-sm font-semibold text-primary">{formatPrice(lineTotal)}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {variant.label} · {formatPrice(variant.price)} each
        </p>
        {product.availability !== 'AVAILABLE_NOW' && (
          <AvailabilityBadge product={product} className="h-auto whitespace-normal" />
        )}
        {item.quantity > product.stock && (
          <p className="text-xs text-destructive" role="status">
            Only {product.stock} available. Reduce the quantity to continue.
          </p>
        )}
        <div className="mt-3 flex items-end gap-4">
          <div className="flex items-center rounded-xl border border-border bg-background" role="group" aria-label={`Quantity for ${product.name}`}>
            <Button
              variant="outline"
              size="icon"
              onClick={() => updateQuantity(item.productId, item.variantId, item.quantity - 1)}
              disabled={item.quantity <= 1}
              aria-label="Decrease quantity"
            >
              <MinusIcon className="size-3.5" />
            </Button>
            <span className="w-9 text-center text-sm font-medium tabular-nums" aria-live="polite">
              {item.quantity}
            </span>
            <Button
              variant="outline"
              size="icon"
              disabled={item.quantity >= Math.min(CART_MAX_QTY, product.stock)}
              onClick={() => updateQuantity(item.productId, item.variantId, item.quantity + 1)}
              aria-label="Increase quantity"
            >
              <PlusIcon className="size-3.5" />
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => removeItem(item.productId, item.variantId)}
            aria-label={`Remove ${product.name} from cart`}
          >
            <Trash2Icon className="size-3.5" data-icon="inline-start" />
            Remove
          </Button>
        </div>
      </div>
    </li>
  )
}
