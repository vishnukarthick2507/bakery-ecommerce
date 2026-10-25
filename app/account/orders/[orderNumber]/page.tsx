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
  }, [params.orderNumber, router])

  if (error) return <main className="mx-auto max-w-4xl px-4 py-12"><p role="alert" className="text-destructive">{error}</p><Link href="/account/orders" className="mt-4 inline-flex underline">Back to my orders</Link></main>
  if (!order) return <main className="mx-auto max-w-4xl px-4 py-12">Loading order...</main>

  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <Link href="/account/orders" className="text-sm text-muted-foreground hover:underline">← My orders</Link>
      <div className="mt-3 flex flex-wrap justify-between gap-3">
        <div><h1 className="text-3xl font-semibold">{order.orderNumber}</h1><p className="mt-1 text-sm text-muted-foreground">{new Date(order.createdAt).toLocaleString('en-IN')}</p></div>
        <div className="text-right text-sm"><p>{formatOrderStatus(order.orderStatus)}</p><p className="mt-1 text-muted-foreground">Payment: {order.paymentStatus}</p></div>
      </div>
      <section className="mt-6 rounded-xl border bg-background p-6">
        <h2 className="text-xl font-semibold">Items</h2>
        <div className="mt-4 divide-y">
          {order.items.map((item) => (
            <div key={`${item.productId}-${item.variantId}`} className="flex justify-between gap-4 py-4">
              <div><p className="font-medium">{item.productName}</p><p className="text-sm text-muted-foreground">{item.quantity} × ₹{item.unitPrice.toLocaleString('en-IN')}</p></div>
              <p className="font-medium">₹{(item.itemTotal ?? item.totalPrice).toLocaleString('en-IN')}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 border-t pt-4 text-sm">
          <p className="flex justify-between"><span>Subtotal</span><span>₹{order.subtotal.toLocaleString('en-IN')}</span></p>
          <p className="mt-2 flex justify-between"><span>Delivery fee</span><span>₹{order.deliveryFee.toLocaleString('en-IN')}</span></p>
          <p className="mt-3 flex justify-between text-base font-semibold"><span>Total</span><span>₹{order.totalAmount.toLocaleString('en-IN')}</span></p>
        </div>
      </section>
      <section className="mt-5 grid gap-5 rounded-xl border bg-background p-6 sm:grid-cols-2">
        <div><h2 className="font-semibold">Customer</h2><p className="mt-2 text-sm">{order.customer?.name ?? order.customerName}</p><p className="text-sm text-muted-foreground">{order.customer?.email}</p><p className="text-sm text-muted-foreground">{order.customer?.phone ?? order.phone}</p></div>
        <div><h2 className="font-semibold">{order.fulfillmentType === 'DELIVERY' ? 'Delivery address' : 'Pickup'}</h2><p className="mt-2 text-sm">{order.address ? `${order.address.addressLine}, ${order.address.city}, ${order.address.pincode}` : 'Pick up from THE CAKE POINT'}</p><p className="mt-1 text-sm text-muted-foreground">{order.scheduledDate} · {order.scheduledTime}</p><p className="mt-1 text-sm text-muted-foreground">{order.paymentMethod}</p></div>
      </section>
    </main>
  )
}