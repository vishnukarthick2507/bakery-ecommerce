'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { CustomerOrder, customerAuthHeaders, formatOrderStatus } from '@/lib/customer-auth'

export default function CustomerOrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<CustomerOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!window.localStorage.getItem('customer-token')) {
      router.replace('/account/login')
      return
    }
    fetch('/api/orders/me', { headers: customerAuthHeaders(), cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.message || 'Unable to load orders.')
        setOrders(data.orders)
      })
      .catch((requestError: unknown) => setError(requestError instanceof Error ? requestError.message : 'Unable to load orders.'))
      .finally(() => setLoading(false))
  }, [router])

  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/account" className="text-sm text-muted-foreground hover:underline">
            ← My account
          </Link>
          <h1 className="mt-3 text-3xl font-semibold text-primary">My orders</h1>
        </div>
      </div>

      {loading && (
        <p className="mt-6 text-muted-foreground">Loading your orders…</p>
      )}
      {error && (
        <p role="alert" className="mt-6 text-sm text-destructive">{error}</p>
      )}
      {!loading && !error && orders.length === 0 && (
        <section className="mt-6 rounded-xl border border-border p-8 text-center shadow-sm">
          <p className="font-medium">No orders yet</p>
          <Link href="/products" className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-primary-foreground">
            Browse products
          </Link>
        </section>
      )}
      {!loading && !error && orders.length > 0 && (
        <div className="mt-6 divide-y divide-border rounded-xl border border-border bg-white shadow-sm">
          {orders.map((order) => (
            <Link
              key={order._id}
              href={`/account/orders/${encodeURIComponent(order.orderNumber)}`}
              className="block p-5 sm:p-6 hover:bg-muted/40 transition-colors"
            >
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <p className="font-semibold text-primary">{order.orderNumber}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {new Date(order.createdAt).toLocaleString('en-IN')}
                  </p>
                </div>
                <p className="font-semibold">
                  ₹{order.totalAmount.toLocaleString('en-IN')}
                </p>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {order.items.map((item) => `${item.productName} × ${item.quantity}`).join(', ')}
              </p>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                <span>Payment: {order.paymentStatus}</span>
                <span>Order: {formatOrderStatus(order.orderStatus)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
