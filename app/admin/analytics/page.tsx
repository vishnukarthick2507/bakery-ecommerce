'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { withAdminAuth } from '@/components/admin/admin-auth'
import AdminNav from '@/components/admin/admin-nav'

type OrderStatus =
  | 'PLACED'
  | 'PAYMENT_CONFIRMED'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'

type PaymentMethod = 'COD' | 'ONLINE'
type FulfillmentType = 'DELIVERY' | 'PICKUP'
type CakeStatus = 'PENDING' | 'CONTACTED' | 'CLOSED'

type KPI = {
  grossSales: number
  collectedRevenue: number
  pendingCod: number
  totalOrders: number
  averageOrderValue: number
  totalCustomers: number
  totalProductsSold: number
  cancelledOrders: number
}

type ChartSeries = {
  revenueOverTime: Array<{ _id: string; revenue: number; orders: number }>
  ordersOverTime: Array<{ _id: string; count: number }>
  topProducts: Array<{ _id: string; productName: string; unitsSold: number; revenue: number }>
  revenueByProduct: Array<{ _id: string; productName: string; revenue: number; unitsSold: number }>
  orderStatusBreakdown: Array<{ _id: string; count: number }>
  paymentBreakdown: Array<{ _id: string; count: number; amount: number; collected: number; pendingCod: number }>
  fulfillmentBreakdown: Array<{ _id: string; count: number; amount: number }>
  topCustomers: Array<{ _id: string; name: string; email: string; totalSpent: number; orderCount: number; lastOrder: string }>
  customCakeStats: Array<{ _id: string; count: number }>
}

type LowStock = {
  id: string
  name: string
  category: string
  stock: number
  availability: string
  isLowStock: boolean
}

type AnalyticsData = {
  range: string
  dateRange: { start: string; end: string } | null
  kpis: KPI
  charts: ChartSeries
  lowStock: LowStock[]
  totalCustomCakes: number
}

type DateRangeOption = {
  value: string
  label: string
}

const dateRangeOptions: DateRangeOption[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'lastMonth', label: 'Last Month' },
  { value: 'custom', label: 'Custom Range' },
]

