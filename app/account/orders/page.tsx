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
    <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/account" className="text-sm text-muted-foreground hover:underline">
            ← My account
          </Link>
          <h1 className="mt-3 text-3xl font-semibold text-primary tracking-tight">My orders</h1>
        </div>
      </div>

      {loading && (
        <p className="mt-10 text-muted-foreground text-center">Loading your orders…</p>
      )}
      {error && (
        <p role="alert" className="mt-10 text-sm text-destructive text-center">{error}</p>
      )}
      {!loading && !error && orders.length === 0 && (
        <section className="mt-10 rounded-[2rem] border border-border bg-card p-12 text-center shadow-sm">
          <p className="font-medium text-foreground">No orders yet</p>
          <Link
            href="/products"
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-caramel px-6 py-3.5 font-medium text-caramel-foreground shadow-sm hover:bg-caramel/90 transition-colors"
          >
            Browse products
          </Link>
        </section>
      )}
      {!loading && !error && orders.length > 0 && (
        <div className="mt-10 divide-y divide-border rounded-[2rem] border border-border bg-card shadow-sm">
          {orders.map((order) => (
            <Link
              key={order._id}
              href={`/account/orders/${encodeURIComponent(order.orderNumber)}`}
              className="block p-7 sm:p-8 hover:bg-cream/50 transition-colors"
            >
              <div className="flex flex-wrap justify-between gap-3 items-start">
                <div>
                  <p className="font-semibold text-primary">{order.orderNumber}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {new Date(order.createdAt).toLocaleString('en-IN')}
                  </p>
                </div>
                <p className="font-semibold text-primary">
                  ₹{order.totalAmount.toLocaleString('en-IN')}
                </p>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {order.items.map((item) => `${item.productName} × ${item.quantity}`).join(', ')}
              </p>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
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
