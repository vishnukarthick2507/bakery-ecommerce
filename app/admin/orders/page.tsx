'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type OrderStatus =
  | 'PLACED'
  | 'PAYMENT_CONFIRMED'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'

type OrderItem = {
  productName: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

type Order = {
  _id: string
  orderNumber: string
  customerName: string
  phone: string
  fulfillmentType: 'DELIVERY' | 'PICKUP'
  scheduledDate: string
  scheduledTime: string
  paymentMethod: 'COD' | 'ONLINE'
  paymentStatus: 'PENDING' | 'PAID' | 'FAILED'
  orderStatus: OrderStatus
  items: OrderItem[]
  subtotal: number
  deliveryFee: number
  totalAmount: number
  createdAt: string
}

const statuses: OrderStatus[] = [
  'PLACED',
  'PAYMENT_CONFIRMED',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
]

function formatStatus(status: OrderStatus) {
  return status
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null)

  async function fetchOrders() {
    try {
      setLoading(true)
      setError('')

      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

      const response = await fetch(`${apiUrl}/api/orders`, {
        cache: 'no-store',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Unable to fetch orders')
      }

      setOrders(data.orders ?? [])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load orders',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
  }, [])

  async function updateStatus(
    orderNumber: string,
    status: OrderStatus,
  ) {
    try {
      setUpdatingOrder(orderNumber)
      setError('')

      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

      const response = await fetch(
        `${apiUrl}/api/orders/${encodeURIComponent(orderNumber)}/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status }),
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.message || 'Unable to update order status',
        )
      }

      setOrders((currentOrders) =>
        currentOrders.map((order) =>
          order.orderNumber === orderNumber
            ? {
                ...order,
                orderStatus: data.order.orderStatus,
              }
            : order,
        ),
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update order',
      )
    } finally {
      setUpdatingOrder(null)
    }
  }

  return (
    <main className="min-h-screen bg-muted/20">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <Link
              href="/admin"
              className="text-sm text-muted-foreground hover:underline"
            >
              ← Back to Dashboard
            </Link>

            <h1 className="mt-3 text-3xl font-bold">
              Orders
            </h1>

            <p className="mt-2 text-muted-foreground">
              View and manage customer orders.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchOrders}
            disabled={loading}
            className="rounded-lg border bg-background px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
          >
            {loading ? 'Refreshing...' : 'Refresh Orders'}
          </button>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading && (
          <div className="mt-8 rounded-2xl border bg-background p-10 text-center">
            Loading orders...
          </div>
        )}

        {!loading && !error && orders.length === 0 && (
          <div className="mt-8 rounded-2xl border bg-background p-10 text-center">
            <h2 className="text-xl font-semibold">
              No orders yet
            </h2>

            <p className="mt-2 text-muted-foreground">
              Customer orders will appear here.
            </p>
          </div>
        )}

        {!loading && orders.length > 0 && (
          <div className="mt-8 space-y-6">
            {orders.map((order) => (
              <section
                key={order._id}
                className="rounded-2xl border bg-background p-6 shadow-sm sm:p-8"
              >
                {/* Order header */}
                <div className="flex flex-col justify-between gap-4 border-b pb-6 sm:flex-row">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Order Number
                    </p>

                    <h2 className="mt-1 text-2xl font-bold">
                      {order.orderNumber}
                    </h2>

                    <p className="mt-2 text-sm text-muted-foreground">
                      Placed{' '}
                      {new Date(order.createdAt).toLocaleString('en-IN')}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground">
                      Total
                    </p>

                    <p className="text-2xl font-bold">
                      ₹{order.totalAmount.toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>

                {/* Customer details */}
                <div className="grid gap-6 border-b py-6 md:grid-cols-3">

                  <div>
                    <p className="text-sm text-muted-foreground">
                      Customer
                    </p>

                    <p className="mt-1 font-semibold">
                      {order.customerName}
                    </p>

                    <p className="mt-1 text-sm">
                      {order.phone}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground">
                      Fulfillment
                    </p>

                    <p className="mt-1 font-semibold">
                      {order.fulfillmentType === 'DELIVERY'
                        ? 'Delivery'
                        : 'Pickup'}
                    </p>

                    <p className="mt-1 text-sm text-muted-foreground">
                      {order.scheduledDate} · {order.scheduledTime}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground">
                      Payment
                    </p>

                    <p className="mt-1 font-semibold">
                      {order.paymentMethod === 'COD'
                        ? 'Cash on Delivery'
                        : 'Online'}
                    </p>

                    <p className="mt-1 text-sm text-muted-foreground">
                      {order.paymentStatus}
                    </p>
                  </div>

                </div>

                {/* Items */}
                <div className="border-b py-6">
                  <h3 className="font-semibold">
                    Items
                  </h3>

                  <div className="mt-4 divide-y">
                    {order.items.map((item, index) => (
                      <div
                        key={`${order._id}-${index}`}
                        className="flex items-center justify-between gap-4 py-3"
                      >
                        <div>
                          <p className="font-medium">
                            {item.productName}
                          </p>

                          <p className="text-sm text-muted-foreground">
                            {item.quantity} × ₹
                            {item.unitPrice.toLocaleString('en-IN')}
                          </p>
                        </div>

                        <p className="font-semibold">
                          ₹{item.totalPrice.toLocaleString('en-IN')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Status */}
                <div className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-end sm:justify-between">

                  <div>
                    <p className="text-sm text-muted-foreground">
                      Current Status
                    </p>

                    <p className="mt-1 text-xl font-bold">
                      {formatStatus(order.orderStatus)}
                    </p>
                  </div>

                  <div className="w-full sm:w-72">
                    <label
                      htmlFor={`status-${order._id}`}
                      className="text-sm font-medium"
                    >
                      Change Status
                    </label>

                    <select
                      id={`status-${order._id}`}
                      value={order.orderStatus}
                      disabled={
                        updatingOrder === order.orderNumber
                      }
                      onChange={(event) =>
                        updateStatus(
                          order.orderNumber,
                          event.target.value as OrderStatus,
                        )
                      }
                      className="mt-2 w-full rounded-lg border bg-background px-4 py-3 outline-none focus:ring-2 disabled:opacity-60"
                    >
                      {statuses.map((status) => (
                        <option
                          key={status}
                          value={status}
                        >
                          {formatStatus(status)}
                        </option>
                      ))}
                    </select>

                    {updatingOrder === order.orderNumber && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        Updating order...
                      </p>
                    )}
                  </div>

                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}