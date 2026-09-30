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
import { Price, Rating, VegMark } from './product-meta'

export function isImmediatelyOrderable(product: Product) {
  return product.availability === 'AVAILABLE_NOW' || product.availability === 'READY_IN_TIME'
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
    <Card className="group/card relative h-full gap-0 overflow-hidden p-0 shadow-sm transition-shadow hover:shadow-md">
      <div className="relative aspect-square overflow-hidden bg-cream">
        <Image
          src={product.image || '/placeholder.svg'}
          alt={product.name}
          fill
          priority={priority}
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          className={cn(
            'object-cover transition-transform duration-300 group-hover/card:scale-105',
            product.availability === 'SOLD_OUT' && 'opacity-70 grayscale-[40%]',
          )}
        />
        <div className="absolute inset-x-2 top-2 flex items-start justify-between gap-2">
          <AvailabilityBadge product={product} className="h-auto max-w-[80%] py-1 whitespace-normal text-left" />
          <VegMark isVeg={product.isVeg} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
        <Rating value={product.rating} count={product.reviewCount} className="text-xs sm:text-sm" />
        <h3 className="font-sans text-sm leading-snug font-semibold sm:text-base">
          <Link href={href} className="outline-none after:absolute after:inset-0 focus-visible:underline">
            {product.name}
          </Link>
        </h3>
        <p className="text-xs text-muted-foreground">{variant.label}</p>
        <div className="mt-auto pt-1">
          <Price price={variant.price} mrp={variant.mrp} />
        </div>

        <div className="relative z-10 flex flex-col gap-2 pt-1">
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
              <Link href={href} className={cn(buttonVariants({ variant: 'caramel', size: 'lg' }), 'w-full')}>
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
