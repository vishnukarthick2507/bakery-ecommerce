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
    <div className="space-y-8">
      <Link
        href="/products"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        Back to shop
      </Link>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden p-0 border border-border shadow-sm">
          <div className="relative aspect-square bg-muted overflow-hidden">
            <Image
              src={product.image || '/placeholder.svg'}
              alt={product.name}
              fill
              priority
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />

            <div className="absolute left-4 top-4 flex items-start gap-2">
              <AvailabilityBadge product={product} />
            </div>
          </div>
        </Card>

        <div className="flex flex-col justify-between gap-6">
          <div>
            {product.reviewCount > 0 && (
              <Rating
                value={product.rating}
                count={product.reviewCount}
                className="text-sm"
              />
            )}

            <div>
              <h1 className="font-serif text-3xl font-semibold tracking-tight text-primary sm:text-4xl">
                {product.name}
              </h1>

              <p className="mt-3 text-muted-foreground leading-relaxed">
                {product.description}
              </p>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <Price
                price={variant.price}
                mrp={variant.mrp}
                size="lg"
              />

              <span className="text-sm text-muted-foreground">
                {variant.label}
              </span>
            </div>

            <div className="mt-6 grid gap-3 rounded-xl border border-border bg-white p-5 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Category</span>
                <span className="font-medium capitalize">{product.category}</span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Availability</span>
                <span className="font-medium">
                  {canOrder ? 'Available to order' : 'Currently unavailable'}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">In stock</span>
                <span className="font-medium">{product.stock} available</span>
              </div>

              {product.readyInMinutes && (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Ready in</span>
                  <span className="font-medium">{product.readyInMinutes} minutes</span>
                </div>
              )}

              {product.shelfLife && (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Shelf life</span>
                  <span className="font-medium">{product.shelfLife}</span>
                </div>
              )}
            </div>

            {product.ingredients.length > 0 && (
              <div className="mt-6">
                <h2 className="text-sm font-semibold text-primary tracking-tight uppercase">Ingredients</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {product.ingredients.join(', ')}
                </p>
              </div>
            )}

            {product.allergens.length > 0 && (
              <div className="mt-6">
                <h2 className="text-sm font-semibold text-primary tracking-tight uppercase">Allergens</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {product.allergens.join(', ')}
                </p>
              </div>
            )}
          </div>

          <div className="border-t border-border pt-6">
            {canOrder ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-foreground">Quantity</span>

                  <div className="flex items-center rounded-lg border border-border">
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
                  className="w-full"
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
                className="w-full"
                disabled
              >
                Currently unavailable
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
