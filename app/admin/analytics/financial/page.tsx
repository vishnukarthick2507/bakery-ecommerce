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
  BarChart,
  DonutChart,
  ChartContainer,
} from '@/components/admin/charts'

type FinancialAnalytics = {
  grossRevenue: number | null
  collectedRevenue: number | null
  pendingCod: number | null
  totalRazorpayFees: number | null
  totalTaxAmount: number | null
  totalCogs: number | null
  grossProfit: number | null
  grossProfitMargin: number | null
  netContribution: number | null
  outstandingAmount: number | null
  cancelledOrders: number | null
  productsWithCost: number
  productsWithoutCost: number
  hasCostData: boolean
  hasRazorpayFeeData: boolean
  hasTaxData: boolean
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

export default function FinancialAnalyticsPage() {
  const [data, setData] = useState<FinancialAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [range, setRange] = useState<string>('30d')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  useEffect(() => {
    fetchFinancialAnalytics()
  }, [range, startDate, endDate])

  async function fetchFinancialAnalytics() {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ range })
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)

      const response = await fetch(`/api/admin/analytics/financial?${params}`, {
        cache: 'no-store',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Unable to load financial analytics')
      }

      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load financial analytics')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-muted/20">
        <div className="mx-auto max-w-7xl px-4 py-12">
          <div className="rounded-xl border border-border p-10 text-center">
            <p className="text-muted-foreground">Loading financial analytics…</p>
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
                  onClick={fetchFinancialAnalytics}
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
                className="text-sm text-muted-foreground hover:underline"
              >
                ← Back to Dashboard
              </Link>
              <h1 className="mt-3 text-3xl font-bold text-primary">
                Financial Analytics
              </h1>
              <p className="mt-2 text-muted-foreground">
                Track revenue, costs, profitability, and financial performance.
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
              label="Gross Revenue"
              value={formatPrice(data.grossRevenue)}
            />
            <StatCard
              label="Collected Revenue"
              value={formatPrice(data.collectedRevenue)}
            />
            <StatCard
              label="Gross Profit"
              value={formatPrice(data.grossProfit)}
              subtitle={`Margin: ${data.grossProfitMargin?.toFixed(1) ?? 0}%`}
            />
            <StatCard
              label="Razorpay Fees"
              value={formatPrice(data.totalRazorpayFees)}
            />
            <StatCard
              label="Tax Amount"
              value={formatPrice(data.totalTaxAmount)}
            />
            <StatCard
              label="COGS"
              value={formatPrice(data.totalCogs)}
            />
            <StatCard
              label="Net Contribution"
              value={formatPrice(data.netContribution)}
            />
            <StatCard
              label="Outstanding Orders"
              value={formatPrice(data.outstandingAmount)}
            />
          </section>

          {/* Financial Insights */}
          <section className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-primary mb-4">
                Financial Summary
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Gross Revenue</span>
                  <span className="font-medium text-primary">
                    {formatPrice(data.grossRevenue)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Collected Revenue</span>
                  <span className="font-medium text-primary">
                    {formatPrice(data.collectedRevenue)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Razorpay Fees</span>
                  <span className="font-medium text-primary">
                    {formatPrice(data.totalRazorpayFees)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax Amount</span>
                  <span className="font-medium text-primary">
                    {formatPrice(data.totalTaxAmount)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">COGS</span>
                  <span className="font-medium text-primary">
                    {formatPrice(data.totalCogs)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Gross Profit</span>
                  <span className="font-medium text-primary">
                    {formatPrice(data.grossProfit)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Gross Profit Margin</span>
                  <span className="font-medium text-primary">
                    {`${data.grossProfitMargin?.toFixed(1) ?? 0}%`}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Net Contribution</span>
                  <span className="font-medium text-primary">
                    {formatPrice(data.netContribution)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Outstanding Orders</span>
                  <span className="font-medium text-primary">
                    {formatPrice(data.outstandingAmount)}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Financial Breakdown Charts */}
          <section className="mt-8 grid gap-6 lg:grid-cols-2">
            <ChartContainer
              title="Revenue Breakdown"
              subtitle="Collected vs pending revenue"
            >
              <BarChart
                data={[
                  { label: 'Collected Revenue', value: data.collectedRevenue ?? 0 },
                  { label: 'Pending COD', value: data.pendingCod ?? 0 },
                  { label: 'Outstanding', value: data.outstandingAmount ?? 0 },
                ]}
                color="#17243A"
                showLabels
              />
            </ChartContainer>

            <ChartContainer
              title="Cost & Profit Distribution"
              subtitle="Gross profit, COGS, and net contribution"
            >
              <DonutChart
                data={[
                  { label: 'Gross Profit', value: Math.max(data.grossProfit ?? 0, 0), color: '#536B60' },
                  { label: 'COGS', value: Math.max(data.totalCogs ?? 0, 0), color: '#C6A46A' },
                  { label: 'Net Contribution', value: Math.max(data.netContribution ?? 0, 0), color: '#B28C52' },
                ]}
              />
            </ChartContainer>
          </section>

          {/* Revenue & Margin Trends */}
          <section className="mt-8 grid gap-6 lg:grid-cols-2">
            <ChartContainer
              title="Revenue Trend"
              subtitle="Gross revenue trend across the selected period"
            >
              <BarChart
                data={[
                  { label: 'Gross Revenue', value: data.grossRevenue ?? 0 },
                  { label: 'Collected Revenue', value: data.collectedRevenue ?? 0 },
                  { label: 'Net Contribution', value: Math.max(data.netContribution ?? 0, 0) },
                ]}
                color="#17243A"
                showLabels
              />
            </ChartContainer>

            <ChartContainer
              title="Profit Margin"
              subtitle="Gross profit margin percentage"
            >
              <DonutChart
                data={[
                  { label: 'Gross Margin', value: Math.round(data.grossProfitMargin ?? 0), color: '#536B60' },
                  { label: 'Remaining', value: Math.max(100 - Math.round(data.grossProfitMargin ?? 0), 0), color: '#E8E2D8' },
                ]}
                showLegend
              />
            </ChartContainer>
          </section>

          {/* Data Availability Notes */}
          <section className="mt-8 rounded-xl border border-border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-primary mb-4">
              Data Availability
            </h2>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <span className={`text-sm font-medium ${data.hasCostData ? 'text-green-600' : 'text-muted-foreground'}`}>
                  {data.hasCostData ? '✓' : '✗'}
                </span>
                <span className="text-sm">
                  {data.hasCostData
                    ? 'Product cost data is available for profitability analysis.'
                    : 'Product cost data is not available. Gross profit and margin cannot be calculated.'}
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className={`text-sm font-medium ${data.hasRazorpayFeeData ? 'text-green-600' : 'text-muted-foreground'}`}>
                  {data.hasRazorpayFeeData ? '✓' : '✗'}
                </span>
                <span className="text-sm">
                  {data.hasRazorpayFeeData
                    ? 'Razorpay fee data is available for fee analysis.'
                    : 'Razorpay fee data is not available.'}
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className={`text-sm font-medium ${data.hasTaxData ? 'text-green-600' : 'text-muted-foreground'}`}>
                  {data.hasTaxData ? '✓' : '✗'}
                </span>
                <span className="text-sm">
                  {data.hasTaxData
                    ? 'Tax data is available for tax reporting.'
                    : 'Tax data is not available.'}
                </span>
              </div>
            </div>
          </section>
        </div>
      </main>
    </AdminLayout>
  )
}
