'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { withAdminAuth } from '@/components/admin/admin-auth'
import AdminNav from '@/components/admin/admin-nav'
import { cn } from '@/lib/utils'

type SalesAnalytics = {
  grossSales: number
  collectedRevenue: number
  pendingCod: number
  totalOrders: number
  averageOrderValue: number
  cancelledOrders: number
  grossSalesComparison: { current: number; previous: number; absoluteChange: number; percentChange: number | null; trend: 'up' | 'down' | 'flat' }
  totalOrdersComparison: { current: number; previous: number; absoluteChange: number; percentChange: number | null; trend: 'up' | 'down' | 'flat' }
  revenueOverTime: Array<{ date: string; orders: number; revenue: number }>
  paymentBreakdown: Array<{
    method: string
    label: string
    count: number
    amount: number
    collected: number
    pendingCod: number
  }>
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
  { value: 'thisYear', label: 'This Year' },
  { value: 'custom', label: 'Custom Range' },
]

function StatCard({
  label,
  value,
  subtitle,
  trend,
}: {
  label: string
  value: string
  subtitle?: string
  trend?: { percentChange: number | null; trend: 'up' | 'down' | 'flat' }
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-bold text-primary">{value}</p>
      {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
      {trend && trend.percentChange !== null && (
        <p className={`mt-1 text-xs font-medium ${trend.trend === 'up' ? 'text-green-600' : trend.trend === 'down' ? 'text-red-600' : 'text-muted-foreground'}`}>
          {trend.trend === 'up' ? '▲' : trend.trend === 'down' ? '▼' : '▬'} {Math.abs(trend.percentChange)}% vs prior period
        </p>
      )}
    </div>
  )
}

export default function SalesAnalyticsPage() {
  const [data, setData] = useState<SalesAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [range, setRange] = useState<string>('30d')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  useEffect(() => {
    fetchSalesAnalytics()
  }, [range, startDate, endDate])

  async function fetchSalesAnalytics() {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ range })
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)

      const response = await fetch(`/api/admin/analytics/sales?${params}`, {
        cache: 'no-store',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Unable to load sales analytics')
      }

      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load sales analytics')
    } finally {
      setLoading(false)
    }
  }

  async function handleExport() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ range })
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)

      const response = await fetch(`/api/admin/analytics/sales?${params}`, {
        cache: 'no-store',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Unable to export sales analytics')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'S.V. Bakery Sales Report.pdf'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to export sales analytics')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-muted/20">
        <div className="mx-auto max-w-7xl px-4 py-12">
          <div className="rounded-xl border border-border p-10 text-center">
            <p className="text-muted-foreground">Loading sales analytics…</p>
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
                  onClick={fetchSalesAnalytics}
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

  const { grossSales, collectedRevenue, pendingCod, totalOrders, averageOrderValue, cancelledOrders, grossSalesComparison, totalOrdersComparison, revenueOverTime, paymentBreakdown } = data

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
              Sales Analytics
            </h1>
            <p className="mt-2 text-muted-foreground">
              Track sales performance, revenue trends, and payment methods.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-5 py-2.5 text-sm font-semibold hover:bg-muted"
            >
              Export to PDF
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
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                    range === opt.value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:bg-muted',
                  )}
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
            value={`₹${grossSales.toLocaleString('en-IN')}`}
            subtitle={`Collected: ₹${collectedRevenue.toLocaleString('en-IN')}`}
            trend={grossSalesComparison}
          />
          <StatCard
            label="Total Orders"
            value={totalOrders.toLocaleString('en-IN')}
            trend={totalOrdersComparison}
          />
          <StatCard
            label="Average Order Value"
            value={`₹${averageOrderValue.toLocaleString('en-IN')}`}
          />
          <StatCard
            label="Pending COD"
            value={`₹${pendingCod.toLocaleString('en-IN')}`}
            subtitle="Awaiting collection"
          />
          <StatCard
            label="Cancelled Orders"
            value={cancelledOrders.toLocaleString('en-IN')}
          />
        </section>

        {/* Revenue Over Time */}
        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-primary mb-4">
              Revenue Over Time
            </h2>
            <div className="h-64 flex items-end gap-2">
              {revenueOverTime.map((point) => (
                <div
                  key={point.date}
                  className="flex flex-col items-center gap-1"
                  style={{
                    flex: 1,
                    minHeight: '24px',
                    height: `${Math.max(
                      24,
                      (point.revenue /
                        Math.max(
                          1,
                          ...revenueOverTime.map((p) => p.revenue),
                        )) *
                        300,
                    )}px`,
                  }}
                >
                  <div className="w-full bg-primary rounded-t" />
                  <span className="text-xs text-muted-foreground">
                    {point.date}
                  </span>
                </div>
              ))}
              {revenueOverTime.length === 0 && (
                <p className="text-center text-muted-foreground mt-8">
                  No revenue data yet.
                </p>
              )}
            </div>
          </div>

          {/* Orders Over Time */}
          <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-primary mb-4">
              Orders Over Time
            </h2>
            <div className="h-64 flex items-end gap-2">
              {revenueOverTime.map((point) => (
                <div
                  key={point.date}
                  className="flex flex-col items-center gap-1"
                  style={{
                    flex: 1,
                    minHeight: '24px',
                    height: `${Math.max(
                      24,
                      (point.orders /
                        Math.max(
                          1,
                          ...revenueOverTime.map((p) => p.orders),
                        )) *
                        300,
                    )}px`,
                  }}
                >
                  <div className="w-full bg-[#173F67] rounded-t" />
                  <span className="text-xs text-muted-foreground">
                    {point.date}
                  </span>
                </div>
              ))}
              {revenueOverTime.length === 0 && (
                <p className="text-center text-muted-foreground mt-8">
                  No order data yet.
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
            {paymentBreakdown.map((pb) => (
              <div
                key={pb.method}
                className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30"
              >
                <div>
                  <p className="font-medium text-primary">{pb.label}</p>
                  <p className="text-sm text-muted-foreground">
                    {pb.count} order{pb.count !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-primary">
                    {formatCurrency(pb.amount)} total sales
                  </p>
                  <p className="text-sm font-medium text-primary">
                    {formatCurrency(pb.collected)} collected
                  </p>
                  {pb.pendingCod > 0 && (
                    <p className="text-xs text-destructive font-medium">
                      {formatCurrency(pb.pendingCod)} pending collection
                    </p>
                  )}
                  {pb.collected === 0 && pb.amount === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No orders
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString('en-IN')}`
}