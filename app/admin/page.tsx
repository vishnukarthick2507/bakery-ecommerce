'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { withAdminAuth } from '@/components/admin/admin-auth'
import AdminLayout from '@/components/admin/admin-layout'
import {
  formatPrice,
  formatNumber,
} from '@/lib/format'

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
    .replace(/\b\w/g, (letter) => letter.toUpperCase())

function AdminDashboardContent() {
  const [orders, setOrders] = useState<Order[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [customersCount, setCustomersCount] = useState<number>(0)
  const [customersLoading, setCustomersLoading] = useState(true)
  const [loading, setLoading] = useState(true)
  const [productsLoading, setProductsLoading] = useState(true)
  const [error, setError] = useState('')
  const [productsError, setProductsError] = useState('')

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        credentials: 'include',
      })
    } catch {
      // Ignore logout errors; cookie is cleared client-side below anyway.
    }
    document.cookie = 'admin-token=; path=/; max-age=0'
    window.location.href = '/admin/login'
  }

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await fetch('/api/orders', {
          cache: 'no-store',
          credentials: 'include',
        })

        if (!response.ok) {
          throw new Error('Unable to fetch orders')
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
        const response = await fetch('/api/products?includeInactive=true', {
          cache: 'no-store',
          credentials: 'include',
        })

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

    const fetchCustomersCount = async () => {
      try {
        const response = await fetch('/api/admin/customers?page=1&limit=1', {
          cache: 'no-store',
          credentials: 'include',
        })

        if (!response.ok) {
          // Non-fatal: customer count is supplemental data
          setCustomersCount(0)
          return
        }

        const data = await response.json()
        setCustomersCount(data.pagination?.total ?? 0)
      } catch {
        setCustomersCount(0)
      } finally {
        setCustomersLoading(false)
      }
    }

    fetchOrders()
    fetchProducts()
    fetchCustomersCount()
  }, [])

  const totalOrders = orders.length
  const today = new Date().toDateString()
  const todaysOrders = orders.filter(
    (order) => new Date(order.createdAt).toDateString() === today,
  )

  const pendingOrders = orders.filter(
    (order) =>
      order.orderStatus === 'PLACED' ||
      order.orderStatus === 'PAYMENT_CONFIRMED',
  ).length

  const preparingOrders = orders.filter(
    (order) => order.orderStatus === 'PREPARING',
  ).length

  const readyOrders = orders.filter((order) => order.orderStatus === 'READY').length

  const deliveredOrders = orders.filter(
    (order) => order.orderStatus === 'DELIVERED',
  ).length

  const cancelledOrders = orders.filter(
    (order) => order.orderStatus === 'CANCELLED',
  ).length

  const pendingPayments = orders.filter(
    (order) => order.paymentStatus === 'PENDING',
  ).length

  const paidOrdersArray = orders.filter(
    (order) => order.paymentStatus === 'PAID',
  )
  const paidOrders = paidOrdersArray.length

  const totalRevenue = paidOrdersArray.reduce(
    (sum, order) => sum + order.totalAmount,
    0,
  )

  const todaysRevenue = paidOrdersArray
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

  return (
    <AdminLayout>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-semibold text-champagne-gold uppercase tracking-wider">
              Bluebell Bakehouse Admin
            </p>

            <h1 className="mt-1.5 text-3xl font-bold text-primary tracking-tight">
              Admin Dashboard
            </h1>

            <p className="mt-3 text-muted-foreground leading-relaxed">
              Manage your bakery orders and business operations.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg border border-gold-border bg-white px-5 py-2.5 text-sm font-semibold text-primary hover:bg-gold-border/50 transition-colors"
            >
              View Store
            </Link>
          </div>
        </div>

        {/* Stats */}
        <section className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Total Orders', value: formatNumber(totalOrders) },
            { label: "Today's Orders", value: formatNumber(todaysOrders.length) },
            { label: 'Total Customers', value: formatNumber(customersCount) },
            { label: 'Total Products', value: formatNumber(products.length) },
            { label: 'Pending Orders', value: formatNumber(pendingOrders) },
            { label: 'Preparing', value: formatNumber(preparingOrders) },
            { label: 'Ready', value: formatNumber(readyOrders) },
            { label: 'Delivered', value: formatNumber(deliveredOrders) },
            { label: 'Cancelled', value: formatNumber(cancelledOrders) },
            {
              label: 'Paid Revenue',
              value: loading || error ? '—' : formatPrice(totalRevenue),
            },
            {
              label: "Today's Paid Revenue",
              value: loading || error ? '—' : formatPrice(todaysRevenue),
            },
            { label: 'Pending Payments', value: formatNumber(pendingPayments) },
            {
              label: 'Average Order Value',
              value:
                loading || error
                  ? '—'
                  : formatPrice(Math.round(averageOrderValue)),
            },
            { label: 'Out of Stock', value: formatNumber(outOfStockProducts) },
          ].map((stat, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-gold-border bg-white p-6 shadow-sm"
            >
              <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">
                {stat.label}
              </p>
              <p className="mt-2.5 text-3xl font-bold text-primary">
                {stat.value}
              </p>
            </div>
          ))}
        </section>

        {productsError && (
          <p className="mt-3 text-sm text-destructive" role="status">
            Inventory statistics unavailable: {productsError}
          </p>
        )}

        {/* Recent Orders */}
        <section className="mt-10 rounded-xl border border-gold-border bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gold-border px-6 py-5">
            <div>
              <h2 className="text-xl font-semibold text-primary">Recent Orders</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Latest orders from your customers.
              </p>
            </div>
            <Link
              href="/admin/orders"
              className="text-sm font-semibold text-primary hover:underline"
            >
              View All
            </Link>
          </div>

          {error && (
            <div className="p-6 text-sm text-destructive">{error}</div>
          )}

          {!loading && !error && orders.length === 0 && (
            <div className="p-10 text-center text-muted-foreground">
              No orders yet.
            </div>
          )}

          {!loading && !error && orders.length > 0 && (
            <div className="divide-y divide-gold-border">
              {orders.slice(0, 5).map((order) => (
                <div
                  key={order._id}
                  className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold text-primary">{order.orderNumber}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{order.customerName}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(order.createdAt).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-primary">
                      {formatPrice(order.totalAmount)}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {statusLabel(order.orderStatus)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Delivery summary */}
        <section className="mt-10 rounded-xl border border-gold-border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-primary">Order Summary</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">
                Delivered
              </p>
              <p className="mt-2 text-3xl font-bold text-primary">
                {loading || error ? '—' : deliveredOrders}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">
                Active Orders
              </p>
              <p className="mt-2 text-3xl font-bold text-primary">
                {loading || error
                  ? '—'
                  : orders.filter(
                      (order) =>
                        !['DELIVERED', 'CANCELLED'].includes(order.orderStatus),
                    ).length}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">
                Pending Confirmation
              </p>
              <p className="mt-2 text-3xl font-bold text-primary">
                {loading || error ? '—' : pendingOrders}
              </p>
            </div>
          </div>
        </section>
      </div>
    </AdminLayout>
  )
}

export default withAdminAuth(AdminDashboardContent)
