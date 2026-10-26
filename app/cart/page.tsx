'use client'

import Link from 'next/link'
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
        <div className="rounded-xl border border-border p-10 text-center">
          <p className="text-muted-foreground">
            Loading your cart…
          </p>
        </div>
      </main>
    )
  }

  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <div className="rounded-xl border border-border p-10 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted text-3xl">
            🛒
          </div>

          <h1 className="mt-6 text-3xl font-semibold text-primary">
            Your cart is empty
          </h1>

          <p className="mt-3 text-muted-foreground">
            Add some delicious items from S.V. Bakery before checking out.
          </p>

          <Link
            href="/products"
            className="mt-7 inline-flex rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground hover:opacity-90"
          >
            Browse Products
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/products"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Continue Shopping
        </Link>

        <h1 className="mt-3 text-3xl font-semibold text-primary">
          Your Cart
        </h1>

        <p className="mt-2 text-muted-foreground">
          {items.length}{' '}
          {items.length === 1 ? 'item' : 'items'} in your cart.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* Cart items */}
        <section className="rounded-xl border border-border shadow-sm">
          <div className="border-b border-border px-6 py-5">
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
                  className="p-6"
                >
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                    {/* Product image */}
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-2xl">
                          🍰
                        </span>
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

                      <p className="mt-1 text-sm text-muted-foreground">
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
                        className="flex h-9 w-9 items-center justify-center rounded-lg border text-lg hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                        aria-label={`Decrease ${product.name} quantity`}
                      >
                        −
                      </button>

                      <span className="flex h-9 min-w-10 items-center justify-center rounded-lg border px-3 font-medium">
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
                        className="flex h-9 w-9 items-center justify-center rounded-lg border text-lg hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                        aria-label={`Increase ${product.name} quantity`}
                      >
                        +
                      </button>
                    </div>

                    {/* Price and remove */}
                    <div className="text-left sm:text-right">
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
                        className="mt-2 text-sm text-destructive hover:underline"
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
        <aside className="h-fit rounded-xl border border-border p-6 shadow-sm lg:sticky lg:top-6">
          <h2 className="text-xl font-semibold text-primary">
            Order Summary
          </h2>

          <div className="mt-6 space-y-4">
            <div className="flex justify-between gap-4 text-sm">
              <span className="text-muted-foreground">
                Subtotal
              </span>

              <span className="font-medium">
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

            <div className="border-t border-border pt-4">
              <div className="flex justify-between gap-4">
                <span className="font-semibold">
                  Total
                </span>

                <span className="text-xl font-bold text-primary">
                  {formatPrice(pricing.subtotal)}
                </span>
              </div>
            </div>
          </div>

          <Link
            href="/checkout"
            className="mt-6 flex w-full items-center justify-center rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground hover:opacity-90"
          >
            Proceed to Checkout
          </Link>

          <Link
            href="/products"
            className="mt-3 flex w-full items-center justify-center rounded-lg border border-border px-6 py-3 font-medium hover:bg-muted"
          >
            Continue Shopping
          </Link>
        </aside>
      </div>
    </main>
  )
}
