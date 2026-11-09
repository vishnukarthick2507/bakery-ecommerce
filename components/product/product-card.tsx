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
  return `Hi Bluebell Bakehouse! I'd like to order "${product.name}"${
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
        'group/card relative h-full overflow-hidden border border-gold-border bg-card shadow-sm transition-shadow duration-300 hover:shadow-lg',
        product.availability === 'SOLD_OUT' && 'border-gold-border/30',
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
            'object-cover object-center transition-transform duration-500 group-hover/card:scale-105',
            product.availability === 'SOLD_OUT' && 'opacity-50 grayscale-[30%]',
          )}
          onError={(e) => {
            ;(e.target as HTMLImageElement).src = '/placeholder.svg'
          }}
        />
        <div className="absolute inset-x-2 top-2 flex items-start justify-between gap-2">
          <AvailabilityBadge product={product} className="h-auto max-w-[80%] py-1 whitespace-normal text-left" />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-4 sm:p-5">
        {product.reviewCount > 0 && (
          <Rating value={product.rating} count={product.reviewCount} className="text-xs sm:text-sm" />
        )}
        <h3 className="font-sans text-sm leading-snug font-semibold sm:text-base line-clamp-2">
          <Link href={href} className="outline-none after:absolute after:inset-0 focus-visible:underline text-foreground hover:text-primary transition-colors">
            {product.name}
          </Link>
        </h3>
        <p className="text-xs text-muted-foreground leading-none uppercase tracking-wider">{variant.label}</p>
        <div className="mt-auto pt-3">
          <Price price={variant.price} mrp={variant.mrp} size="lg" />
        </div>

        <div className="relative z-10 flex flex-col gap-2 pt-3">
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
                className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'w-full border-gold-border text-secondary-text hover:bg-gold-border hover:text-primary')}
              >
                <CalendarPlusIcon data-icon="inline-start" />
                Order for later
              </Link>
              <a
                href={whatsappLink(whatsappProductMessage(product, variant.label))}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ variant: 'ghost', size: 'lg' }), 'w-full text-secondary-text hover:text-primary')}
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
