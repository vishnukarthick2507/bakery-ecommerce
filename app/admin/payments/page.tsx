'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { withAdminAuth } from '@/components/admin/admin-auth'

type PaymentOrder = {
  orderNumber: string
  totalAmount: number
  paymentMethod: 'COD' | 'ONLINE'
  paymentStatus: 'PENDING' | 'PAID' | 'FAILED'
  razorpayOrderId?: string
  razorpayPaymentId?: string
  createdAt: string
}

function AdminPaymentsPage() {
  const [orders, setOrders] = useState<PaymentOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const fetchPayments = async () => {
      try {
        const response = await fetch('/api/orders', {
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('admin-token')}`,
          },
        })
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.message || 'Unable to fetch payment records')
        }
        setOrders(data.orders ?? [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load payment records')
      } finally {
        setLoading(false)
      }
    }

    fetchPayments()
  }, [])

  const normalizedSearch = search.trim().toLowerCase()
  const payments = orders.filter((order) =>
    [order.orderNumber, order.razorpayOrderId ?? '', order.razorpayPaymentId ?? '']
      .some((value) => value.toLowerCase().includes(normalizedSearch)),
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
            <h1 className="text-3xl font-bold">Payments &amp; Transactions</h1>
            <p className="mt-2 text-muted-foreground">
              Payment records attached to real customer orders.
            </p>
          </div>
          <label className="grid gap-1.5 text-sm font-medium sm:w-80">
            Search records
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Order or Razorpay ID"
              className="h-11 rounded-lg border bg-background px-3 font-normal outline-none focus:ring-2"
            />
          </label>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-8 rounded-2xl border bg-background p-10 text-center">
            Loading payment records...
          </div>
        ) : !error && payments.length === 0 ? (
          <div className="mt-8 rounded-2xl border bg-background p-10 text-center">
            <h2 className="text-xl font-semibold">
              {orders.length === 0 ? 'No payment records yet' : 'No matching records'}
            </h2>
            <p className="mt-2 text-muted-foreground">
              {orders.length === 0
                ? 'Payment information will appear here with real orders.'
                : 'Try another order number or payment ID.'}
            </p>
          </div>
        ) : !error ? (
          <div className="mt-8 divide-y rounded-xl border bg-background">
            {payments.map((payment) => (
              <article key={payment.orderNumber} className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-5">
                <div>
                  <h2 className="font-semibold">{payment.orderNumber}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {new Date(payment.createdAt).toLocaleString('en-IN')}
                  </p>
                </div>
                <p className="text-sm">
                  <span className="block text-muted-foreground">Amount</span>
                  <span className="mt-1 block font-semibold">₹{payment.totalAmount.toLocaleString('en-IN')}</span>
                </p>
                <p className="text-sm">
                  <span className="block text-muted-foreground">Method</span>
                  <span className="mt-1 block font-medium">
                    {payment.paymentMethod === 'COD' ? 'Cash on Delivery' : 'Razorpay'}
                  </span>
                </p>
                <p className="text-sm">
                  <span className="block text-muted-foreground">Payment status</span>
                  <span className="mt-1 block font-medium">{payment.paymentStatus}</span>
                </p>
                <div className="min-w-0 text-xs text-muted-foreground">
                  {payment.razorpayOrderId && (
                    <p className="break-all">Order ID: {payment.razorpayOrderId}</p>
                  )}
                  {payment.razorpayPaymentId && (
                    <p className="mt-1 break-all">Payment ID: {payment.razorpayPaymentId}</p>
                  )}
                  {!payment.razorpayOrderId && !payment.razorpayPaymentId && 'No Razorpay IDs'}
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </main>
  )
}

export default withAdminAuth(AdminPaymentsPage)