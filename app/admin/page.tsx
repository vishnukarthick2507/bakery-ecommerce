'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type OrderStatus =
  | 'PLACED'
  | 'PAYMENT_CONFIRMED'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'

type Order = {
  _id: string
  orderNumber: string
  customerName: string
  phone: string
  totalAmount: number
  paymentStatus: string
  orderStatus: OrderStatus
  createdAt: string
}

const statusLabel = (status: OrderStatus) =>
  status
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    )

export default function AdminPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const apiUrl =
          process.env.NEXT_PUBLIC_API_URL ||
          'http://localhost:5000'

        const response = await fetch(
          `${apiUrl}/api/orders`,
          {
            cache: 'no-store',
          },
        )

        if (!response.ok) {
          throw new Error(
            'Unable to fetch orders',
          )
        }

        const data = await response.json()

        setOrders(data.orders ?? [])
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load dashboard',
        )
      } finally {
        setLoading(false)
      }
    }

    fetchOrders()
  }, [])

  const totalOrders = orders.length

  const placedOrders = orders.filter(
    (order) =>
      order.orderStatus === 'PLACED',
  ).length

  const preparingOrders = orders.filter(
    (order) =>
      order.orderStatus === 'PREPARING',
  ).length

  const deliveredOrders = orders.filter(
    (order) =>
      order.orderStatus === 'DELIVERED',
  ).length

  const totalRevenue = orders.reduce(
    (sum, order) =>
      sum + order.totalAmount,
    0,
  )

  return (
    <main className="min-h-screen bg-muted/20">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-medium text-primary">
              S.V. Sweets & Bakers
            </p>

            <h1 className="mt-1 text-3xl font-bold">
              Admin Dashboard
            </h1>

            <p className="mt-2 text-muted-foreground">
              Manage your bakery orders and
              business operations.
            </p>
          </div>

          <Link
            href="/"
            className="rounded-lg border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            View Store
          </Link>
        </div>

        {/* Stats */}
        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <div className="rounded-2xl border bg-background p-6">
            <p className="text-sm text-muted-foreground">
              Total Orders
            </p>

            <p className="mt-2 text-3xl font-bold">
              {loading ? '—' : totalOrders}
            </p>
          </div>

          <div className="rounded-2xl border bg-background p-6">
            <p className="text-sm text-muted-foreground">
              New Orders
            </p>

            <p className="mt-2 text-3xl font-bold">
              {loading ? '—' : placedOrders}
            </p>
          </div>

          <div className="rounded-2xl border bg-background p-6">
            <p className="text-sm text-muted-foreground">
              Preparing
            </p>

            <p className="mt-2 text-3xl font-bold">
              {loading
                ? '—'
                : preparingOrders}
            </p>
          </div>

          <div className="rounded-2xl border bg-background p-6">
            <p className="text-sm text-muted-foreground">
              Revenue
            </p>

            <p className="mt-2 text-3xl font-bold">
              {loading
                ? '—'
                : `₹${totalRevenue.toLocaleString(
                    'en-IN',
                  )}`}
            </p>
          </div>
        </section>

        {/* Navigation */}
        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <Link
            href="/admin/orders"
            className="rounded-2xl border bg-background p-6 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <h2 className="text-xl font-semibold">
              Orders
            </h2>

            <p className="mt-2 text-sm text-muted-foreground">
              View and manage customer orders.
            </p>

            <p className="mt-4 text-sm font-medium text-primary">
              Manage Orders →
            </p>
          </Link>

          <div className="rounded-2xl border bg-background p-6 opacity-70">
            <h2 className="text-xl font-semibold">
              Products
            </h2>

            <p className="mt-2 text-sm text-muted-foreground">
              Manage bakery products and prices.
            </p>

            <p className="mt-4 text-sm text-muted-foreground">
              Coming next
            </p>
          </div>

          <div className="rounded-2xl border bg-background p-6 opacity-70">
            <h2 className="text-xl font-semibold">
              Inventory
            </h2>

            <p className="mt-2 text-sm text-muted-foreground">
              Manage stock and availability.
            </p>

            <p className="mt-4 text-sm text-muted-foreground">
              Coming soon
            </p>
          </div>

          <div className="rounded-2xl border bg-background p-6 opacity-70">
            <h2 className="text-xl font-semibold">
              Customers
            </h2>

            <p className="mt-2 text-sm text-muted-foreground">
              View customer information and
              orders.
            </p>

            <p className="mt-4 text-sm text-muted-foreground">
              Coming soon
            </p>
          </div>
        </section>

        {/* Recent Orders */}
        <section className="mt-8 rounded-2xl border bg-background">

          <div className="flex items-center justify-between border-b p-6">
            <div>
              <h2 className="text-xl font-semibold">
                Recent Orders
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                Latest orders from your customers.
              </p>
            </div>

            <Link
              href="/admin/orders"
              className="text-sm font-medium text-primary hover:underline"
            >
              View All
            </Link>
          </div>

          {error && (
            <div className="p-6 text-sm text-destructive">
              {error}
            </div>
          )}

          {!loading &&
            !error &&
            orders.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                No orders yet.
              </div>
            )}

          {!loading &&
            !error &&
            orders.length > 0 && (
              <div className="divide-y">
                {orders
                  .slice(0, 5)
                  .map((order) => (
                    <div
                      key={order._id}
                      className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-semibold">
                          {order.orderNumber}
                        </p>

                        <p className="mt-1 text-sm text-muted-foreground">
                          {order.customerName}
                        </p>

                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(
                            order.createdAt,
                          ).toLocaleString(
                            'en-IN',
                          )}
                        </p>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-semibold">
                            ₹
                            {order.totalAmount.toLocaleString(
                              'en-IN',
                            )}
                          </p>

                          <p className="mt-1 text-sm text-muted-foreground">
                            {statusLabel(
                              order.orderStatus,
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
        </section>

        {/* Delivery summary */}
        <section className="mt-8 rounded-2xl border bg-background p-6">
          <h2 className="text-xl font-semibold">
            Order Summary
          </h2>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">
                Delivered
              </p>

              <p className="mt-1 text-2xl font-bold">
                {deliveredOrders}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">
                Active Orders
              </p>

              <p className="mt-1 text-2xl font-bold">
                {orders.filter(
                  (order) =>
                    ![
                      'DELIVERED',
                      'CANCELLED',
                    ].includes(
                      order.orderStatus,
                    ),
                ).length}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">
                Pending Confirmation
              </p>

              <p className="mt-1 text-2xl font-bold">
                {placedOrders}
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}