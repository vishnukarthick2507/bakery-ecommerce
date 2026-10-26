'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { withAdminAuth } from '@/components/admin/admin-auth'

type CustomerOrder = {
  customerName: string
  phone: string
  paymentStatus: string
  createdAt: string
  address?: {
    addressLine: string
    city: string
    pincode: string
  }
  totalAmount: number
}

type Customer = {
  name: string
  phone: string
  orderCount: number
  paidTotal: number
  latestOrder: string
  address?: CustomerOrder['address']
}

function AdminCustomersPage() {
  const [orders, setOrders] = useState<CustomerOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await fetch('/api/orders', {
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('admin-token')}`,
          },
        })

        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.message || 'Unable to fetch customers')
        }

        setOrders(data.orders ?? [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load customers')
      } finally {
        setLoading(false)
      }
    }

    fetchOrders()
  }, [])

  const customerMap = new Map<string, Customer>()
  for (const order of orders) {
    const key = order.phone.trim().replace(/\D/g, '')
    const customer = customerMap.get(key)

    if (!customer) {
      customerMap.set(key, {
        name: order.customerName,
        phone: order.phone,
        orderCount: 1,
        paidTotal: order.paymentStatus === 'PAID' ? order.totalAmount : 0,
        latestOrder: order.createdAt,
        address: order.address,
      })
      continue
    }

    customer.orderCount += 1
    if (order.paymentStatus === 'PAID') {
      customer.paidTotal += order.totalAmount
    }
    if (new Date(order.createdAt) > new Date(customer.latestOrder)) {
      customer.name = order.customerName
      customer.latestOrder = order.createdAt
      customer.address = order.address ?? customer.address
    } else if (!customer.address && order.address) {
      customer.address = order.address
    }
  }

  const normalizedSearch = search.trim().toLowerCase()
  const customers = Array.from(customerMap.values())
    .filter((customer) =>
      `${customer.name} ${customer.phone}`.toLowerCase().includes(normalizedSearch),
    )
    .sort((first, second) =>
      new Date(second.latestOrder).getTime() - new Date(first.latestOrder).getTime(),
    )

  return (
    <main className="min-h-screen bg-muted/20">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-sm font-medium text-primary">S.V. Bakery Admin</p>
        <Link href="/admin" className="mt-2 inline-block text-sm text-muted-foreground hover:underline">
          ← Back to Dashboard
        </Link>
        <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-3xl font-bold text-primary">Customers</h1>
            <p className="mt-2 text-muted-foreground">
              Customers are listed from existing orders. Paid totals include paid orders only.
            </p>
          </div>
          <label className="grid gap-1.5 text-sm font-medium sm:w-80">
            Search customers
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name or phone number"
              className="h-11 rounded-lg border border-border bg-white px-3 font-normal outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-8 rounded-xl border border-border p-10 text-center">
            Loading customers...
          </div>
        ) : !error && customers.length === 0 ? (
          <div className="mt-8 rounded-xl border border-border p-10 text-center shadow-sm">
            <h2 className="text-xl font-semibold text-primary">
              {orders.length === 0 ? 'No customers yet' : 'No matching customers'}
            </h2>
            <p className="mt-2 text-muted-foreground">
              {orders.length === 0
                ? 'Customer details will appear here after real orders are placed.'
                : 'Try a different name or phone number.'}
            </p>
          </div>
        ) : !error ? (
          <div className="mt-8 divide-y divide-border rounded-xl border border-border bg-white shadow-sm">
            {customers.map((customer) => (
              <article key={customer.phone} className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <h2 className="font-semibold text-primary">{customer.name}</h2>
                  <a className="mt-1 text-sm text-muted-foreground hover:underline" href={`tel:${customer.phone}`}>
                    {customer.phone}
                  </a>
                </div>
                <p className="text-sm">
                  <span className="block text-muted-foreground">Orders</span>
                  <span className="mt-1 block font-medium text-primary">{customer.orderCount}</span>
                </p>
                <p className="text-sm">
                  <span className="block text-muted-foreground">Paid total</span>
                  <span className="mt-1 block font-medium text-primary">₹{customer.paidTotal.toLocaleString('en-IN')}</span>
                </p>
                <div className="text-sm">
                  <span className="block text-muted-foreground">Latest order</span>
                  <span className="mt-1 block font-medium text-primary">
                    {new Date(customer.latestOrder).toLocaleDateString('en-IN')}
                  </span>
                  {customer.address && (
                    <span className="mt-1 block text-muted-foreground">
                      {customer.address.addressLine}, {customer.address.city} {customer.address.pincode}
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </main>
  )
}

export default withAdminAuth(AdminCustomersPage)
