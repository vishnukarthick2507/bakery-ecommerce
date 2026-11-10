'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { withAdminAuth } from '@/components/admin/admin-auth'
import AdminLayout from '@/components/admin/admin-layout'
import {
  formatPrice,
  formatNumber,
  formatPriceOr,
  formatNumberOr,
} from '@/lib/format'
import {
  LineChart,
  BarChart,
  DonutChart,
  ChartContainer,
} from '@/components/admin/charts'

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
  grossSales: number | null
  collectedRevenue: number | null
  pendingCod: number | null
  totalOrders: number | null
  averageOrderValue: number | null
  totalCustomers: number | null
  totalProductsSold: number | null
  cancelledOrders: number | null
  grossProfit: number | null
  grossProfitMargin: number | null
  outstandingAmount: number | null
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
  totalCustomCakes: number | null
}

type DateRangeOption = {
  value: string
  label: string
}

const dateRangeOptions: DateRangeOption[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
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
      <p className="text-sm text-foreground">{label}</p>
      <p className="mt-2 text-3xl font-bold text-primary">{value}</p>
      {subtitle && <p className="mt-1 text-xs text-foreground">{subtitle}</p>}
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
        credentials: 'include',
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
          credentials: 'include',
        },
      )

      if (!response.ok) {
        throw new Error('Unable to export analytics')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'Bluebell Bakehouse Analytics.xlsx'
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
      <AdminLayout>
        <div className="mx-auto max-w-7xl py-12">
          <div className="rounded-xl border border-border p-10 text-center">
            <p className="text-foreground">Loading analytics…</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  if (!data) {
    return (
      <AdminLayout>
        <div className="mx-auto max-w-7xl py-12">
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
              <p className="text-foreground">No data available</p>
            )}
          </div>
        </div>
      </AdminLayout>
    )
  }

  const { kpis, charts, lowStock, totalCustomCakes } = data

  return (
    <AdminLayout>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-medium text-primary">
              Bluebell Bakehouse Admin
            </p>
            <Link
              href="/admin"
              className="text-sm text-foreground hover:underline"
            >
              ← Back to Dashboard
            </Link>
            <h1 className="mt-3 text-3xl font-bold text-primary">
              Analytics & Reports
            </h1>
            <p className="mt-2 text-foreground">
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

        {/* Date Range Filters */}
        <section className="mt-6 rounded-xl border border-border bg-white p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-foreground">
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
                      : 'border-border text-foreground hover:bg-muted'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {range === 'custom' && (
              <div className="flex items-center gap-3">
                <label className="text-sm text-foreground">From</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm"
                />
                <label className="text-sm text-foreground">To</label>
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
            value={formatPrice(kpis.grossSales)}
            subtitle={`${formatPrice(kpis.collectedRevenue)} collected`}
          />
          <StatCard
            label="Collected Revenue"
            value={formatPrice(kpis.collectedRevenue)}
            subtitle={`${formatPrice(kpis.pendingCod)} pending COD`}
          />
          <StatCard
            label="Pending COD"
            value={formatPrice(kpis.pendingCod)}
            subtitle="Awaiting collection"
          />
          <StatCard
            label="Total Orders"
            value={formatNumber(kpis.totalOrders)}
          />
          <StatCard
            label="Average Order Value"
            value={formatPrice(kpis.averageOrderValue)}
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
            label="Gross Profit"
            value={formatPrice(kpis.grossProfit)}
            subtitle={`Margin: ${kpis.grossProfitMargin?.toFixed(1) ?? 0}%`}
          />
          <StatCard
            label="Outstanding Payments"
            value={formatPrice(kpis.outstandingAmount)}
            subtitle="Awaiting collection"
          />
          <StatCard
            label="Custom Cake Requests"
            value={formatNumber(totalCustomCakes)}
          />
        </section>

        {/* Revenue & Orders Charts */}
        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <ChartContainer
            title="Collected Revenue Over Time"
            subtitle="Collected revenue trend across the selected period"
          >
            {charts.revenueOverTime.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center">
                <p className="text-sm text-foreground">No collected revenue yet.</p>
              </div>
            ) : (
              <LineChart
                data={charts.revenueOverTime.map((p) => ({
                  date: p._id,
                  value: p.revenue,
                  label: p._id,
                }))}
                color="#17243A"
                showArea
                showPoints
              />
            )}
          </ChartContainer>

          <ChartContainer
            title="Orders Over Time"
            subtitle="Order volume trend across the selected period"
          >
            {charts.ordersOverTime.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center">
                <p className="text-sm text-foreground">No orders yet.</p>
              </div>
            ) : (
              <LineChart
                data={charts.ordersOverTime.map((p) => ({
                  date: p._id,
                  value: p.count,
                  label: p._id,
                }))}
                color="#C6A46A"
                showArea
                showPoints
              />
            )}
          </ChartContainer>
        </section>

        {/* Top Products & Status Breakdown */}
        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <ChartContainer
            title="Top-Selling Products"
            subtitle="Product revenue ranking based on order data"
          >
            {charts.topProducts.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center">
                <p className="text-sm text-foreground">No products sold yet.</p>
              </div>
            ) : (
              <BarChart
                data={charts.topProducts.map((p) => ({
                  label: p.productName,
                  value: p.revenue,
                }))}
                color="#17243A"
                showLabels
              />
            )}
          </ChartContainer>

          <ChartContainer
            title="Order Status Breakdown"
            subtitle="Order count by status"
          >
            {charts.orderStatusBreakdown.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center">
                <p className="text-sm text-foreground">No orders yet.</p>
              </div>
            ) : (
              <DonutChart
                data={charts.orderStatusBreakdown.map((s, i) => ({
                  label: statusLabel(s._id as OrderStatus),
                  value: s.count,
                  color: ['#17243A', '#C6A46A', '#536B60', '#B28C52', '#E8E2D8'][i % 5],
                }))}
              />
            )}
          </ChartContainer>
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
                    <p className="text-sm text-foreground">
                      {formatNumber(p.count)} order{
                        p.count !== 1 ? 's' : ''
                      }
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-primary">
                      {formatPrice(p.amount)} total sales
                    </p>
                    <p className="text-sm font-medium text-primary">
                      {formatPrice(p.collected)} collected
                    </p>
                    {isCod && p.pendingCod > 0 && (
                      <p className="text-xs text-destructive font-medium">
                        {formatPrice(p.pendingCod)} pending collection
                      </p>
                    )}
                    {!isCod && p.collected === 0 && p.amount === 0 && (
                      <p className="text-xs text-foreground">
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
                  <th className="py-3 text-sm font-medium text-foreground">
                    Customer
                  </th>
                  <th className="py-3 text-sm font-medium text-foreground">
                    Phone
                  </th>
                  <th className="py-3 text-sm font-medium text-foreground text-right">
                    Orders
                  </th>
                  <th className="py-3 text-sm font-medium text-foreground text-right">
                    Total Spent
                  </th>
                  <th className="py-3 text-sm font-medium text-foreground text-right">
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
                      {formatPrice(c.totalSpent)}
                    </td>
                    <td className="py-3 text-sm text-right text-foreground">
                      {c.lastOrder
                        ? new Date(c.lastOrder).toLocaleDateString('en-IN')
                        : '—'}
                    </td>
                  </tr>
                ))}
                {charts.topCustomers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-foreground">
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
            <p className="text-sm text-foreground">
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
                <p className="mt-1 text-sm text-foreground">
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
                <p className="mt-1 text-xs text-foreground">
                  {p.availability}
                </p>
              </div>
            ))}
            {lowStock.length === 0 && (
              <p className="text-center text-foreground py-8">
                All products are in stock.
              </p>
            )}
          </div>
        </section>
      </div>
    </AdminLayout>
  )
}