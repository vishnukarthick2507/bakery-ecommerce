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
import { useCart } from '@/components/cart/cart-provider'
import { formatPrice } from '@/lib/format'
import type { Product } from '@/lib/types'

import { AvailabilityBadge } from './availability-badge'
import { Price, Rating, VegMark } from './product-meta'

interface ProductDetailClientProps {
  product: Product
}

export function ProductDetailClient({
  product,
}: ProductDetailClientProps) {
  const { addItem } = useCart()
  const [quantity, setQuantity] = useState(1)

  const variant = product.variants[0]

  const canOrder =
    product.availability === 'AVAILABLE_NOW' ||
    product.availability === 'READY_IN_TIME'

  const decreaseQuantity = () => {
    setQuantity((current) => Math.max(1, current - 1))
  }

  const increaseQuantity = () => {
    setQuantity((current) => Math.min(20, current + 1))
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

      <div className="grid gap-8 lg:grid-cols-2">
        <Card className="overflow-hidden p-0">
          <div className="relative aspect-square bg-cream">
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
              <VegMark isVeg={product.isVeg} />
            </div>
          </div>
        </Card>

        <div className="flex flex-col justify-center gap-5">
          <Rating
            value={product.rating}
            count={product.reviewCount}
            className="text-sm"
          />

          <div>
            <h1 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
              {product.name}
            </h1>

            <p className="mt-3 text-muted-foreground">
              {product.description}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Price
              price={variant.price}
              mrp={variant.mrp}
            />

            <span className="text-sm text-muted-foreground">
              {variant.label}
            </span>
          </div>

          <div className="grid gap-3 rounded-xl border bg-muted/30 p-4 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">
                Category
              </span>

              <span className="font-medium capitalize">
                {product.category}
              </span>
            </div>

            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">
                Availability
              </span>

              <span className="font-medium">
                {canOrder
                  ? 'Available to order'
                  : 'Currently unavailable'}
              </span>
            </div>

            {product.readyInMinutes && (
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">
                  Ready in
                </span>

                <span className="font-medium">
                  {product.readyInMinutes} minutes
                </span>
              </div>
            )}

            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">
                Shelf life
              </span>

              <span className="font-medium">
                {product.shelfLife}
              </span>
            </div>
          </div>

          {product.ingredients.length > 0 && (
            <div>
              <h2 className="font-semibold">
                Ingredients
              </h2>

              <p className="mt-2 text-sm text-muted-foreground">
                {product.ingredients.join(', ')}
              </p>
            </div>
          )}

          {product.allergens.length > 0 && (
            <div>
              <h2 className="font-semibold">
                Allergens
              </h2>

              <p className="mt-2 text-sm text-muted-foreground">
                {product.allergens.join(', ')}
              </p>
            </div>
          )}

          {canOrder ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">
                  Quantity
                </span>

                <div className="flex items-center rounded-lg border">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={decreaseQuantity}
                    disabled={quantity <= 1}
                    aria-label="Decrease quantity"
                  >
                    <MinusIcon className="size-4" />
                  </Button>

                  <span className="min-w-10 text-center font-medium">
                    {quantity}
                  </span>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={increaseQuantity}
                    disabled={quantity >= 20}
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
  )
}