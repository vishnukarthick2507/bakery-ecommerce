'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowLeftIcon, ClockIcon, CreditCardIcon, ShoppingBagIcon } from 'lucide-react'
import { CustomerOrder, formatOrderStatus } from '@/lib/customer-auth'

const statusVariant = (status: string) => {
  const base = 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border'
  switch (status) {
    case 'DELIVERED':
      return `${base} bg-green-50 text-green-700 border-green-100`
    case 'CANCELLED':
      return `${base} bg-red-50 text-red-700 border-red-100`
    case 'PREPARING':
    case 'READY':
    case 'READY_FOR_PICKUP':
    case 'OUT_FOR_DELIVERY':
      return `${base} bg-amber-50 text-amber-700 border-amber-100`
    case 'CONFIRMED':
    case 'PAYMENT_CONFIRMED':
      return `${base} bg-blue-50 text-blue-700 border-blue-100`
    default:
      return `${base} bg-muted text-muted-foreground border-border`
  }
}

const paymentVariant = (method: string) => {
  switch (method) {
    case 'ONLINE':
      return 'bg-blue-50 text-blue-700 border-blue-100'
    case 'COD':
      return 'bg-amber-50 text-amber-700 border-amber-100'
    case 'PAY_AT_STORE':
      return 'bg-green-50 text-green-700 border-green-100'
    default:
      return 'bg-muted text-muted-foreground border-border'
  }
}

export default function CustomerOrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<CustomerOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/orders/me', { credentials: 'include', cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json()
        if (response.status === 401 || response.status === 403) {
          router.replace('/account/login')
        }
        if (!response.ok) throw new Error(data.message || 'Unable to load orders.')
        setOrders(data.orders)
      })
      .catch((requestError: unknown) => setError(requestError instanceof Error ? requestError.message : 'Unable to load orders.'))
      .finally(() => setLoading(false))
  }, [router])

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-champagne-gold/15 text-primary">
            <ClockIcon className="size-5" aria-hidden="true" />
          </div>
          <p className="mt-4 text-sm text-foreground">Loading your orders…</p>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <p className="text-sm text-destructive">{error}</p>
          <button
            onClick={() => router.replace('/account')}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl border border-gold-border bg-champagne-gold px-6 py-3 font-semibold text-midnight-navy shadow-sm hover:bg-champagne-gold/90 transition-colors"
          >
            <ArrowLeftIcon className="size-4" aria-hidden="true" />
            Back to account
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/account"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary transition-colors"
          >
            <ArrowLeftIcon className="size-4" aria-hidden="true" />
            My account
          </Link>
          <h1 className="mt-1 font-heading text-3xl font-bold text-primary tracking-tight">
            My orders
          </h1>
        </div>
      </div>

      {!loading && !error && orders.length === 0 && (
        <section className="mt-12 flex flex-col items-center justify-center min-h-[60vh] rounded-xl border border-dashed border-gold-border bg-white p-12 text-center shadow-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-champagne-gold/15 text-primary mb-4">
            <ShoppingBagIcon className="size-6" aria-hidden="true" />
          </div>
          <h2 className="text-xl font-bold text-primary mb-2">No orders yet</h2>
          <p className="text-sm text-foreground mb-8">
            Your order history will appear here once you place your first order.
          </p>
          <Link
            href="/products"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gold-border bg-champagne-gold px-8 py-3.5 font-semibold text-midnight-navy shadow-sm hover:bg-champagne-gold/90 transition-colors"
          >
            Browse products
          </Link>
        </section>
      )}

      {!loading && !error && orders.length > 0 && (
        <div className="mt-12 divide-y divide-gold-border rounded-xl border border-gold-border bg-white shadow-sm">
          {orders.map((order) => (
            <Link
              key={order._id}
              href={`/account/orders/${encodeURIComponent(order.orderNumber)}`}
              className="block p-6 sm:p-8 hover:bg-gold-border/5 transition-colors"
            >
              <div className="flex flex-wrap justify-between gap-4 items-start sm:flex-nowrap">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <div>
                    <p className="font-semibold text-primary">{order.orderNumber}</p>
                    <p className="text-sm text-foreground">
                      {new Date(order.createdAt).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <p className="text-base font-bold text-primary sm:ml-4">
                    ₹{order.totalAmount.toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="flex items-center gap-3 mt-4 sm:mt-0 sm:ml-auto">
                  <span className={statusVariant(order.orderStatus)}>
                    {formatOrderStatus(order.orderStatus)}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${paymentVariant(order.paymentMethod)}`}
                  >
                    <CreditCardIcon className="size-3 shrink-0" aria-hidden="true" />
                    {order.paymentMethod}
                  </span>
                </div>
              </div>
              <p className="mt-4 text-sm text-foreground">
                {order.items.map((item) => `${item.productName} × ${item.quantity}`).join(', ')}
              </p>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
