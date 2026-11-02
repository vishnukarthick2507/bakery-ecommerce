'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useCart } from '@/components/cart/cart-provider'
import { formatPrice } from '@/lib/format'

export default function CartPage() {
  const {
    items,
    hydrated,
    pricing,
    updateQuantity,
    removeItem,
  } = useCart()

  if (!hydrated) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <div className="rounded-[2rem] border border-border bg-card p-12 text-center shadow-sm">
          <p className="text-muted-foreground">
            Loading your cart…
          </p>
        </div>
      </main>
    )
  }

  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <div className="rounded-[2rem] border border-border bg-card p-12 text-center shadow-sm">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-cream text-primary-foreground text-4xl">
            🛒
          </div>

          <h1 className="mt-8 text-3xl font-semibold text-primary tracking-tight">
            Your cart is empty
          </h1>

          <p className="mt-4 text-muted-foreground leading-relaxed">
            Add some delicious bakes from S.V. Sweets &amp; Bakers before checking out.
          </p>

          <Link
            href="/products"
            className="mt-8 inline-flex items-center justify-center rounded-xl bg-caramel px-8 py-3.5 font-medium text-caramel-foreground shadow-sm hover:bg-caramel/90 transition-colors"
          >
            Browse Products
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      {/* Header */}
      <div className="mb-10">
        <Link
          href="/products"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
        >
          <span>←</span> Continue Shopping
        </Link>

        <h1 className="mt-4 text-3xl font-semibold text-primary tracking-tight">
          Your Cart
        </h1>

        <p className="mt-3 text-muted-foreground">
          {items.length}{' '}
          {items.length === 1 ? 'item' : 'items'} in your cart.
        </p>
      </div>

      <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
        {/* Cart items */}
        <section className="rounded-[2rem] border border-border bg-card shadow-sm">
          <div className="border-b border-border px-8 py-6">
            <h2 className="text-xl font-semibold text-primary">
              Cart Items
            </h2>
          </div>

          <div className="divide-y divide-border">
            {pricing.lines.map((line) => {
              const product = line.product
              const variant = line.variant
              const quantity = line.item.quantity

              return (
                <div
                  key={`${line.item.productId}-${line.item.variantId}`}
                  className="p-8"
                >
                  <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                    {/* Product image */}
                    <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted">
                      {product.image ? (
                        <Image
                          src={product.image}
                          alt={product.name}
                          fill
                          className="object-cover object-center"
                        />
                      ) : (
                        <span className="text-3xl">🍰</span>
                      )}
                    </div>

                    {/* Product information */}
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/products/${product.slug}`}
                        className="text-base font-semibold text-foreground hover:text-primary transition-colors"
                      >
                        {product.name}
                      </Link>

                      <p className="mt-1.5 text-sm text-muted-foreground">
                        {product.category}
                      </p>

                      <p className="mt-1 text-sm text-muted-foreground">
                        {variant.label}
                      </p>
                    </div>

                    {/* Quantity controls */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          updateQuantity(
                            line.item.productId,
                            line.item.variantId,
                            quantity - 1,
                          )
                        }
                        disabled={quantity <= 1}
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background text-lg hover:bg-cream disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        aria-label={`Decrease ${product.name} quantity`}
                      >
                        −
                      </button>

                      <span className="flex h-10 min-w-10 items-center justify-center rounded-lg border border-border px-3 font-medium tabular-nums">
                        {quantity}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          updateQuantity(
                            line.item.productId,
                            line.item.variantId,
                            quantity + 1,
                          )
                        }
                        disabled={quantity >= 20}
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background text-lg hover:bg-cream disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        aria-label={`Increase ${product.name} quantity`}
                      >
                        +
                      </button>
                    </div>

                    {/* Price and remove */}
                    <div className="text-left sm:text-right flex flex-col sm:flex-row sm:items-end gap-2">
                      <p className="font-semibold text-primary">
                        {formatPrice(line.lineTotal)}
                      </p>

                      <button
                        type="button"
                        onClick={() =>
                          removeItem(
                            line.item.productId,
                            line.item.variantId,
                          )
                        }
                        className="text-sm font-medium text-destructive hover:text-destructive/80 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Order summary */}
        <aside className="h-fit rounded-[2rem] border border-border p-8 shadow-sm bg-card lg:sticky lg:top-24">
          <h2 className="text-xl font-semibold text-primary">
            Order Summary
          </h2>

          <div className="mt-8 space-y-5">
            <div className="flex justify-between gap-4 text-sm">
              <span className="text-muted-foreground">
                Subtotal
              </span>

              <span className="font-medium text-foreground">
                {formatPrice(pricing.subtotal)}
              </span>
            </div>

            {pricing.savings > 0 && (
              <div className="flex justify-between gap-4 text-sm">
                <span className="text-muted-foreground">
                  Savings
                </span>

                <span className="font-medium text-primary">
                  −{formatPrice(pricing.savings)}
                </span>
              </div>
            )}

            <div className="pt-5 border-t border-border">
              <div className="flex justify-between gap-4">
                <span className="font-semibold text-foreground">
                  Total
                </span>

                <span className="text-xl font-bold text-primary">
                  {formatPrice(pricing.subtotal)}
                </span>
              </div>
            </div>

            <p className="mt-4 text-xs text-muted-foreground">
              Delivery is free on all orders.
            </p>
          </div>

          <Link
            href="/checkout"
            className="mt-8 flex w-full items-center justify-center rounded-xl bg-caramel px-8 py-4 font-medium text-caramel-foreground shadow-sm hover:bg-caramel/90 transition-colors"
          >
            Proceed to Checkout
          </Link>

          <Link
            href="/products"
            className="mt-4 flex w-full items-center justify-center rounded-xl border border-border px-8 py-3.5 font-medium text-foreground hover:bg-cream transition-colors"
          >
            Continue Shopping
          </Link>
        </aside>
      </div>
    </main>
  )
}
