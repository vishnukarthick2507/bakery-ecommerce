'use client'

import type { Metadata } from 'next'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

type OrderItem = {
  productId: string
  productName: string
  variantId: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

type Order = {
  id: string
  orderNumber: string
  customerName: string
  phone: string
  fulfillmentType: 'DELIVERY' | 'PICKUP'
  address?: {
    addressLine: string
    city: string
    pincode: string
  }
  scheduledDate: string
  scheduledTime: string
  paymentMethod: 'COD' | 'ONLINE'
  paymentStatus: 'PENDING' | 'PAID' | 'FAILED'
  orderStatus:
    | 'PLACED'
    | 'PAYMENT_CONFIRMED'
    | 'CONFIRMED'
    | 'PREPARING'
    | 'READY'
    | 'OUT_FOR_DELIVERY'
    | 'DELIVERED'
    | 'CANCELLED'
  items: OrderItem[]
  subtotal: number
  deliveryFee: number
  totalAmount: number
  createdAt: string
  updatedAt: string
}

function formatStatus(status: Order['orderStatus']) {
  return status
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    )
}

function formatPaymentStatus(
  status: Order['paymentStatus'],
) {
  return status
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    )
}

export default function TrackPage() {
  const searchParams = useSearchParams()

  const urlOrderNumber =
    searchParams.get('order') ?? ''

  const [orderNumber, setOrderNumber] =
    useState(urlOrderNumber)

  const [order, setOrder] =
    useState<Order | null>(null)

  const [loading, setLoading] =
    useState(false)

  const [error, setError] =
    useState('')

  const fetchOrder = async (
    requestedOrderNumber: string,
  ) => {
    const trimmed =
      requestedOrderNumber.trim()

    if (!trimmed) {
      setError(
        'Please enter your order number.',
      )
      setOrder(null)
      return
    }

    setLoading(true)
    setError('')
    setOrder(null)

    try {
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL ||
        'http://localhost:5000'

      const response = await fetch(
        `${apiUrl}/api/orders/${encodeURIComponent(
          trimmed,
        )}`,
        {
          cache: 'no-store',
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.message ||
            'Order not found.',
        )
      }

      setOrder(data.order)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to fetch order.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (urlOrderNumber) {
      fetchOrder(urlOrderNumber)
    }
  }, [urlOrderNumber])

  const handleSubmit = (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    fetchOrder(orderNumber)
  }

  return (
    <>
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="mb-8">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Back to home
          </Link>

          <h1 className="mt-3 text-4xl font-semibold">
            Track Your Order
          </h1>

          <p className="mt-2 text-muted-foreground">
            Check the latest status of your
            S.V. Sweets & Bakers order.
          </p>
        </div>

        {/* Search */}
        <section className="rounded-2xl border bg-background p-6 sm:p-8">
          <h2 className="text-2xl font-semibold">
            Track Order
          </h2>

          <p className="mt-2 text-muted-foreground">
            Enter your order number to check
            the latest status.
          </p>

          <form
            onSubmit={handleSubmit}
            className="mt-6 flex flex-col gap-3 sm:flex-row"
          >
            <input
              value={orderNumber}
              onChange={(event) =>
                setOrderNumber(
                  event.target.value,
                )
              }
              type="text"
              placeholder="e.g. SV-44171646-7698"
              className="flex-1 rounded-lg border bg-background px-4 py-3 outline-none focus:ring-2"
            />

            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? 'Loading...'
                : 'Track Order'}
            </button>
          </form>

          {error && (
            <div className="mt-5 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {error}
            </div>
          )}
        </section>

        {/* Order details */}
        {order && (
          <section className="mt-8 space-y-6">
            {/* Header */}
            <div className="rounded-2xl border bg-background p-6 sm:p-8">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Order Number
                  </p>

                  <h2 className="mt-1 text-2xl font-bold">
                    {order.orderNumber}
                  </h2>
                </div>

                <div className="rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold">
                  {formatStatus(
                    order.orderStatus,
                  )}
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="rounded-2xl border bg-background p-6 sm:p-8">
              <h2 className="text-xl font-semibold">
                Order Status
              </h2>

              <div className="mt-6 grid gap-4 sm:grid-cols-4">
                {(
  [
    'PLACED',
    'CONFIRMED',
    'PREPARING',
    'READY',
  ] as Order['orderStatus'][]
).map((status) => {
                  const statuses = [
                    'PLACED',
                    'CONFIRMED',
                    'PREPARING',
                    'READY',
                  ]

                  const currentIndex =
                    statuses.indexOf(
                      order.orderStatus,
                    )

                  const statusIndex =
                    statuses.indexOf(status)

                  const completed =
                    currentIndex >= statusIndex

                  return (
                    <div
                      key={status}
                      className={`rounded-xl border p-4 ${
                        completed
                          ? 'border-primary bg-primary/5'
                          : ''
                      }`}
                    >
                      <div
                        className={`mb-3 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                          completed
                            ? 'bg-primary text-primary-foreground'
                            : 'border'
                        }`}
                      >
                        {statusIndex + 1}
                      </div>

                      <p className="font-medium">
                        {formatStatus(status)}
                      </p>
                    </div>
                  )
                })}
              </div>

              {order.orderStatus ===
                'OUT_FOR_DELIVERY' && (
                <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
                  🚚 Your order is out for
                  delivery.
                </div>
              )}

              {order.orderStatus ===
                'DELIVERED' && (
                <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
                  ✅ Your order has been
                  delivered.
                </div>
              )}

              {order.orderStatus ===
                'CANCELLED' && (
                <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-destructive">
                  This order has been
                  cancelled.
                </div>
              )}
            </div>

            {/* Items */}
            <div className="rounded-2xl border bg-background p-6 sm:p-8">
              <h2 className="text-xl font-semibold">
                Your Items
              </h2>

              <div className="mt-5 divide-y">
                {order.items.map((item) => (
                  <div
                    key={`${item.productId}-${item.variantId}`}
                    className="flex items-center justify-between gap-4 py-4"
                  >
                    <div>
                      <p className="font-medium">
                        {item.productName}
                      </p>

                      <p className="text-sm text-muted-foreground">
                        {item.quantity} × ₹
                        {item.unitPrice.toLocaleString(
                          'en-IN',
                        )}
                      </p>
                    </div>

                    <p className="font-semibold">
                      ₹
                      {item.totalPrice.toLocaleString(
                        'en-IN',
                      )}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Delivery / pickup */}
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border bg-background p-6">
                <h2 className="text-xl font-semibold">
                  {order.fulfillmentType ===
                  'DELIVERY'
                    ? 'Delivery Details'
                    : 'Pickup Details'}
                </h2>

                <div className="mt-4 space-y-2 text-sm">
                  <p>
                    <span className="font-medium">
                      Name:
                    </span>{' '}
                    {order.customerName}
                  </p>

                  <p>
                    <span className="font-medium">
                      Phone:
                    </span>{' '}
                    {order.phone}
                  </p>

                  {order.fulfillmentType ===
                    'DELIVERY' &&
                    order.address && (
                      <p>
                        <span className="font-medium">
                          Address:
                        </span>{' '}
                        {
                          order.address
                            .addressLine
                        }
                        , {order.address.city},{' '}
                        {order.address.pincode}
                      </p>
                    )}

                  {order.fulfillmentType ===
                    'PICKUP' && (
                    <p className="text-muted-foreground">
                      Pick up from S.V. Sweets &
                      Bakers.
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border bg-background p-6">
                <h2 className="text-xl font-semibold">
                  Schedule
                </h2>

                <div className="mt-4 space-y-2 text-sm">
                  <p>
                    <span className="font-medium">
                      Date:
                    </span>{' '}
                    {order.scheduledDate}
                  </p>

                  <p>
                    <span className="font-medium">
                      Time:
                    </span>{' '}
                    {order.scheduledTime}
                  </p>

                  <p>
                    <span className="font-medium">
                      Payment:
                    </span>{' '}
                    {order.paymentMethod ===
                    'COD'
                      ? 'Cash on Delivery'
                      : 'Online Payment'}
                  </p>

                  <p>
                    <span className="font-medium">
                      Payment Status:
                    </span>{' '}
                    {formatPaymentStatus(
                      order.paymentStatus,
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Total */}
            <div className="rounded-2xl border bg-background p-6 sm:p-8">
              <h2 className="text-xl font-semibold">
                Payment Summary
              </h2>

              <div className="mt-5 space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Subtotal
                  </span>

                  <span>
                    ₹
                    {order.subtotal.toLocaleString(
                      'en-IN',
                    )}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Delivery Fee
                  </span>

                  <span>
                    ₹
                    {order.deliveryFee.toLocaleString(
                      'en-IN',
                    )}
                  </span>
                </div>

                <div className="my-4 border-t" />

                <div className="flex justify-between text-xl font-bold">
                  <span>Total</span>

                  <span>
                    ₹
                    {order.totalAmount.toLocaleString(
                      'en-IN',
                    )}
                  </span>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </>
  )
}