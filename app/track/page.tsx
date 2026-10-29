'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeftIcon,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Mail,
  MapPin,
  Package,
  Phone,
  ShoppingBag,
  Truck,
  XIcon,
} from 'lucide-react'
import { customerAuthHeaders, getCustomerToken } from '@/lib/customer-auth'
import { cn } from '@/lib/utils'

type OrderItem = {
  productId: string
  productName: string
  variantId: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

type Order = {
  id: string
  orderNumber: string
  customerName: string
  phone: string
  fulfillmentType: 'DELIVERY' | 'PICKUP'
  address?: {
    addressLine: string
    city: string
    pincode: string
  }
  scheduledDate: string
  scheduledTime: string
  requestedSlot?: string
  confirmedSlot?: string
  paymentMethod: 'COD' | 'ONLINE' | 'PAY_AT_STORE'
  paymentStatus: 'PENDING' | 'PAID' | 'FAILED'
  orderStatus:
    | 'PLACED'
    | 'PAYMENT_CONFIRMED'
    | 'CONFIRMED'
    | 'PREPARING'
    | 'READY'
    | 'READY_FOR_PICKUP'
    | 'OUT_FOR_DELIVERY'
    | 'DELIVERED'
    | 'COLLECTED'
    | 'CANCELLED'
  items: OrderItem[]
  subtotal: number
  deliveryFee: number
  totalAmount: number
  createdAt: string
  updatedAt: string
}

function formatStatus(status: Order['orderStatus']) {
  return status
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatPaymentStatus(status: Order['paymentStatus']) {
  return status
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

/* ---------------------------------------------------------------
   Timeline status definitions
   --------------------------------------------------------------- */

type TimelineStep = {
  key: Order['orderStatus']
  label: string
  icon: React.ElementType
  completedLabel: string
}

const TIMELINE_STEPS: TimelineStep[] = [
  {
    key: 'PLACED',
    label: 'Order Placed',
    icon: ShoppingBag,
    completedLabel: 'Order placed',
  },
  {
    key: 'PAYMENT_CONFIRMED',
    label: 'Payment Confirmed',
    icon: CreditCard,
    completedLabel: 'Payment confirmed',
  },
  {
    key: 'CONFIRMED',
    label: 'Order Confirmed',
    icon: CheckCircle2,
    completedLabel: 'Order confirmed',
  },
  {
    key: 'PREPARING',
    label: 'Being Prepared',
    icon: Clock,
    completedLabel: 'Being prepared',
  },
  {
    key: 'READY_FOR_PICKUP',
    label: 'Ready for Pickup',
    icon: Package,
    completedLabel: 'Ready for pickup',
  },
  {
    key: 'READY',
    label: 'Ready',
    icon: Package,
    completedLabel: 'Ready',
  },
  {
    key: 'OUT_FOR_DELIVERY',
    label: 'Out for Delivery',
    icon: Truck,
    completedLabel: 'Out for delivery',
  },
  {
    key: 'DELIVERED',
    label: 'Delivered',
    icon: CheckCircle2,
    completedLabel: 'Delivered',
  },
  {
    key: 'COLLECTED',
    label: 'Collected',
    icon: CheckCircle2,
    completedLabel: 'Collected',
  },
]

function timelineStepsFor(
  paymentMethod: Order['paymentMethod'],
  paymentStatus: Order['paymentStatus'],
  fulfillmentType: Order['fulfillmentType'],
  orderStatus: Order['orderStatus'],
) {
  const isPickup = fulfillmentType === 'PICKUP'
  const isPayAtStore = paymentMethod === 'PAY_AT_STORE'

  let steps = TIMELINE_STEPS.filter((step) => {
    // Remove delivery-specific steps for pickup orders
    if (isPickup) {
      if (step.key === 'READY' || step.key === 'OUT_FOR_DELIVERY' || step.key === 'DELIVERED') {
        return false
      }
    }
    // Remove pickup-specific steps for delivery orders
    if (!isPickup) {
      if (step.key === 'READY_FOR_PICKUP' || step.key === 'COLLECTED') {
        return false
      }
    }
    // For PAY_AT_STORE with pending payment, hide PAYMENT_CONFIRMED
    if (isPayAtStore && paymentStatus !== 'PAID') {
      if (step.key === 'PAYMENT_CONFIRMED') {
        return false
      }
    }
    // For non-ONLINE, non-PAY_AT_STORE methods, hide PAYMENT_CONFIRMED
    if (paymentMethod !== 'ONLINE' && paymentMethod !== 'PAY_AT_STORE') {
      if (step.key === 'PAYMENT_CONFIRMED') {
        return false
      }
    }
    return true
  })

  return steps
}

function currentStepIndex(
  orderStatus: Order['orderStatus'],
  paymentMethod: Order['paymentMethod'],
  paymentStatus: Order['paymentStatus'],
  fulfillmentType: Order['fulfillmentType'],
): number {
  const steps = timelineStepsFor(
    paymentMethod,
    paymentStatus,
    fulfillmentType,
    orderStatus,
  )
  return steps.findIndex((step) => step.key === orderStatus)
}

export default function TrackPage() {
  return (
    <Suspense fallback={
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="rounded-xl border border-border p-10 text-center">
          <p className="text-muted-foreground">Loading order…</p>
        </div>
      </div>
    }>
      <TrackPageContent />
    </Suspense>
  )
}

function TrackPageContent() {
  const searchParams = useSearchParams()

  const urlOrderNumber = searchParams.get('order') ?? ''

  const [orderNumber, setOrderNumber] = useState(urlOrderNumber)

  const [order, setOrder] = useState<Order | null>(null)

  const [guestPhone, setGuestPhone] = useState('')

  const [isAuthenticated, setIsAuthenticated] = useState(false)

  const [loading, setLoading] = useState(false)

  const [error, setError] = useState('')

  useEffect(() => {
    setIsAuthenticated(Boolean(getCustomerToken()))
  }, [])

  const fetchOrder = async (
    requestedOrderNumber: string,
    phoneOverride?: string,
  ) => {
    const trimmed = requestedOrderNumber.trim()
    const effectivePhone = (
      phoneOverride !== undefined ? phoneOverride : guestPhone
    ).trim()

    if (!trimmed) {
      setError('Please enter your order number.')
      setOrder(null)
      return
    }

    setLoading(true)
    setError('')
    setOrder(null)

    try {
      const token = getCustomerToken()

      let response = token
        ? await fetch(
            `/api/orders/${encodeURIComponent(trimmed)}`,
            {
              cache: 'no-store',
              headers: customerAuthHeaders(),
            },
          )
        : null

      if (!response || response.status === 401) {
        if (!/^[6-9]\d{9}$/.test(effectivePhone)) {
          throw new Error(
            'Enter the 10-digit phone number used at checkout to track a guest order.',
          )
        }

        response = await fetch('/api/orders/track', {
          method: 'POST',
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderNumber: trimmed,
            phone: effectivePhone,
          }),
        })
      }

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.message || 'Order not found.',
        )
      }

      setOrder(data.order)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to fetch order.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (urlOrderNumber) {
      const normalizedOrder = urlOrderNumber.trim().toUpperCase()
      const storedPhone =
        typeof window !== 'undefined'
          ? window.sessionStorage.getItem(`guest-track-phone-${normalizedOrder}`) ||
            window.sessionStorage.getItem('guest-track-phone') ||
            ''
          : ''

      if (storedPhone) {
        setGuestPhone((current) => current || storedPhone)
      }

      fetchOrder(urlOrderNumber, storedPhone || undefined)
    }
  }, [urlOrderNumber])

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmed = orderNumber.trim()
    if (!trimmed) {
      setError('Please enter your order number.')
      setOrder(null)
      return
    }

    if (!isAuthenticated) {
      const effectivePhone = guestPhone.trim()
      if (!/^[6-9]\d{9}$/.test(effectivePhone)) {
        setError(
          'Enter the 10-digit phone number used at checkout to track a guest order.',
        )
        setOrder(null)
        return
      }
    }

    fetchOrder(orderNumber)
  }

  const steps = order
    ? timelineStepsFor(
        order.paymentMethod,
        order.paymentStatus,
        order.fulfillmentType,
        order.orderStatus,
      )
    : []
  const currentIndex = order
    ? currentStepIndex(
        order.orderStatus,
        order.paymentMethod,
        order.paymentStatus,
        order.fulfillmentType,
      )
    : -1

  const isCancelled = order?.orderStatus === 'CANCELLED'

  return (
    <>
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="mb-8">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:underline"
          >
            <ArrowLeftIcon className="size-4 shrink-0" aria-hidden="true" />
            <span>Back to home</span>
          </Link>

          {order ? (
            <>
              <h1 className="mt-3 text-3xl font-semibold text-primary">
                Order Confirmed
              </h1>
              <p className="mt-2 text-muted-foreground">
                Your S.V. Bakery order has been placed successfully.
              </p>
            </>
          ) : (
            <>
              <h1 className="mt-3 text-3xl font-semibold text-primary">
                Track Your Order
              </h1>
              <p className="mt-2 text-muted-foreground">
                Check the latest status of your S.V. Bakery order.
              </p>
            </>
          )}
        </div>

        {/* Order lookup */}
        {!order && (
          <section className="rounded-xl border border-border bg-white p-6 sm:p-8 shadow-sm">
            <h2 className="text-xl font-semibold text-primary mb-1">
              Track Order
            </h2>
            <p className="mt-2 text-muted-foreground">
              Enter your order number to check the latest status.
            </p>

            <form
              onSubmit={handleSubmit}
              className="mt-6 flex flex-col gap-3 sm:flex-row"
            >
              <input
                value={orderNumber}
                onChange={(event) =>
                  setOrderNumber(event.target.value)
                }
                type="text"
                placeholder="e.g. SV-44171646-7698"
                className="flex-1 rounded-lg border border-border bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-primary"
              />

              <input
                value={guestPhone}
                onChange={(event) => setGuestPhone(event.target.value)}
                type="tel"
                inputMode="numeric"
                maxLength={10}
                pattern="[6-9][0-9]{9}"
                required={!isAuthenticated}
                aria-label="Phone number used at checkout"
                placeholder={
                  isAuthenticated
                    ? 'Guest order phone (optional)'
                    : 'Checkout phone number'
                }
                className="flex-1 rounded-lg border border-border bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-primary"
              />

              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60 hover:opacity-90"
              >
                {loading ? 'Loading…' : 'Track Order'}
              </button>
            </form>

            {error && (
              <div className="mt-5 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                {error}
              </div>
            )}
          </section>
        )}

        {/* Order confirmed & tracking */}
        {order && (
          <section className="mt-8 space-y-8">
            {/* Order header */}
            <div className="rounded-xl border border-border bg-white p-6 sm:p-8 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Order Number
                  </p>
                  <h2 className="mt-1 text-2xl font-bold text-primary">
                    {order.orderNumber}
                  </h2>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm font-medium">
                  <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
                  <span>{formatStatus(order.orderStatus)}</span>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                    Payment
                  </p>
                  <p className="mt-1 font-medium text-foreground">
                    {order.paymentMethod === 'COD'
                      ? 'Cash on Delivery'
                      : 'Online Payment'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatPaymentStatus(order.paymentStatus)}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                    Fulfilment
                  </p>
                  <p className="mt-1 font-medium text-foreground">
                    {order.fulfillmentType === 'DELIVERY'
                      ? 'Delivery'
                      : 'Pickup'}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                    Total
                  </p>
                  <p className="mt-1 font-bold text-primary">
                    ₹{order.totalAmount.toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
            </div>

            {isCancelled ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 sm:p-8 shadow-sm">
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10">
                    <XIcon className="size-8 text-destructive" aria-hidden="true" />
                  </div>
                  <h2 className="text-xl font-bold text-primary">Order Cancelled</h2>
                  <p className="text-muted-foreground text-center">
                    This order has been cancelled. If you have any questions,
                    please contact us on WhatsApp.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-border bg-white p-6 sm:p-8 shadow-sm">
                  <h2 className="text-xl font-semibold text-primary mb-1">
                    Order Status
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground mb-6">
                    Here&apos;s where your order stands.
                  </p>

                  {/* Vertical timeline */}
                  <div className="relative">
                    {/* Connector line - short, centered between nodes */}
                    {steps.length > 1 && (
                      <div
                        className="absolute left-[20px] top-[44px] bottom-4 w-[1px] bg-primary/20"
                        aria-hidden="true"
                      />
                    )}

                    {steps.map((step, index) => {
                      const isCompleted = index < currentIndex
                      const isCurrent = index === currentIndex

                      return (
                        <div
                          key={step.key}
                          className="relative mb-8 pl-16"
                          style={
                            isCurrent ? { zIndex: 10 } : undefined
                          }
                        >
                          {/* Connector from previous step */}
                          {index > 0 && (
                            <div
                              className="absolute left-[20px] top-[44px] -mt-px w-[1px] h-[12px]"
                              aria-hidden="true"
                              style={{
                                backgroundColor:
                                  index - 1 < currentIndex
                                    ? '#0B2744'
                                    : '#D9E4EE',
                              }}
                            />
                          )}

                          {/* Status node circle */}
                          <div
                            className={cn(
                              'absolute left-[16px] top-0 z-20 flex size-9 shrink-0 items-center justify-center rounded-full border-2',
                              isCompleted
                                ? 'bg-primary border-primary text-primary-foreground'
                                : isCurrent
                                  ? 'bg-primary border-primary text-primary-foreground shadow-[0_0_0_4px_rgba(11,39,68,0.2)]'
                                  : 'bg-white border-primary text-primary',
                            )}
                          >
                            {isCompleted ? (
                              <CheckCircle2
                                className="size-4"
                                aria-hidden="true"
                              />
                            ) : isCurrent ? (
                              <span className="text-xs font-bold">
                                {index + 1}
                              </span>
                            ) : (
                              <span className="text-xs font-bold">
                                {index + 1}
                              </span>
                            )}
                          </div>

                          {/* Status content */}
                          <div className="flex flex-col gap-1 pt-1">
                            <span
                              className={cn(
                                'text-sm font-semibold',
                                isCompleted || isCurrent
                                  ? 'text-primary'
                                  : 'text-muted-foreground',
                              )}
                            >
                              {step.label}
                            </span>
                            <span
                              className={cn(
                                'text-xs',
                                isCompleted || isCurrent
                                  ? 'text-success'
                                  : 'text-muted-foreground',
                              )}
                            >
                              {isCompleted ? step.completedLabel : step.label}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Order items */}
                <div className="rounded-xl border border-border bg-white p-6 sm:p-8 shadow-sm">
                  <h2 className="text-xl font-semibold text-primary mb-1">
                    Your Items
                  </h2>

                  <div className="mt-5 divide-y divide-border">
                    {order.items.map((item) => (
                      <div
                        key={`${item.productId}-${item.variantId}`}
                        className="flex items-center justify-between gap-4 py-4"
                      >
                        <div>
                          <p className="font-medium text-foreground">
                            {item.productName}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {item.quantity} × ₹
                            {item.unitPrice.toLocaleString('en-IN')}
                          </p>
                        </div>
                        <p className="font-semibold text-primary">
                          ₹
                          {item.totalPrice.toLocaleString('en-IN')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Delivery / pickup & schedule */}
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="rounded-xl border border-border bg-white p-6 sm:p-8 shadow-sm">
                    <h2 className="text-xl font-semibold text-primary mb-1">
                      {order.fulfillmentType === 'DELIVERY'
                        ? 'Delivery Details'
                        : 'Pickup Details'}
                    </h2>

                    <div className="mt-4 space-y-3 text-sm">
                      <div className="flex items-start gap-3">
                        <Mail className="size-4 mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <div>
                          <p className="font-medium text-foreground">
                            {order.customerName}
                          </p>
                          <p className="text-muted-foreground">
                            {order.phone}
                          </p>
                        </div>
                      </div>

                      {order.fulfillmentType === 'DELIVERY' && order.address && (
                        <div className="flex items-start gap-3 mt-3">
                          <MapPin className="size-4 mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                          <p className="text-muted-foreground">
                            {order.address.addressLine},{' '}
                            {order.address.city},{' '}
                            {order.address.pincode}
                          </p>
                        </div>
                      )}

                      {order.fulfillmentType === 'PICKUP' && (
                        <>
                          <div className="flex items-start gap-3 mt-3">
                            <MapPin className="size-4 mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                            <div>
                              <p className="font-medium text-foreground">Pickup Location</p>
                              <p className="text-sm text-muted-foreground">
                                S.V. Sweets &amp; Bakers
                              </p>
                              <p className="text-xs text-muted-foreground">
                                X42V+XP4, Radha Nagar, Lakshmi Nagar,
                                Chromepet, Tambaram, Chennai 600044
                              </p>
                            </div>
                          </div>
                          <div className="mt-3 rounded-lg border border-border bg-muted/50 p-3">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                              Pickup Instructions
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Please present your order number at the counter.
                              Pay at the store if you selected Pay at Store.
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-white p-6 sm:p-8 shadow-sm">
                    <h2 className="text-xl font-semibold text-primary mb-1">
                      Schedule
                    </h2>

                    <div className="mt-4 space-y-3 text-sm">
                      <div className="flex items-start gap-3">
                        <Calendar className="size-4 mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <p className="text-muted-foreground">
                          <span className="font-medium">Date:</span>{' '}
                          {order.scheduledDate}
                        </p>
                      </div>

                      <div className="flex items-start gap-3">
                        <Clock className="size-4 mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <p className="text-muted-foreground">
                          <span className="font-medium">Time:</span>{' '}
                          {order.scheduledTime}
                        </p>
                      </div>

                      <div className="flex items-start gap-3">
                        <CreditCard className="size-4 mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <p className="text-muted-foreground">
                          <span className="font-medium">Payment:</span>{' '}
                          {order.paymentMethod === 'COD'
                            ? 'Cash on Delivery'
                            : order.paymentMethod === 'PAY_AT_STORE'
                              ? 'Pay at Store'
                              : 'Online Payment'}
                        </p>
                      </div>

                      <div className="flex items-start gap-3">
                        <Mail className="size-4 mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <p className="text-muted-foreground">
                          <span className="font-medium">Payment Status:</span>{' '}
                          {formatPaymentStatus(order.paymentStatus)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Payment summary */}
                <div className="rounded-xl border border-border bg-white p-6 sm:p-8 shadow-sm">
                  <h2 className="text-xl font-semibold text-primary mb-1">
                    Payment Summary
                  </h2>

                  <div className="mt-5 space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>₹{order.subtotal.toLocaleString('en-IN')}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Delivery Fee</span>
                      <span>₹{order.deliveryFee.toLocaleString('en-IN')}</span>
                    </div>

                    <div className="my-3 border-t border-border" />

                    <div className="flex justify-between text-xl font-bold text-primary">
                      <span>Total</span>
                      <span>₹{order.totalAmount.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <Link
                    href="/track"
                    className="flex-1 flex items-center justify-center rounded-lg border border-border px-6 py-3 font-medium hover:bg-muted"
                  >
                    Track Another Order
                  </Link>
                  <Link
                    href="/products"
                    className="flex-1 flex items-center justify-center rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground hover:opacity-90"
                  >
                    Continue Shopping
                  </Link>
                </div>
              </>
            )}
          </section>
        )}
      </main>
    </>
  )
}
