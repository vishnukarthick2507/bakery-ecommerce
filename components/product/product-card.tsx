'use client'

import Image from 'next/image'
import Link from 'next/link'
import { CalendarPlusIcon, MessageCircleIcon, ShoppingBagIcon } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useCart } from '@/components/cart/cart-provider'
import { whatsappLink } from '@/lib/site-config'
import { formatPrice } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Product } from '@/lib/types'
import { AvailabilityBadge } from './availability-badge'
import { Price, Rating } from './product-meta'

export function isImmediatelyOrderable(product: Product) {
  return product.availability === 'AVAILABLE_NOW'
}

export function whatsappProductMessage(product: Product, variantLabel?: string) {
  return `Hi S.V. Bakery! I'd like to order "${product.name}"${
    variantLabel ? ` (${variantLabel})` : ''
  }. Is it possible to get it for a later date?`
}

export function ProductCard({ product, priority }: { product: Product; priority?: boolean }) {
  const { addItem } = useCart()
  const variant = product.variants[0]
  const orderable = isImmediatelyOrderable(product)
  const href = `/products/${product.slug}`

  return (
    <Card
      className={cn(
        'group/card relative h-full overflow-hidden border border-border bg-card p-0 shadow-sm transition-shadow duration-200 hover:shadow-lg',
        product.availability === 'SOLD_OUT' && 'border-border/50',
      )}
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-muted">
        <Image
          src={product.image || '/placeholder.svg'}
          alt={product.name}
          fill
          priority={priority}
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          className={cn(
            'object-cover transition-transform duration-300 group-hover/card:scale-105',
            product.availability === 'SOLD_OUT' && 'opacity-60 grayscale-[40%]',
          )}
        />
        <div className="absolute inset-x-2 top-2 flex items-start justify-between gap-2">
          <AvailabilityBadge product={product} className="h-auto max-w-[80%] py-1 whitespace-normal text-left" />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
        {product.reviewCount > 0 && (
          <Rating value={product.rating} count={product.reviewCount} className="text-xs sm:text-sm" />
        )}
        <h3 className="font-sans text-sm leading-snug font-semibold sm:text-base line-clamp-2">
          <Link href={href} className="outline-none after:absolute after:inset-0 focus-visible:underline text-foreground hover:text-primary transition-colors">
            {product.name}
          </Link>
        </h3>
        <p className="text-xs text-muted-foreground leading-none">{variant.label}</p>
        <div className="mt-auto pt-2">
          <Price price={variant.price} mrp={variant.mrp} size="lg" />
        </div>

        <div className="relative z-10 flex flex-col gap-2 pt-2">
          {orderable ? (
            <Button
              size="lg"
              className="w-full"
              onClick={() =>
                addItem(
                  { productId: product.id, variantId: variant.id, quantity: 1 },
                  { productName: product.name },
                )
              }
              aria-label={`Add ${product.name}, ${variant.label}, ${formatPrice(variant.price)} to cart`}
            >
              <ShoppingBagIcon data-icon="inline-start" />
              Add to cart
            </Button>
          ) : (
            <>
              <Link
                href={href}
                className={cn(buttonVariants({ variant: 'secondary', size: 'lg' }), 'w-full')}
              >
                <CalendarPlusIcon data-icon="inline-start" />
                Order for later
              </Link>
              <a
                href={whatsappLink(whatsappProductMessage(product, variant.label))}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'w-full')}
              >
                <MessageCircleIcon data-icon="inline-start" />
                Ask on WhatsApp
              </a>
            </>
          )}
        </div>
      </div>
    </Card>
  )
}
