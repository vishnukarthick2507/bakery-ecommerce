'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { withAdminAuth } from '@/components/admin/admin-auth'
import AdminLayout from '@/components/admin/admin-layout'
import { formatNumber, formatPrice } from '@/lib/format'

type OrderStatus =
  | 'PLACED'
  | 'PAYMENT_CONFIRMED'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'READY_FOR_PICKUP'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'COLLECTED'
  | 'CANCELLED'
  | 'RESCHEDULE_PROPOSED'

type Order = {
  _id: string
  orderNumber: string
  totalAmount: number
  paymentStatus: 'PENDING' | 'PAID' | 'FAILED'
  orderStatus: OrderStatus
  createdAt: string
}

type Product = {
  _id?: string
  active: boolean
  availability: 'AVAILABLE' | 'OUT_OF_STOCK' | 'DISABLED'
  stock: number
}

type InventoryAnalytics = {
  lowStockCount: number
  products: Array<{
    productId: string
    productName: string
    stock: number
    availability: string
    isLowStock: boolean
  }>
}

type DashboardAnalytics = {
  kpis: {
    totalOrders: number
    pendingOrders: number
    cancelledOrders: number
    collectedRevenue: number
    grossSales: number
    totalCustomers: number
  }
  charts: {
    revenueOverTime: Array<{ _id: string; revenue: number; orders: number }>
    orderStatusBreakdown: Array<{ _id: OrderStatus; count: number }>
    customCakeStats: Array<{ _id: string; count: number }>
  }
  totalCustomCakes: number
}

type DashboardStatus = {
  delivered: number
  collected: number
  cancelled: number
  active: number
}

type DashboardStat = {
  label: string
  value: string
  href: string
}

const statusLabel = (status: OrderStatus) =>
  status
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())