const statusLabel = (status: OrderStatus) =>
  status
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString('en-IN')}`
}

function formatNumber(value: number): string {
  return value.toLocaleString('en-IN')
}

function StatCard({
  label,
  value,
  subtitle,
}: {
  label: string
  value: string
  subtitle?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-bold text-primary">{value}</p>
      {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  )
}

function formatStatusBadge(status: string) {
  const statusColors: Record<string, string> = {
    PLACED: 'bg-blue-50 text-blue-700 border-blue-100',
    PAYMENT_CONFIRMED: 'bg-blue-50 text-blue-700 border-blue-100',
    CONFIRMED: 'bg-blue-50 text-blue-700 border-blue-100',
    PREPARING: 'bg-amber-50 text-amber-700 border-amber-100',
    READY: 'bg-amber-50 text-amber-700 border-amber-100',
    OUT_FOR_DELIVERY: 'bg-blue-50 text-blue-700 border-blue-100',
    DELIVERED: 'bg-green-50 text-green-700 border-green-100',
    CANCELLED: 'bg-red-50 text-red-700 border-red-100',
    PENDING: 'bg-blue-50 text-blue-700 border-blue-100',
    CONTACTED: 'bg-amber-50 text-amber-700 border-amber-100',
    CLOSED: 'bg-gray-50 text-gray-700 border-gray-100',
  }
  return statusColors[status] || 'bg-muted text-muted-foreground border-muted'
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [range, setRange] = useState<string>('30d')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    fetchAnalytics()
  }, [range, startDate, endDate])

  async function fetchAnalytics() {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ range })
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)

      const response = await fetch(`/api/admin/analytics?${params}`, {
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('admin-token')}`,
        },
      })

      if (!response.ok) {
        throw new Error('Unable to load analytics')
      }

      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load analytics')
    } finally {
      setLoading(false)
    }
  }

  async function handleExport() {
    setExporting(true)
    try {
      const params = new URLSearchParams({ range })
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)

      const response = await fetch(
        `/api/admin/analytics/export?${params}`,
        {
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('admin-token')}`,
          },
        },
      )

      if (!response.ok) {
        throw new Error('Unable to export analytics')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'S.V. Bakery Analytics.xlsx'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to export analytics')
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-muted/20">
        <div className="mx-auto max-w-7xl px-4 py-12">
          <div className="rounded-xl border border-border p-10 text-center">
            <p className="text-muted-foreground">Loading analytics…</p>
          </div>
        </div>
      </main>
    )
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-muted/20">
        <div className="mx-auto max-w-7xl px-4 py-12">
          <div className="rounded-xl border border-border p-10 text-center">
            {error ? (
              <>
                <p className="text-destructive">{error}</p>
                <button
                  onClick={fetchAnalytics}
                  className="mt-4 inline-flex rounded-lg border border-border px-5 py-2 text-sm font-medium hover:bg-muted"
                >
                  Retry
                </button>
              </>
            ) : (
              <p className="text-muted-foreground">No data available</p>
            )}
          </div>
        </div>
      </main>
    )
  }

  const { kpis, charts, lowStock, totalCustomCakes } = data

  return (
    <main className="min-h-screen bg-muted/20">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-medium text-primary">
              S.V. Bakery Admin
            </p>
            <Link
              href="/admin"
              className="text-sm text-muted-foreground hover:underline"
            >
              ← Back to Dashboard
            </Link>
            <h1 className="mt-3 text-3xl font-bold text-primary">
              Analytics & Reports
            </h1>
            <p className="mt-2 text-muted-foreground">
              Track sales, orders, and business performance.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-5 py-2.5 text-sm font-semibold hover:bg-muted disabled:opacity-60"
            >
              {exporting ? 'Exporting…' : 'Export to Excel'}
            </button>
            <Link
              href="/"
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              View Store
            </Link>
          </div>
        </div>

        <AdminNav className="mt-6" />

        {/* Date Range Filters */}
        <section className="mt-6 rounded-xl border border-border bg-white p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">
                Date range:
              </span>
              {dateRangeOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setRange(opt.value)
                    setStartDate('')
                    setEndDate('')
                  }}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    range === opt.value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {range === 'custom' && (
              <div className="flex items-center gap-3">
                <label className="text-sm text-muted-foreground">From</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm"
                />
                <label className="text-sm text-muted-foreground">To</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm"
                />
              </div>
            )}
          </div>
        </section>

        {/* KPI Cards */}
        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Gross Sales"
            value={formatCurrency(kpis.grossSales)}
            subtitle={`${formatCurrency(kpis.collectedRevenue)} collected`}
          />
          <StatCard
            label="Collected Revenue"
            value={formatCurrency(kpis.collectedRevenue)}
            subtitle={`${formatCurrency(kpis.pendingCod)} pending COD`}
          />
          <StatCard
            label="Pending COD"
            value={formatCurrency(kpis.pendingCod)}
            subtitle="Awaiting collection"
          />
          <StatCard
            label="Total Orders"
            value={formatNumber(kpis.totalOrders)}
          />
          <StatCard
            label="Average Order Value"
            value={formatCurrency(Math.round(kpis.averageOrderValue))}
          />
          <StatCard
            label="Total Customers"
            value={formatNumber(kpis.totalCustomers)}
          />
          <StatCard
            label="Products Sold"
            value={formatNumber(kpis.totalProductsSold)}
          />
          <StatCard
            label="Cancelled Orders"
            value={formatNumber(kpis.cancelledOrders)}
          />
          <StatCard
            label="Custom Cake Requests"
            value={formatNumber(totalCustomCakes)}
          />
        </section>

        {/* Revenue & Orders Charts */}
        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-primary mb-4">
              Collected Revenue Over Time
            </h2>
            <div className="h-64 flex items-end gap-2">
              {charts.revenueOverTime.map((point) => (
                <div
                  key={point._id}
                  className="flex flex-col items-center gap-1"
                  style={{
                    flex: 1,
                    minHeight: '24px',
                    height: `${Math.max(
                      24,
                      (point.revenue /
                        Math.max(
                          1,
                          ...charts.revenueOverTime.map((p) => p.revenue),
                        )) *
                        300,
                    )}px`,
                  }}
                >
                  <div className="w-full bg-primary rounded-t" />
                  <span className="text-xs text-muted-foreground">
                    {point._id}
                  </span>
                </div>
              ))}
              {charts.revenueOverTime.length === 0 && (
                <p className="text-center text-muted-foreground mt-8">
                  No collected revenue yet.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-primary mb-4">
              Orders Over Time
            </h2>
            <div className="h-64 flex items-end gap-2">
              {charts.ordersOverTime.map((point) => (
                <div
                  key={point._id}
                  className="flex flex-col items-center gap-1"
                  style={{
                    flex: 1,
                    minHeight: '24px',
                    height: `${Math.max(
                      24,
                      (point.count /
                        Math.max(
                          1,
                          ...charts.ordersOverTime.map((p) => p.count),
                        )) *
                        300,
                    )}px`,
                  }}
                >
                  <div className="w-full bg-[#173F67] rounded-t" />
                  <span className="text-xs text-muted-foreground">
                    {point._id}
                  </span>
                </div>
              ))}
              {charts.ordersOverTime.length === 0 && (
                <p className="text-center text-muted-foreground mt-8">
                  No orders yet.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Top Products & Status Breakdown */}
        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-primary mb-4">
              Top-Selling Products
            </h2>
            <div className="divide-y divide-border">
              {charts.topProducts.map((p, i) => (
                <div key={p._id} className="flex justify-between py-3">
                  <div>
                    <p className="font-medium text-primary">
                      {p.productName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatNumber(p.unitsSold)} units sold
                    </p>
                  </div>
                  <p className="font-semibold text-primary">
                    {formatCurrency(p.revenue)}
                  </p>
                </div>
              ))}
              {charts.topProducts.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No products sold yet.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-primary mb-4">
              Order Status Breakdown
            </h2>
            <div className="space-y-3">
              {charts.orderStatusBreakdown.map((s) => (
                <div key={s._id} className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    {statusLabel(s._id as OrderStatus)}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${formatStatusBadge(s._id)}`}
                  >
                    {formatNumber(s.count)}
                  </span>
                </div>
              ))}
              {charts.orderStatusBreakdown.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No orders yet.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Payment Method Breakdown */}
        <section className="mt-8 rounded-xl border border-border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-primary mb-4">
            Payment Method Breakdown
          </h2>
          <div className="space-y-4">
            {[
              { id: 'COD', label: 'Cash on Delivery' },
              { id: 'ONLINE', label: 'Online Payment' },
            ].map((method) => {
              const p =
                charts.paymentBreakdown.find((x) => x._id === method.id) ??
                { count: 0, amount: 0, collected: 0, pendingCod: 0 }
              const isCod = method.id === 'COD'
              return (
                <div
                  key={method.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30"
                >
                  <div>
                    <p className="font-medium text-primary">{method.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatNumber(p.count)} order{
                        p.count !== 1 ? 's' : ''
                      }
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-primary">
                      {formatCurrency(p.amount)} total sales
                    </p>
                    <p className="text-sm font-medium text-primary">
                      {formatCurrency(p.collected)} collected
                    </p>
                    {isCod && p.pendingCod > 0 && (
                      <p className="text-xs text-destructive font-medium">
                        {formatCurrency(p.pendingCod)} pending collection
                      </p>
                    )}
                    {!isCod && p.collected === 0 && p.amount === 0 && (
                      <p className="text-xs text-muted-foreground">
                        No orders
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Top Customers */}
        <section className="mt-8 rounded-xl border border-border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-primary mb-4">
            Top Customers by Spending
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-3 text-sm font-medium text-muted-foreground">
                    Customer
                  </th>
                  <th className="py-3 text-sm font-medium text-muted-foreground">
                    Phone
                  </th>
                  <th className="py-3 text-sm font-medium text-muted-foreground text-right">
                    Orders
                  </th>
                  <th className="py-3 text-sm font-medium text-muted-foreground text-right">
                    Total Spent
                  </th>
                  <th className="py-3 text-sm font-medium text-muted-foreground text-right">
                    Last Order
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {charts.topCustomers.map((c) => (
                  <tr key={c._id} className="hover:bg-muted/30">
                    <td className="py-3 text-sm font-medium">{c.name}</td>
                    <td className="py-3 text-sm">{c._id}</td>
                    <td className="py-3 text-sm text-right">
                      {formatNumber(c.orderCount)}
                    </td>
                    <td className="py-3 text-sm text-right font-medium">
                      {formatCurrency(c.totalSpent)}
                    </td>
                    <td className="py-3 text-sm text-right text-muted-foreground">
                      {c.lastOrder
                        ? new Date(c.lastOrder).toLocaleDateString('en-IN')
                        : '—'}
                    </td>
                  </tr>
                ))}
                {charts.topCustomers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      No customer data yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Low Stock Products */}
        <section className="mt-8 rounded-xl border border-border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-primary mb-0">
              Low-Stock Products
            </h2>
            <p className="text-sm text-muted-foreground">
              {lowStock.length} items need attention
            </p>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lowStock.map((p) => (
              <div
                key={p.id}
                className="rounded-lg border border-border p-4 bg-white"
              >
                <p className="font-medium text-primary">{p.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {p.category}
                </p>
                <p className="mt-2 text-sm">
                  Stock:{' '}
                  <span className={`font-medium ${
                    p.isLowStock ? 'text-red-700' : 'text-primary'
                  }`}>
                    {formatNumber(p.stock)}
                  </span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {p.availability}
                </p>
              </div>
            ))}
            {lowStock.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                All products are in stock.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
