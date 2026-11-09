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
      <main className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
        <div className="rounded-2xl border border-gold-border bg-card p-12 text-center shadow-sm">
          <p className="text-secondary-text">Loading your cart…</p>
        </div>
      </main>
    )
  }

  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
        <div className="rounded-2xl border border-dashed border-gold-border bg-card p-12 text-center shadow-sm">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-champagne-gold/15 text-primary text-5xl">
            🛒
          </div>

          <h1 className="mt-8 text-3xl font-bold text-primary tracking-tight">
            Your cart is empty
          </h1>

          <p className="mt-4 text-secondary-text leading-relaxed">
            Add some delicious bakes from Bluebell Bakehouse before checking out.
          </p>

          <Link
            href="/products"
            className="mt-8 inline-flex items-center justify-center rounded-xl bg-champagne-gold px-8 py-4 font-semibold text-midnight-navy shadow-sm hover:bg-champagne-gold/90 transition-colors"
          >
            Browse Products
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-12">
        <Link
          href="/products"
          className="inline-flex items-center gap-2 text-sm font-medium text-secondary-text hover:text-primary transition-colors"
        >
          <span>←</span> Continue Shopping
        </Link>

        <h1 className="mt-4 text-3xl font-bold text-primary tracking-tight">
          Your Cart
        </h1>

        <p className="mt-3 text-secondary-text">
          {items.length}{' '}
          {items.length === 1 ? 'item' : 'items'} in your cart.
        </p>
      </div>

      <div className="grid gap-12 lg:grid-cols-[1fr_420px]">
        {/* Cart items */}
        <section className="rounded-2xl border border-gold-border bg-card shadow-sm">
          <div className="border-b border-gold-border px-6 py-6">
            <h2 className="text-xl font-bold text-primary">
              Cart Items
            </h2>
          </div>

          <div className="divide-y divide-gold-border">
            {pricing.lines.map((line) => {
              const product = line.product
              const variant = line.variant
              const quantity = line.item.quantity

              return (
                <div
                  key={`${line.item.productId}-${line.item.variantId}`}
                  className="p-6 sm:p-8"
                >
                  <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                    {/* Product image */}
                    <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted border border-gold-border">
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

                      <p className="mt-1.5 text-sm text-secondary-text">
                        {product.category}
                      </p>

                      <p className="mt-1 text-sm text-secondary-text uppercase tracking-wider">
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
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-gold-border bg-background text-lg hover:bg-gold-border/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        aria-label={`Decrease ${product.name} quantity`}
                      >
                        −
                      </button>

                      <span className="flex h-10 min-w-10 items-center justify-center rounded-lg border border-gold-border px-3 font-medium tabular-nums text-foreground">
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
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-gold-border bg-background text-lg hover:bg-gold-border/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
        <aside className="h-fit rounded-2xl border border-gold-border p-8 shadow-sm bg-card lg:sticky lg:top-24">
          <h2 className="text-xl font-bold text-primary">
            Order Summary
          </h2>

          <div className="mt-10 space-y-6">
            <div className="flex justify-between gap-4 text-sm">
              <span className="text-secondary-text">
                Subtotal
              </span>

              <span className="font-medium text-foreground">
                {formatPrice(pricing.subtotal)}
              </span>
            </div>

            {pricing.savings > 0 && (
              <div className="flex justify-between gap-4 text-sm">
                <span className="text-secondary-text">
                  Savings
                </span>

                <span className="font-medium text-primary">
                  −{formatPrice(pricing.savings)}
                </span>
              </div>
            )}

            <div className="pt-6 border-t border-gold-border">
              <div className="flex justify-between gap-4">
                <span className="font-semibold text-foreground">
                  Total
                </span>

                <span className="text-xl font-bold text-primary">
                  {formatPrice(pricing.subtotal)}
                </span>
              </div>
            </div>

            <p className="mt-4 text-xs text-secondary-text">
              Delivery is free on all orders.
            </p>
          </div>

          <Link
            href="/checkout"
            className="mt-8 flex w-full items-center justify-center rounded-xl bg-champagne-gold px-8 py-4 font-semibold text-midnight-navy shadow-sm hover:bg-champagne-gold/90 transition-colors"
          >
            Proceed to Checkout
          </Link>

          <Link
            href="/products"
            className="mt-4 flex w-full items-center justify-center rounded-xl border border-gold-border px-8 py-3.5 font-semibold text-foreground hover:bg-gold-border/50 transition-colors"
          >
            Continue Shopping
          </Link>
        </aside>
      </div>
    </main>
  )
}
