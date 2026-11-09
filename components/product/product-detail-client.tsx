'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowLeftIcon,
  MinusIcon,
  PlusIcon,
  ShoppingBagIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CART_MAX_QTY, useCart } from '@/components/cart/cart-provider'
import { formatPrice } from '@/lib/format'
import type { Product } from '@/lib/types'

import { AvailabilityBadge } from './availability-badge'
import { Price, Rating } from './product-meta'

interface ProductDetailClientProps {
  product: Product
}

export function ProductDetailClient({
  product,
}: ProductDetailClientProps) {
  const { addItem } = useCart()
  const [quantity, setQuantity] = useState(1)

  const variant = product.variants[0]
  const maxQuantity = Math.min(CART_MAX_QTY, product.stock)

  const canOrder =
    product.availability === 'AVAILABLE_NOW'

  const decreaseQuantity = () => {
    setQuantity((current) => Math.max(1, current - 1))
  }

  const increaseQuantity = () => {
    setQuantity((current) => Math.min(maxQuantity, current + 1))
  }

  const handleAddToCart = () => {
    addItem(
      {
        productId: product.id,
        variantId: variant.id,
        quantity,
      },
      {
        productName: product.name,
      },
    )
  }

  return (
    <div className="space-y-10">
      <Link
        href="/products"
        className="inline-flex items-center gap-2 text-sm font-medium text-secondary-text hover:text-primary transition-colors"
      >
        <ArrowLeftIcon className="size-4" />
        Back to shop
      </Link>

      <div className="grid gap-8 lg:grid-cols-2">
        <Card className="overflow-hidden p-0 border border-gold-border shadow-sm rounded-2xl">
          <div className="relative aspect-square bg-muted overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
            <Image
              src={product.image || '/placeholder.svg'}
              alt={product.name}
              fill
              priority
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover object-center"
              onError={(e) => {
                ;(e.target as HTMLImageElement).src = '/placeholder.svg'
              }}
            />

            <div className="absolute left-4 top-4 flex items-start gap-2">
              <AvailabilityBadge product={product} />
            </div>
          </div>
        </Card>

        <div className="flex flex-col justify-between gap-8">
          <div>
            {product.reviewCount > 0 && (
              <Rating
                value={product.rating}
                count={product.reviewCount}
                className="text-sm"
              />
            )}

            <div>
              <h1 className="font-heading text-3xl font-bold tracking-tight text-primary sm:text-4xl">
                {product.name}
              </h1>

              <p className="mt-4 text-lg text-secondary-text leading-relaxed">
                {product.description}
              </p>
            </div>

            <div className="mt-8 flex items-center gap-4">
              <Price
                price={variant.price}
                mrp={variant.mrp}
                size="lg"
              />

              <span className="text-sm text-secondary-text uppercase tracking-wider">
                {variant.label}
              </span>
            </div>

            <div className="mt-10 grid gap-4 rounded-2xl border border-gold-border bg-white p-6 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-secondary-text">Category</span>
                <span className="font-medium text-capitalize">{product.category}</span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-secondary-text">Availability</span>
                <span className="font-medium">
                  {canOrder ? 'Available to order' : 'Currently unavailable'}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-secondary-text">In stock</span>
                <span className="font-medium">{product.stock} available</span>
              </div>

              {product.readyInMinutes && (
                <div className="flex justify-between gap-4">
                  <span className="text-secondary-text">Ready in</span>
                  <span className="font-medium">{product.readyInMinutes} minutes</span>
                </div>
              )}

              {product.shelfLife && (
                <div className="flex justify-between gap-4">
                  <span className="text-secondary-text">Shelf life</span>
                  <span className="font-medium">{product.shelfLife}</span>
                </div>
              )}
            </div>

            {product.ingredients.length > 0 && (
              <div className="mt-10">
                <h2 className="text-sm font-semibold text-primary tracking-tight uppercase">
                  Ingredients
                </h2>
                <p className="mt-2 text-sm text-secondary-text">
                  {product.ingredients.join(', ')}
                </p>
              </div>
            )}

            {product.allergens.length > 0 && (
              <div className="mt-8">
                <h2 className="text-sm font-semibold text-primary tracking-tight uppercase">
                  Allergens
                </h2>
                <p className="mt-2 text-sm text-secondary-text">
                  {product.allergens.join(', ')}
                </p>
              </div>
            )}
          </div>

          <div className="border-t border-gold-border pt-8">
            {canOrder ? (
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-foreground">Quantity</span>

                  <div className="flex items-center rounded-xl border border-gold-border bg-background">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={decreaseQuantity}
                      disabled={quantity <= 1}
                      aria-label="Decrease quantity"
                    >
                      <MinusIcon className="size-4" />
                    </Button>

                    <span className="min-w-10 text-center font-medium text-foreground">
                      {quantity}
                    </span>

                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={increaseQuantity}
                      disabled={quantity >= maxQuantity}
                      aria-label="Increase quantity"
                    >
                      <PlusIcon className="size-4" />
                    </Button>
                  </div>
                </div>

                <Button
                  type="button"
                  size="lg"
                  className="w-full bg-champagne-gold text-midnight-navy font-semibold shadow-sm hover:bg-champagne-gold/90 transition-colors"
                  onClick={handleAddToCart}
                >
                  <ShoppingBagIcon data-icon="inline-start" />
                  Add {quantity} to cart ·{' '}
                  {formatPrice(variant.price * quantity)}
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                size="lg"
                className="w-full border border-gold-border bg-white text-secondary-text font-semibold hover:bg-gold-border/50 transition-colors disabled:opacity-60"
                disabled
              >
                Currently unavailable
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-12 border-t border-gold-border pt-10">
        <h2 className="font-heading text-2xl font-bold text-primary mb-8">
          Related bakes
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
          {[]}
        </div>
      </div>
    </div>
  )
}