function AdminDashboardContent() {
  const [orders, setOrders] = useState<Order[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [inventoryAnalytics, setInventoryAnalytics] = useState<InventoryAnalytics | null>(null)
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [productsLoading, setProductsLoading] = useState(true)
  const [ordersError, setOrdersError] = useState('')
  const [analyticsError, setAnalyticsError] = useState('')
  const [productsError, setProductsError] = useState('')

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await fetch('/api/orders?page=1&limit=5', {
          cache: 'no-store',
          credentials: 'include',
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.message || 'Unable to fetch recent orders')
        setOrders(Array.isArray(data.orders) ? data.orders : [])
      } catch (err) {
        setOrdersError(err instanceof Error ? err.message : 'Unable to load recent orders')
      } finally {
        setOrdersLoading(false)
      }
    }

    const fetchAnalytics = async () => {
      try {
        const response = await fetch('/api/admin/analytics?range=30d', {
          cache: 'no-store',
          credentials: 'include',
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.message || 'Unable to load dashboard analytics')
        setAnalytics(data)
      } catch (err) {
        setAnalyticsError(err instanceof Error ? err.message : 'Unable to load dashboard analytics')
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
        const data = await response.json()
        if (!response.ok) throw new Error(data.message || 'Unable to fetch products')
        setProducts(Array.isArray(data) ? data : data.products ?? [])
      } catch (err) {
        setProductsError(err instanceof Error ? err.message : 'Unable to load products')
      } finally {
        setProductsLoading(false)
      }
    }

    const fetchInventoryAnalytics = async () => {
      try {
        const response = await fetch('/api/admin/analytics/inventory', {
          cache: 'no-store',
          credentials: 'include',
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.message || 'Unable to load inventory statistics')
        setInventoryAnalytics(data)
      } catch (err) {
        setProductsError(err instanceof Error ? err.message : 'Unable to load inventory statistics')
      }
    }

    void fetchOrders()
    void fetchProducts()
    void fetchAnalytics()
    void fetchInventoryAnalytics()
  }, [])

  const activeOutOfStock = products.filter(
    (product) => product.active && (product.stock <= 0 || product.availability === 'OUT_OF_STOCK'),
  ).length
  const lowStockCount = inventoryAnalytics?.lowStockCount ?? activeOutOfStock
  const statusCounts = (analytics?.charts.orderStatusBreakdown ?? []).reduce<DashboardStatus>(
    (counts, item) => {
      if (item._id === 'DELIVERED') counts.delivered = item.count
      else if (item._id === 'COLLECTED') counts.collected = item.count
      else if (item._id === 'CANCELLED') counts.cancelled = item.count
      else counts.active += item.count
      return counts
    },
    { delivered: 0, collected: 0, cancelled: 0, active: 0 },
  )
  const pendingCakeRequests = (analytics?.charts.customCakeStats ?? [])
    .find((item) => item._id === 'PENDING')?.count ?? 0
  const revenueTrend = (analytics?.charts.revenueOverTime ?? []).slice(-7)
  const lowStockProducts = (inventoryAnalytics?.products ?? []).filter((product) => product.isLowStock)

  const stats: DashboardStat[] = [
    { label: 'Total Orders', value: formatNumber(analytics?.kpis.totalOrders ?? 0), href: '/admin/orders' },
    { label: 'Pending Orders', value: formatNumber(analytics?.kpis.pendingOrders ?? 0), href: '/admin/orders' },
    { label: 'Completed Orders', value: formatNumber(statusCounts.delivered + statusCounts.collected), href: '/admin/orders' },
    { label: 'Cancelled Orders', value: formatNumber(analytics?.kpis.cancelledOrders ?? 0), href: '/admin/orders' },
    { label: 'Gross Sales', value: formatPrice(analytics?.kpis.grossSales ?? 0), href: '/admin/analytics' },
    { label: 'Received Revenue', value: formatPrice(analytics?.kpis.collectedRevenue ?? 0), href: '/admin/analytics/financial' },
    { label: 'Total Customers', value: formatNumber(analytics?.kpis.totalCustomers ?? 0), href: '/admin/customers' },
    { label: 'Total Products', value: formatNumber(products.length), href: '/admin/products' },
    { label: 'Low-Stock Products', value: formatNumber(lowStockCount), href: '/admin/inventory' },
    { label: 'Pending Custom Cake Requests', value: formatNumber(pendingCakeRequests), href: '/admin/custom-cakes' },
  ]

  return (
    <AdminLayout>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-semibold text-champagne-gold uppercase tracking-wider">
              Bluebell Bakehouse Admin
            </p>
            <h1 className="mt-1.5 text-3xl font-bold text-primary tracking-tight">Admin Dashboard</h1>
            <p className="mt-3 text-muted-foreground leading-relaxed">
              Manage your bakery orders and business operations.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg border border-gold-border bg-white px-5 py-2.5 text-sm font-semibold text-primary hover:bg-gold-border/50 transition-colors"
          >
            View Store
          </Link>
        </div>

        <section className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4" aria-label="Dashboard metrics">
          {stats.map((stat) => (
            <Link
              key={stat.label}
              href={stat.href}
              className="rounded-xl border border-gold-border bg-white p-6 shadow-sm transition-colors hover:border-champagne-gold hover:bg-cream/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-champagne-gold"
            >
              <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">{stat.label}</p>
              <p className="mt-2.5 text-3xl font-bold text-primary">
                {loading || analyticsError ? '—' : stat.value}
              </p>
            </Link>
          ))}
        </section>

        {analyticsError && (
          <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" role="alert">
            Dashboard metrics unavailable: {analyticsError}
          </div>
        )}
        {productsError && (
          <p className="mt-3 text-sm text-destructive" role="status">
            Inventory statistics unavailable: {productsError}
          </p>
        )}

        <section className="mt-10 rounded-xl border border-gold-border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-primary">Received Revenue Trend</h2>
              <p className="mt-1 text-sm text-muted-foreground">Last 7 days within the 30-day dashboard period</p>
            </div>
            <Link href="/admin/analytics" className="text-sm font-semibold text-primary hover:underline">View Analytics</Link>
          </div>
          {loading && <p className="mt-5 text-sm text-muted-foreground" role="status">Loading sales trend…</p>}
          {!loading && !analyticsError && revenueTrend.length === 0 && (
            <p className="mt-5 text-sm text-muted-foreground">No revenue activity in this period.</p>
          )}
          {!loading && !analyticsError && revenueTrend.length > 0 && (
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {revenueTrend.map((point) => (
                <div key={point._id} className="rounded-lg bg-cream/50 p-3">
                  <p className="text-xs text-muted-foreground">{new Date(`${point._id}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                  <p className="mt-1 font-semibold text-primary">{formatPrice(point.revenue)}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-6 rounded-xl border border-gold-border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-primary">Inventory Alerts</h2>
              <p className="mt-1 text-sm text-muted-foreground">{formatNumber(lowStockCount)} products are out of stock</p>
            </div>
            <Link href="/admin/inventory" className="text-sm font-semibold text-primary hover:underline">Manage Inventory</Link>
          </div>
          {productsLoading && <p className="mt-5 text-sm text-muted-foreground" role="status">Loading inventory…</p>}
          {!productsLoading && inventoryAnalytics && lowStockProducts.length === 0 && (
            <p className="mt-5 text-sm text-muted-foreground">No products meet the current low-stock rule.</p>
          )}
          {!productsLoading && inventoryAnalytics && lowStockProducts.length > 0 && (
            <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {lowStockProducts.slice(0, 8).map((product) => (
                <li key={product.productId} className="rounded-lg border border-gold-border p-3">
                  <p className="font-medium text-primary">{product.productName}</p>
                  <p className="mt-1 text-sm text-muted-foreground">Stock: {product.stock} · {product.availability.replaceAll('_', ' ')}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-10 rounded-xl border border-gold-border bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gold-border px-6 py-5">
            <div>
              <h2 className="text-xl font-semibold text-primary">Recent Orders</h2>
              <p className="mt-1 text-sm text-muted-foreground">Latest orders from your customers.</p>
            </div>
            <Link href="/admin/orders" className="text-sm font-semibold text-primary hover:underline">
              View All
            </Link>
          </div>

          {ordersError && <div className="p-6 text-sm text-destructive" role="alert">{ordersError}</div>}
          {ordersLoading && !ordersError && (
            <div className="p-6 text-sm text-muted-foreground" role="status">Loading recent orders…</div>
          )}
          {!ordersLoading && !ordersError && orders.length === 0 && (
            <div className="p-10 text-center text-muted-foreground">No orders yet.</div>
          )}
          {!ordersLoading && !ordersError && orders.length > 0 && (
            <div className="divide-y divide-gold-border">
              {orders.map((order) => (
                <div key={order._id} className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-primary">{order.orderNumber}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(order.createdAt).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-primary">
                      {formatPrice(order.totalAmount)} · {order.paymentStatus}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{statusLabel(order.orderStatus)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-10 rounded-xl border border-gold-border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-primary">Order Summary</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Delivered / Collected</p>
              <p className="mt-2 text-3xl font-bold text-primary">
                {loading || analyticsError ? '—' : `${statusCounts.delivered} delivered · ${statusCounts.collected} collected`}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Active Orders</p>
              <p className="mt-2 text-3xl font-bold text-primary">
                {loading || analyticsError ? '—' : statusCounts.active}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Pending Orders</p>
              <p className="mt-2 text-3xl font-bold text-primary">{loading || analyticsError ? '—' : analytics?.kpis.pendingOrders ?? 0}</p>
            </div>
          </div>
        </section>
      </div>
    </AdminLayout>
  )
}

export default withAdminAuth(AdminDashboardContent)