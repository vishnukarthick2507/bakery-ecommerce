'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { withAdminAuth } from '@/components/admin/admin-auth'

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

type Product = {
  active: boolean
  availability: 'AVAILABLE' | 'OUT_OF_STOCK' | 'DISABLED'
  stock: number
}

const statusLabel = (status: OrderStatus) =>
  status
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    )

function AdminPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [productsLoading, setProductsLoading] = useState(true)
  const [error, setError] = useState('')
  const [productsError, setProductsError] = useState('')

  const handleLogout = () => {
    localStorage.removeItem('admin-token')
    localStorage.removeItem('admin-user')
    window.location.href = '/admin/login'
  }

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await fetch(
          '/api/orders',
          {
            cache: 'no-store',
            headers: {
              Authorization: `Bearer ${localStorage.getItem('admin-token')}`,
            },
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

    const fetchProducts = async () => {
      try {
        const response = await fetch(
          '/api/products?includeInactive=true',
          {
            cache: 'no-store',
            headers: {
              Authorization: `Bearer ${localStorage.getItem('admin-token')}`,
            },
          },
        )

        if (!response.ok) {
          throw new Error('Unable to fetch inventory')
        }

        setProducts(await response.json())
      } catch (err) {
        setProductsError(
          err instanceof Error
            ? err.message
            : 'Unable to load inventory',
        )
      } finally {
        setProductsLoading(false)
      }
    }

    fetchOrders()
    fetchProducts()
  }, [])

  const totalOrders = orders.length
  const today = new Date().toDateString()
  const todaysOrders = orders.filter(
    (order) => new Date(order.createdAt).toDateString() === today,
  )

  const placedOrders = orders.filter(
    (order) =>
      order.orderStatus === 'PLACED',
  ).length

  const pendingOrders = orders.filter(
    (order) =>
      order.orderStatus === 'PLACED' ||
      order.orderStatus === 'PAYMENT_CONFIRMED',
  ).length

  const preparingOrders = orders.filter(
    (order) =>
      order.orderStatus === 'PREPARING',
  ).length

  const readyOrders = orders.filter(
    (order) => order.orderStatus === 'READY',
  ).length

  const deliveredOrders = orders.filter(
    (order) =>
      order.orderStatus === 'DELIVERED',
  ).length

  const cancelledOrders = orders.filter(
    (order) => order.orderStatus === 'CANCELLED',
  ).length

  const pendingPayments = orders.filter(
    (order) => order.paymentStatus === 'PENDING',
  ).length

  const paidOrders = orders.filter(
    (order) => order.paymentStatus === 'PAID',
  )

  const totalRevenue = paidOrders.reduce(
    (sum, order) => sum + order.totalAmount,
    0,
  )

  const todaysRevenue = paidOrders
    .filter((order) => new Date(order.createdAt).toDateString() === today)
    .reduce((sum, order) => sum + order.totalAmount, 0)

  const completedOrderValues = orders.filter(
    (order) => order.orderStatus !== 'CANCELLED',
  )

  const averageOrderValue = completedOrderValues.length
    ? completedOrderValues.reduce(
        (sum, order) => sum + order.totalAmount,
        0,
      ) / completedOrderValues.length
    : 0

  const outOfStockProducts = products.filter(
    (product) =>
      product.active &&
      (product.stock <= 0 || product.availability === 'OUT_OF_STOCK'),
  ).length

  const stats = [
    { label: 'Total Orders', value: loading || error ? '—' : totalOrders.toLocaleString('en-IN') },
    { label: "Today's Orders", value: loading || error ? '—' : todaysOrders.length.toLocaleString('en-IN') },
    { label: 'Pending Orders', value: loading || error ? '—' : pendingOrders.toLocaleString('en-IN') },
    { label: 'Preparing', value: loading || error ? '—' : preparingOrders.toLocaleString('en-IN') },
    { label: 'Ready', value: loading || error ? '—' : readyOrders.toLocaleString('en-IN') },
    { label: 'Delivered', value: loading || error ? '—' : deliveredOrders.toLocaleString('en-IN') },
    { label: 'Cancelled', value: loading || error ? '—' : cancelledOrders.toLocaleString('en-IN') },
    { label: 'Paid Revenue', value: loading || error ? '—' : `₹${totalRevenue.toLocaleString('en-IN')}` },
    { label: "Today's Paid Revenue", value: loading || error ? '—' : `₹${todaysRevenue.toLocaleString('en-IN')}` },
    { label: 'Pending Payments', value: loading || error ? '—' : pendingPayments.toLocaleString('en-IN') },
    { label: 'Average Order Value', value: loading || error ? '—' : `₹${Math.round(averageOrderValue).toLocaleString('en-IN')}` },
    { label: 'Out of Stock', value: productsLoading || productsError ? '—' : outOfStockProducts.toLocaleString('en-IN') },
  ]

  return (
    <main className="min-h-screen bg-muted/20">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-medium text-primary">
              S.V. Bakery Admin
            </p>

            <h1 className="mt-1 text-3xl font-bold">
              Admin Dashboard
            </h1>

            <p className="mt-2 text-muted-foreground">
              Manage your bakery orders and
              business operations.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleLogout}
              className="rounded-lg border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Logout
            </button>
            <Link
              href="/"
              className="rounded-lg border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              View Store
            </Link>
          </div>
        </div>

        {/* Stats */}
        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border bg-background p-6">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="mt-2 text-3xl font-bold">{stat.value}</p>
            </div>
          ))}
        </section>

        {productsError && (
          <p className="mt-3 text-sm text-destructive" role="status">
            Inventory statistics unavailable: {productsError}
          </p>
        )}

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

          <Link
            href="/admin/products"
            className="rounded-2xl border bg-background p-6 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <h2 className="text-xl font-semibold">
              Products
            </h2>

            <p className="mt-2 text-sm text-muted-foreground">
              Manage bakery products, prices,
              stock and availability.
            </p>

            <p className="mt-4 text-sm font-medium text-primary">
              Manage Products →
            </p>
          </Link>

          <Link
            href="/admin/inventory"
            className="rounded-2xl border bg-background p-6 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <h2 className="text-xl font-semibold">Inventory</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Review stock and product availability.
            </p>
            <p className="mt-4 text-sm font-medium text-primary">Manage Inventory →</p>
          </Link>

          <Link
            href="/admin/custom-cakes"
            className="rounded-2xl border bg-background p-6 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <h2 className="text-xl font-semibold">
              Custom Cakes
            </h2>

            <p className="mt-2 text-sm text-muted-foreground">
              View and manage custom cake requests.
            </p>

            <p className="mt-4 text-sm font-medium text-primary">
              Manage Requests →
            </p>
          </Link>

          <Link
            href="/admin/payments"
            className="rounded-2xl border bg-background p-6 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <h2 className="text-xl font-semibold">Payments &amp; Transactions</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Review payment records linked to real orders.
            </p>
            <p className="mt-4 text-sm font-medium text-primary">
              View Payments →
            </p>
          </Link>

          <Link
            href="/admin/customers"
            className="rounded-2xl border bg-background p-6 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <h2 className="text-xl font-semibold">
              Customers
            </h2>

            <p className="mt-2 text-sm text-muted-foreground">
              View customer information and
              orders.
            </p>

            <p className="mt-4 text-sm font-medium text-primary">
              View Customers →
            </p>
          </Link>
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
                {loading || error ? '—' : deliveredOrders}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">
                Active Orders
              </p>

              <p className="mt-1 text-2xl font-bold">
                {loading || error
                  ? '—'
                  : orders.filter(
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
                {loading || error ? '—' : pendingOrders}
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

export default withAdminAuth(AdminPage)