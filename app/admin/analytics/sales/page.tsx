'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { withAdminAuth } from '@/components/admin/admin-auth'
import AdminLayout from '@/components/admin/admin-layout'
import { cn } from '@/lib/utils'
import {
  formatPrice,
  formatNumber,
} from '@/lib/format'
import {
  LineChart,
  DonutChart,
  ChartContainer,
} from '@/components/admin/charts'

type SalesAnalytics = {
  grossSales: number | null
  collectedRevenue: number | null
  pendingCod: number | null
  totalOrders: number | null
  averageOrderValue: number | null
  cancelledOrders: number | null
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
  { value: 'yesterday', label: 'Yesterday' },
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
      <p className="text-sm text-foreground">{label}</p>
      <p className="mt-2 text-3xl font-bold text-primary">{value}</p>
      {subtitle && <p className="mt-1 text-xs text-foreground">{subtitle}</p>}
      {trend && trend.percentChange !== null && (
        <p className={`mt-1 text-xs font-medium ${trend.trend === 'up' ? 'text-green-600' : trend.trend === 'down' ? 'text-red-600' : 'text-foreground'}`}>
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

  if (loading) {
    return (
      <main className="min-h-screen bg-muted/20">
        <div className="mx-auto max-w-7xl px-4 py-12">
          <div className="rounded-xl border border-border p-10 text-center">
            <p className="text-foreground">Loading sales analytics…</p>
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
              <p className="text-foreground">No data available</p>
            )}
          </div>
        </div>
      </main>
    )
  }

  const {
    grossSales,
    collectedRevenue,
    pendingCod,
    totalOrders,
    averageOrderValue,
    cancelledOrders,
    grossSalesComparison,
    totalOrdersComparison,
    revenueOverTime,
    paymentBreakdown,
  } = data

  return (
    <AdminLayout>
      <main className="min-h-screen bg-muted/20">
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
                Sales Analytics
              </h1>
              <p className="mt-2 text-foreground">
                Track sales performance, revenue trends, and payment methods.
              </p>
            </div>
            <div className="flex gap-3">
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
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                      range === opt.value
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border text-foreground hover:bg-muted',
                    )}
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
              value={formatPrice(grossSales)}
              subtitle={`Collected: ${formatPrice(collectedRevenue)}`}
              trend={grossSalesComparison}
            />
            <StatCard
              label="Total Orders"
              value={formatNumber(totalOrders)}
              trend={totalOrdersComparison}
            />
            <StatCard
              label="Average Order Value"
              value={formatPrice(averageOrderValue)}
            />
            <StatCard
              label="Pending COD"
              value={formatPrice(pendingCod)}
              subtitle="Awaiting collection"
            />
            <StatCard
              label="Cancelled Orders"
              value={formatNumber(cancelledOrders)}
            />
          </section>

          {/* Revenue & Orders Trends */}
          <section className="mt-8 grid gap-6 lg:grid-cols-2">
            <ChartContainer
              title="Revenue Over Time"
              subtitle="Collected revenue trend across the selected period"
            >
              {revenueOverTime.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-center">
                  <p className="text-sm text-foreground">No revenue data yet.</p>
                </div>
              ) : (
                <LineChart
                  data={revenueOverTime.map((p) => ({
                    date: p.date,
                    value: p.revenue,
                    label: p.date,
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
              {revenueOverTime.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-center">
                  <p className="text-sm text-foreground">No order data yet.</p>
                </div>
              ) : (
                <LineChart
                  data={revenueOverTime.map((p) => ({
                    date: p.date,
                    value: p.orders,
                    label: p.date,
                  }))}
                  color="#C6A46A"
                  showArea
                  showPoints
                />
              )}
            </ChartContainer>
          </section>

          {/* Average Order Value Trend */}
          <section className="mt-8 grid gap-6 lg:grid-cols-2">
            <ChartContainer
              title="Average Order Value"
              subtitle="Average order value trend across the selected period"
            >
              {revenueOverTime.length === 0 || totalOrders === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-center">
                  <p className="text-sm text-foreground">No AOV data yet.</p>
                </div>
              ) : (
                <LineChart
                  data={revenueOverTime.map((p) => ({
                    date: p.date,
                    value: p.orders > 0 ? p.revenue / p.orders : 0,
                    label: p.date,
                  }))}
                  color="#536B60"
                  showArea
                  showPoints
                />
              )}
            </ChartContainer>

            <ChartContainer
              title="Revenue by Payment Method"
              subtitle="Revenue distribution across payment methods"
            >
              {paymentBreakdown.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-center">
                  <p className="text-sm text-foreground">No payment data yet.</p>
                </div>
              ) : (
                <DonutChart
                  data={paymentBreakdown.map((pb, i) => ({
                    label: pb.label,
                    value: pb.amount,
                    color: ['#17243A', '#C6A46A', '#536B60'][i % 3],
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
              {paymentBreakdown.map((pb) => (
                <div
                  key={pb.method}
                  className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30"
                >
                  <div>
                    <p className="font-medium text-primary">{pb.label}</p>
                    <p className="text-sm text-foreground">
                      {pb.count} order{pb.count !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-primary">
                      {formatPrice(pb.amount)} total sales
                    </p>
                    <p className="text-sm font-medium text-primary">
                      {formatPrice(pb.collected)} collected
                    </p>
                    {pb.pendingCod > 0 && (
                      <p className="text-xs text-destructive font-medium">
                        {formatPrice(pb.pendingCod)} pending collection
                      </p>
                    )}
                    {pb.collected === 0 && pb.amount === 0 && (
                      <p className="text-xs text-foreground">
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
    </AdminLayout>
  )
}
