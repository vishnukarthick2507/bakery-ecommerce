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

type CustomerMetric = {
  name: string
  phone: string
  email: string | null
  orderCount: number
  totalSpent: number
  averageOrderValue: number
  firstOrderAt: Date | null
  lastOrderAt: Date | null
  isGuest: boolean
}

type CustomerAnalytics = {
  totalCustomers: number | null
  paidCustomers: number | null
  repeatCustomers: number | null
  guestCustomers: number | null
  registeredCustomers: number | null
  totalCustomerSpent: number | null
  customerLTV: number | null
  avgOrderCount: number | null
  customers: CustomerMetric[]
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

export default function CustomerAnalyticsPage() {
  const [data, setData] = useState<CustomerAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [range, setRange] = useState<string>('30d')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  useEffect(() => {
    fetchCustomerAnalytics()
  }, [range, startDate, endDate])

  async function fetchCustomerAnalytics() {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ range })
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)

      const response = await fetch(`/api/admin/analytics/customers?${params}`, {
        cache: 'no-store',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Unable to load customer analytics')
      }

      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load customer analytics')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="mx-auto max-w-7xl py-12">
          <div className="rounded-xl border border-border p-10 text-center">
            <p className="text-muted-foreground">Loading customer analytics…</p>
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
                  onClick={fetchCustomerAnalytics}
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
      </AdminLayout>
    )
  }

  const {
    totalCustomers,
    paidCustomers,
    repeatCustomers,
    guestCustomers,
    registeredCustomers,
    totalCustomerSpent,
    customerLTV,
    avgOrderCount,
    customers,
  } = data

  const avgOrderValue =
    customers.length > 0
      ? customers.reduce((sum, c) => sum + c.averageOrderValue, 0) /
        customers.length
      : 0

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
              className="text-sm text-muted-foreground hover:underline"
            >
              ← Back to Dashboard
            </Link>
            <h1 className="mt-3 text-3xl font-bold text-primary">
              Customer Intelligence
            </h1>
            <p className="mt-2 text-muted-foreground">
              Understand your customers, their behavior, and lifetime value.
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
            label="Total Customers"
            value={formatNumber(totalCustomers)}
          />
          <StatCard
            label="Paid Customers"
            value={formatNumber(paidCustomers)}
          />
          <StatCard
            label="Repeat Customers"
            value={formatNumber(repeatCustomers)}
          />
          <StatCard
            label="Guest Customers"
            value={formatNumber(guestCustomers)}
          />
          <StatCard
            label="Registered Customers"
            value={formatNumber(registeredCustomers)}
          />
          <StatCard
            label="Customer LTV"
            value={formatPrice(customerLTV)}
          />
          <StatCard
            label="Avg Order Value"
            value={formatPrice(avgOrderValue)}
          />
          <StatCard
            label="Avg Orders per Customer"
            value={avgOrderCount?.toFixed(1) ?? '0'}
          />
        </section>

        {/* Customer Analytics Charts */}
        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <ChartContainer
            title="Customer Type Distribution"
            subtitle="Guest vs registered customers"
          >
            <DonutChart
              data={[
                { label: 'Registered', value: registeredCustomers ?? 0, color: '#17243A' },
                { label: 'Guest', value: guestCustomers ?? 0, color: '#C6A46A' },
              ]}
            />
          </ChartContainer>

          <ChartContainer
            title="Top Customers by Spending"
            subtitle="Customer lifetime value ranking"
          >
            {customers.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center">
                <p className="text-sm text-secondary-text">No customer data available.</p>
              </div>
            ) : (
              <BarChart
                data={customers
                  .slice(0, 8)
                  .map((c) => ({ label: c.name, value: c.totalSpent }))}
                color="#17243A"
                showLabels
              />
            )}
          </ChartContainer>
        </section>

        {/* Customer Table */}
        <section className="mt-8 rounded-xl border border-border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-primary">
              Customer Details
            </h2>
            <p className="text-sm text-muted-foreground">
              Customer insights based on verified order data.
            </p>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-3 text-sm font-medium text-muted-foreground text-left">
                    Customer
                  </th>
                  <th className="py-3 text-sm font-medium text-muted-foreground text-left">
                    Phone
                  </th>
                  <th className="py-3 text-sm font-medium text-muted-foreground text-left">
                    Email
                  </th>
                  <th className="py-3 text-sm font-medium text-muted-foreground text-right">
                    Orders
                  </th>
                  <th className="py-3 text-sm font-medium text-muted-foreground text-right">
                    Total Spent
                  </th>
                  <th className="py-3 text-sm font-medium text-muted-foreground text-right">
                    Avg Order Value
                  </th>
                  <th className="py-3 text-sm font-medium text-muted-foreground text-right">
                    Type
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {customers.map((c) => (
                  <tr key={c.phone} className="hover:bg-muted/30">
                    <td className="py-3 text-sm font-medium">{c.name}</td>
                    <td className="py-3 text-sm">{c.phone}</td>
                    <td className="py-3 text-sm">{c.email ?? 'N/A'}</td>
                    <td className="py-3 text-sm text-right">{formatNumber(c.orderCount)}</td>
                    <td className="py-3 text-sm text-right font-medium">
                      {formatPrice(c.totalSpent)}
                    </td>
                    <td className="py-3 text-sm text-right font-medium">
                      {formatPrice(c.averageOrderValue)}
                    </td>
                    <td className="py-3 text-sm">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                          c.isGuest
                            ? 'bg-muted text-muted-foreground border-border'
                            : 'bg-primary text-primary-foreground border-primary'
                        }`}
                      >
                        {c.isGuest ? 'Guest' : 'Registered'}
                      </span>
                    </td>
                  </tr>
                ))}
                {customers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      No customer data available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AdminLayout>
  )
}
