'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { CustomerOrder, customerAuthHeaders, formatOrderStatus } from '@/lib/customer-auth'

export default function CustomerOrderDetailPage() {
  const params = useParams<{ orderNumber: string }>()
  const router = useRouter()
  const [order, setOrder] = useState<CustomerOrder | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!window.localStorage.getItem('customer-token')) {
      router.replace('/account/login')
      return
    }
    fetch(`/api/orders/me/${encodeURIComponent(params.orderNumber)}`, {
      headers: customerAuthHeaders(),
      cache: 'no-store',
    })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.message || 'Unable to load order.')
        setOrder(data.order)
      })
      .catch((requestError: unknown) => setError(requestError instanceof Error ? requestError.message : 'Unable to load order.'))
      .finally(() => setLoading(false))
  }, [params.orderNumber, router])

  if (loading) return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <div className="rounded-xl border border-border p-10 text-center">
        <p className="text-muted-foreground">Loading order…</p>
      </div>
    </main>
  )
  if (error) return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <div className="rounded-xl border border-border p-10 text-center shadow-sm">
        <p className="text-destructive">{error}</p>
        <Link href="/account/orders" className="mt-4 inline-flex underline text-sm">
          Back to my orders
        </Link>
      </div>
    </main>
  )
  if (!order) return null

  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <Link href="/account/orders" className="text-sm text-muted-foreground hover:underline">
            ← My orders
          </Link>
          <h1 className="mt-3 text-3xl font-semibold text-primary">{order.orderNumber}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date(order.createdAt).toLocaleString('en-IN')}
          </p>
        </div>
        <div className="text-right text-sm">
          <p className="font-semibold">{formatOrderStatus(order.orderStatus)}</p>
          <p className="mt-1 text-muted-foreground">Payment: {order.paymentStatus}</p>
        </div>
      </div>

      <section className="mt-6 rounded-xl border border-border bg-white p-6 sm:p-8 shadow-sm">
        <h2 className="text-xl font-semibold text-primary">Items</h2>
        <div className="mt-4 divide-y divide-border">
          {order.items.map((item) => (
            <div
              key={`${item.productId}-${item.variantId}`}
              className="flex justify-between gap-4 py-4"
            >
              <div>
                <p className="font-medium">{item.productName}</p>
                <p className="text-sm text-muted-foreground">
                  {item.quantity} × ₹{item.unitPrice.toLocaleString('en-IN')}
                </p>
              </div>
              <p className="font-medium">
                ₹{(item.itemTotal ?? item.totalPrice).toLocaleString('en-IN')}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-4 border-t border-border pt-4 text-sm">
          <p className="flex justify-between"><span>Subtotal</span><span>₹{order.subtotal.toLocaleString('en-IN')}</span></p>
          <p className="mt-2 flex justify-between"><span>Delivery fee</span><span>₹{order.deliveryFee.toLocaleString('en-IN')}</span></p>
          <p className="mt-3 flex justify-between text-base font-semibold text-primary"><span>Total</span><span>₹{order.totalAmount.toLocaleString('en-IN')}</span></p>
        </div>
      </section>

      <section className="mt-5 grid gap-5 rounded-xl border border-border bg-white p-6 sm:p-8 shadow-sm sm:grid-cols-2">
        <div>
          <h2 className="font-semibold text-primary">Customer</h2>
          <p className="mt-2 text-sm">{order.customer?.name ?? order.customerName}</p>
          {order.customer?.email && (
            <p className="mt-1 text-sm text-muted-foreground">{order.customer.email}</p>
          )}
          <p className="mt-1 text-sm text-muted-foreground">{order.customer?.phone ?? order.phone}</p>
        </div>
        <div>
          <h2 className="font-semibold text-primary">
            {order.fulfillmentType === 'DELIVERY' ? 'Delivery address' : 'Pickup'}
          </h2>
          <p className="mt-2 text-sm">
            {order.address
              ? `${order.address.addressLine}, ${order.address.city}, ${order.address.pincode}`
              : 'Pick up from S.V. Bakery'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {order.scheduledDate} · {order.scheduledTime}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{order.paymentMethod}</p>
        </div>
      </section>
    </main>
  )
}
