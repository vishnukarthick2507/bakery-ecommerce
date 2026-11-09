'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { withAdminAuth } from '@/components/admin/admin-auth'
import AdminNav from '@/components/admin/admin-nav'

type ProductAnalytics = {
  products: Array<{
    productName: string
    category: string
    unitsSold: number
    revenue: number
    cogs: number | null
    grossProfit: number | null
    grossProfitMargin: number | null
  }>
  totalRevenue: number
  totalUnits: number
  totalCogs: number
  totalGrossProfit: number
  totalGrossProfitMargin: number | null
  productsWithCost: number
  productsWithoutCost: number
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

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString('en-IN')}`
}

function formatNumber(value: number): string {
  return value.toLocaleString('en-IN')
}

export default function ProductAnalyticsPage() {
  const [data, setData] = useState<ProductAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [range, setRange] = useState<string>('30d')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  useEffect(() => {
    fetchProductAnalytics()
  }, [range, startDate, endDate])

  async function fetchProductAnalytics() {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ range })
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)

      const response = await fetch(`/api/admin/analytics/products?${params}`, {
        cache: 'no-store',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Unable to load product analytics')
      }

      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load product analytics')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-muted/20">
        <div className="mx-auto max-w-7xl px-4 py-12">
          <div className="rounded-xl border border-border p-10 text-center">
            <p className="text-muted-foreground">Loading product analytics…</p>
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
                  onClick={fetchProductAnalytics}
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

  const { products, totalRevenue, totalUnits, totalCogs, totalGrossProfit, totalGrossProfitMargin, productsWithCost, productsWithoutCost } = data

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
              Product Performance
            </h1>
            <p className="mt-2 text-muted-foreground">
              Track product sales, profitability, and inventory performance.
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
            label="Total Revenue"
            value={`₹${data.totalRevenue.toLocaleString('en-IN')}`}
          />
          <StatCard
            label="Total Units Sold"
            value={data.totalUnits.toLocaleString('en-IN')}
          />
          <StatCard
            label="Gross Profit"
            value={`₹${data.totalGrossProfit.toLocaleString('en-IN')}`}
          />
          <StatCard
            label="Gross Profit Margin"
            value={`${data.totalGrossProfitMargin?.toFixed(1) ?? 0}%`}
          />
          <StatCard
            label="Products Sold"
            value={data.totalUnits.toLocaleString('en-IN')}
          />
          <StatCard
            label="Products with Cost Data"
            value={data.productsWithCost.toString()}
          />
          <StatCard
            label="Products Without Cost Data"
            value={data.productsWithoutCost.toString()}
          />
        </section>

        {/* Product Performance Table */}
        <section className="mt-8 rounded-xl border border-border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-primary mb-0">
              Product Performance
            </h2>
            <p className="text-sm text-muted-foreground">
              Product performance and profitability based on order data.
            </p>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-3 text-sm font-medium text-muted-foreground text-left">
                    Product
                  </th>
                  <th className="py-3 text-sm font-medium text-muted-foreground text-left">
                    Category
                  </th>
                  <th className="py-3 text-sm font-medium text-muted-foreground text-right">
                    Units Sold
                  </th>
                  <th className="py-3 text-sm font-medium text-muted-foreground text-right">
                    Revenue
                  </th>
                  <th className="py-3 text-sm font-medium text-muted-foreground text-right">
                    COGS
                  </th>
                  <th className="py-3 text-sm font-medium text-muted-foreground text-right">
                    Gross Profit
                  </th>
                  <th className="py-3 text-sm font-medium text-muted-foreground text-right">
                    Margin %
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.map((p) => (
                  <tr key={p.productName} className="hover:bg-muted/30">
                    <td className="py-3 text-sm font-medium">{p.productName}</td>
                    <td className="py-3 text-sm">{p.category}</td>
                    <td className="py-3 text-sm text-right">{p.unitsSold}</td>
                    <td className="py-3 text-sm text-right font-medium">
                      {formatCurrency(p.revenue)}
                    </td>
                    <td className="py-3 text-sm text-right">
                      {p.cogs !== null ? formatCurrency(p.cogs) : 'N/A'}
                    </td>
                    <td className="py-3 text-sm text-right">
                      {p.grossProfit !== null ? formatCurrency(p.grossProfit) : 'N/A'}
                    </td>
                    <td className="py-3 text-sm text-right">
                      {p.grossProfitMargin !== null ? `${p.grossProfitMargin.toFixed(1)}%` : 'N/A'}
                    </td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      No product data available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Product Summary Insights */}
        <section className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-primary mb-4">Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Revenue</span>
                <span className="font-medium">{formatCurrency(totalRevenue)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Units Sold</span>
                <span className="font-medium">{totalUnits}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total COGS</span>
                <span className="font-medium">{formatCurrency(totalCogs)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Gross Profit</span>
                <span className="font-medium">{formatCurrency(totalGrossProfit)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Gross Profit Margin</span>
                <span className="font-medium">{`${totalGrossProfitMargin?.toFixed(1) ?? 0}%`}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Products with Cost Data</span>
                <span className="font-medium">{productsWithCost}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Products Without Cost Data</span>
                <span className="font-medium">{productsWithoutCost}</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

function cn(...classes: string[]): string {
  return classes.filter(Boolean).join(' ')
}