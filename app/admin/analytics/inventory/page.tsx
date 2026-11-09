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
  ChartContainer,
} from '@/components/admin/charts'

type InventorySummary = {
  productId: string
  productName: string
  category: string
  stock: number
  price: number
  reorderLevel: number | null
  availability: string
  isLowStock: boolean
  unitsSold: number
}

type InventoryAnalytics = {
  products: InventorySummary[]
  lowStockCount: number | null
  totalStockValue: number | null
  totalProducts: number | null
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

export default function InventoryAnalyticsPage() {
  const [data, setData] = useState<InventoryAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [range, setRange] = useState<string>('30d')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  useEffect(() => {
    fetchInventoryAnalytics()
  }, [range, startDate, endDate])

  async function fetchInventoryAnalytics() {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ range })
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)

      const response = await fetch(`/api/admin/analytics/inventory?${params}`, {
        cache: 'no-store',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Unable to load inventory analytics')
      }

      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load inventory analytics')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-muted/20">
        <div className="mx-auto max-w-7xl px-4 py-12">
          <div className="rounded-xl border border-border p-10 text-center">
            <p className="text-muted-foreground">Loading inventory analytics…</p>
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
                  onClick={fetchInventoryAnalytics}
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

  const { products, lowStockCount, totalStockValue, totalProducts } = data

  return (
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
              Inventory Analytics
            </h1>
            <p className="mt-2 text-muted-foreground">
              Track stock levels, reorder alerts, and inventory performance.
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
            label="Total Products"
            value={formatNumber(totalProducts)}
          />
          <StatCard
            label="Total Stock Value"
            value={formatPrice(totalStockValue)}
          />
          <StatCard
            label="Low Stock Items"
            value={formatNumber(lowStockCount)}
          />
          <StatCard
            label="Total Products Listed"
            value={formatNumber(totalProducts)}
          />
        </section>

        {/* Inventory Distribution Charts */}
        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <ChartContainer
            title="Stock Status Distribution"
            subtitle="Products by low stock status"
          >
            <BarChart
              data={[
                { label: 'Adequately Stocked', value: products.filter((p) => !p.isLowStock).length },
                { label: 'Low Stock', value: products.filter((p) => p.isLowStock).length },
              ]}
              color="#17243A"
              showLabels
            />
          </ChartContainer>

          <ChartContainer
            title="Top Products by Units Sold"
            subtitle="Best-selling products by sales volume"
          >
            {products.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center">
                <p className="text-sm text-secondary-text">No inventory data available.</p>
              </div>
            ) : (
              <BarChart
                data={products
                  .sort((a, b) => b.unitsSold - a.unitsSold)
                  .slice(0, 8)
                  .map((p) => ({ label: p.productName, value: p.unitsSold }))}
                color="#C6A46A"
                showLabels
              />
            )}
          </ChartContainer>
        </section>

        {/* Low Stock Alert */}
        <section className="mt-8 rounded-xl border border-border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-primary mb-0">
              Low Stock Items
            </h2>
            <p className="text-sm text-muted-foreground">
              {formatNumber(lowStockCount)} items need restocking
            </p>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3 xl:grid-cols-4">
            {products.filter((p) => p.isLowStock).map((p) => (
              <div
                key={p.productId}
                className="rounded-lg border border-border p-4 bg-white"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-primary">{p.productName}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {p.category}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                    p.isLowStock
                      ? 'bg-red-50 text-red-700 border-red-100'
                      : 'bg-green-50 text-green-700 border-green-100'
                  }`}
                  >
                    {p.isLowStock ? 'LOW STOCK' : 'OK'}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Stock: {formatNumber(p.stock)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Reorder Level:
                  {p.reorderLevel !== null ? formatNumber(p.reorderLevel) : 'Not set'}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Units Sold: {formatNumber(p.unitsSold)}
                </p>
              </div>
            ))}
            {products.filter((p) => p.isLowStock).length === 0 && (
              <p className="mt-8 text-center text-muted-foreground">
                No low stock items. All products are adequately stocked.
              </p>
            )}
          </div>
        </section>

        {/* Inventory Table */}
        <section className="mt-8 rounded-xl border border-border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-primary mb-0">
              Product Inventory
            </h2>
            <p className="text-sm text-muted-foreground">
              View all products with their stock levels and sales performance.
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
                    Price
                  </th>
                  <th className="py-3 text-sm font-medium text-muted-foreground text-right">
                    Stock
                  </th>
                  <th className="py-3 text-sm font-medium text-muted-foreground text-right">
                    Units Sold
                  </th>
                  <th className="py-3 text-sm font-medium text-muted-foreground text-right">
                    Reorder Level
                  </th>
                  <th className="py-3 text-sm font-medium text-muted-foreground text-right">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.map((p) => (
                  <tr key={p.productId} className="hover:bg-muted/30">
                    <td className="py-3 text-sm font-medium">{p.productName}</td>
                    <td className="py-3 text-sm">{p.category}</td>
                    <td className="py-3 text-sm text-right font-medium">
                      {formatPrice(p.price)}
                    </td>
                    <td className="py-3 text-sm text-right font-medium">
                      {formatNumber(p.stock)}
                    </td>
                    <td className="py-3 text-sm text-right">{formatNumber(p.unitsSold)}</td>
                    <td className="py-3 text-sm text-right">
                      {p.reorderLevel !== null ? formatNumber(p.reorderLevel) : 'Not set'}
                    </td>
                    <td className="py-3 text-sm text-right">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                        p.isLowStock
                          ? 'bg-red-50 text-red-700 border-red-100'
                          : 'bg-green-50 text-green-700 border-green-100'
                      }`}
                      >
                        {p.isLowStock ? 'Low Stock' : 'OK'}
                      </span>
                    </td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      No inventory data available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  )
}
