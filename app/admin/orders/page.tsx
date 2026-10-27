'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { withAdminAuth } from '@/components/admin/admin-auth'
import AdminNav from '@/components/admin/admin-nav'

type OrderStatus =
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
  | 'RESCHEDULE_PROPOSED'

type FulfillmentFilter = 'ALL' | 'DELIVERY' | 'PICKUP'

type OrderItem = {
  productName: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

type Order = {
  _id: string
  orderNumber: string
  customerName: string
  phone: string
  fulfillmentType: 'DELIVERY' | 'PICKUP'
  scheduledDate: string
  scheduledTime: string
  requestedSlot?: string
  confirmedSlot?: string
  proposedSlot?: {
    time: string
    note: string
    status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED'
    expiresAt?: string
  }
  paymentMethod: 'COD' | 'ONLINE' | 'PAY_AT_STORE'
  paymentStatus: 'PENDING' | 'PAID' | 'FAILED'
  paidAt?: string
  paidBy?: string
  inventoryStatus?: 'RESERVED' | 'COMMITTED' | 'RELEASED'
  reconciliationStatus?: 'NONE' | 'REVIEW_REQUIRED'
  reconciliationReason?: string
  razorpayOrderId?: string
  razorpayOrderIds?: string[]
  razorpayPaymentId?: string
  razorpayPaymentIds?: string[]
  orderStatus: OrderStatus
  items: OrderItem[]
  subtotal: number
  deliveryFee: number
  totalAmount: number
  createdAt: string
}

// Controlled progression — mirrors the transition
// rules enforced by the backend. Fulfilment-type aware.
const nextStatusAction: Partial<
  Record<
    OrderStatus,
    { status: OrderStatus; label: string }
  >
> = {
  PLACED: {
    status: 'CONFIRMED',
    label: 'Confirm Order',
  },
  PAYMENT_CONFIRMED: {
    status: 'CONFIRMED',
    label: 'Confirm Order',
  },
  CONFIRMED: {
    status: 'PREPARING',
    label: 'Start Preparing',
  },
  PREPARING: {
    status: 'READY_FOR_PICKUP',
    label: 'Mark Ready for Pickup',
  },
  READY_FOR_PICKUP: {
    status: 'COLLECTED',
    label: 'Mark Collected',
  },
  READY: {
    status: 'OUT_FOR_DELIVERY',
    label: 'Out for Delivery',
  },
  OUT_FOR_DELIVERY: {
    status: 'DELIVERED',
    label: 'Mark Delivered',
  },
}

const cancellableStatuses: OrderStatus[] = [
  'PLACED',
  'PAYMENT_CONFIRMED',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'READY_FOR_PICKUP',
]

function formatStatus(status: OrderStatus) {
  return status
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | OrderStatus>('ALL')
  const [fulfillmentFilter, setFulfillmentFilter] = useState<FulfillmentFilter>('ALL')
  const [proposingOrder, setProposingOrder] = useState<string | null>(null)
  const [proposeDate, setProposeDate] = useState('')
  const [proposeTime, setProposeTime] = useState('')
  const [proposeNote, setProposeNote] = useState('')
  const [proposing, setProposing] = useState(false)

  async function fetchOrders() {
    try {
      setLoading(true)
      setError('')

      const response = await fetch('/api/orders', {
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('admin-token')}`,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Unable to fetch orders')
      }

      setOrders(data.orders ?? [])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load orders',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
  }, [])

  const filteredOrders = orders.filter((order) => {
    const normalizedSearch = search.trim().toLowerCase()
    const matchesSearch =
      !normalizedSearch ||
      [order.orderNumber, order.customerName, order.phone]
        .some((value) => value.toLowerCase().includes(normalizedSearch))

    return (
      matchesSearch &&
      (statusFilter === 'ALL' || order.orderStatus === statusFilter) &&
      (fulfillmentFilter === 'ALL' || order.fulfillmentType === fulfillmentFilter)
    )
  })

  async function updateStatus(
    orderNumber: string,
    status: OrderStatus,
  ) {
    try {
      setUpdatingOrder(orderNumber)
      setError('')

      const response = await fetch(
        `/api/orders/${encodeURIComponent(orderNumber)}/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('admin-token')}`,
          },
          body: JSON.stringify({ status }),
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.message || 'Unable to update order status',
        )
      }

      setOrders((currentOrders) =>
        currentOrders.map((order) =>
          order.orderNumber === orderNumber
            ? {
                ...order,
                orderStatus: data.order.orderStatus,
                inventoryStatus: data.order.inventoryStatus,
                reconciliationStatus: data.order.reconciliationStatus,
                reconciliationReason: data.order.reconciliationReason,
              }
            : order,
        ),
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update order',
      )
    } finally {
      setUpdatingOrder(null)
    }
  }

  async function proposeSlot(
    orderNumber: string,
    date: string,
    time: string,
    note: string,
  ) {
    setProposing(true)
    setError('')

    try {
      // Find the order's internal ID from the orders list
      const order = orders.find((o) => o.orderNumber === orderNumber)
      if (!order) {
        setError('Order not found')
        return
      }

      const dateTime = new Date(`${date}T${time}:00`)

      const response = await fetch(
        `/api/admin/orders/${encodeURIComponent(order._id)}/propose-slot`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('admin-token')}`,
          },
          body: JSON.stringify({
            time: dateTime.toISOString(),
            note: note.trim(),
          }),
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Unable to propose slot')
      }

      // Refresh orders to reflect the proposal
      void fetchOrders()

      // Close the form
      setProposingOrder(null)
      setProposeDate('')
      setProposeTime('')
      setProposeNote('')
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to propose slot',
      )
    } finally {
      setProposing(false)
    }
  }

  return (
    <main className="min-h-screen bg-muted/20">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-medium text-primary">
              S.V. Bakery Admin
            </p>

            <Link
              href="/admin"
              className="text-sm text-muted-foreground hover:underline"
            >
              ← Back to Dashboard
            </Link>

            <h1 className="mt-3 text-3xl font-bold text-primary">
              Orders
            </h1>

            <p className="mt-2 text-muted-foreground">
              View and manage customer orders.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchOrders}
            disabled={loading}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
          >
            {loading ? 'Refreshing...' : 'Refresh Orders'}
          </button>
          <Link
            href="/"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            View Store
          </Link>
        </div>

        <AdminNav className="mt-6" />

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <label className="grid gap-1.5 text-sm font-medium">
            Search orders
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Order number, customer or phone"
              className="h-11 rounded-lg border border-border bg-white px-3 font-normal outline-none focus:ring-2 focus:ring-primary"
            />
          </label>

          <label className="grid gap-1.5 text-sm font-medium">
            Status
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'ALL' | OrderStatus)}
              className="h-11 rounded-lg border border-border bg-white px-3 font-normal outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="ALL">All statuses</option>
              {([
                'PLACED',
                'PAYMENT_CONFIRMED',
                'CONFIRMED',
                'PREPARING',
                'READY',
                'READY_FOR_PICKUP',
                'OUT_FOR_DELIVERY',
                'DELIVERED',
                'COLLECTED',
                'CANCELLED',
              ] as OrderStatus[]).map((status) => (
                <option key={status} value={status}>
                  {formatStatus(status)}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5 text-sm font-medium">
            Fulfillment
            <select
              value={fulfillmentFilter}
              onChange={(event) => setFulfillmentFilter(event.target.value as FulfillmentFilter)}
              className="h-11 rounded-lg border border-border bg-white px-3 font-normal outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="ALL">Delivery and pickup</option>
              <option value="DELIVERY">Delivery</option>
              <option value="PICKUP">Pickup</option>
            </select>
          </label>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading && (
          <div className="mt-8 rounded-xl border border-border p-10 text-center">
            Loading orders...
          </div>
        )}

        {!loading && !error && orders.length === 0 && (
          <div className="mt-8 rounded-xl border border-border p-10 text-center shadow-sm">
            <h2 className="text-xl font-semibold text-primary">
              No orders yet
            </h2>

            <p className="mt-2 text-muted-foreground">
              Customer orders will appear here.
            </p>
          </div>
        )}

        {!loading && !error && orders.length > 0 && filteredOrders.length === 0 && (
          <div className="mt-8 rounded-xl border border-border p-10 text-center shadow-sm">
            <h2 className="text-xl font-semibold text-primary">No matching orders</h2>
            <p className="mt-2 text-muted-foreground">
              Change or clear the search and filters to see other orders.
            </p>
          </div>
        )}

        {!loading && !error && filteredOrders.length > 0 && (
          <div className="mt-8 space-y-6">
            {filteredOrders.map((order) => (
              <section
                key={order._id}
                className="rounded-xl border border-border bg-white p-6 shadow-sm sm:p-8"
              >
                {/* Order header */}
                <div className="flex flex-col justify-between gap-4 border-b border-border pb-6 sm:flex-row">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Order Number
                    </p>

                    <h2 className="mt-1 text-2xl font-bold text-primary">
                      {order.orderNumber}
                    </h2>

                    <p className="mt-2 text-sm text-muted-foreground">
                      Placed{' '}
                      {new Date(order.createdAt).toLocaleString('en-IN')}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground">
                      Total
                    </p>

                    <p className="text-2xl font-bold text-primary">
                      ₹{order.totalAmount.toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>

                {/* Customer details */}
                <div className="grid gap-6 border-b border-border py-6 md:grid-cols-4">

                  <div>
                    <p className="text-sm text-muted-foreground">
                      Customer
                    </p>

                    <p className="mt-1 font-semibold text-primary">
                      {order.customerName}
                    </p>

                    <p className="mt-1 text-sm">
                      {order.phone}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground">
                      Fulfillment
                    </p>

                    <p className="mt-1 font-semibold text-primary">
                      {order.fulfillmentType === 'DELIVERY'
                        ? 'Delivery'
                        : 'Pickup'}
                    </p>

                    <p className="mt-1 text-sm text-muted-foreground">
                      {order.scheduledDate} · {order.scheduledTime}
                    </p>

                    {order.requestedSlot && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Requested: {new Date(order.requestedSlot).toLocaleString('en-IN')}
                      </p>
                    )}
                    {order.confirmedSlot && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Confirmed: {new Date(order.confirmedSlot).toLocaleString('en-IN')}
                      </p>
                    )}
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground">
                      Payment
                    </p>

                    <p className="mt-1 font-semibold text-primary">
                      {order.paymentMethod === 'COD'
                        ? 'Cash on Delivery'
                        : order.paymentMethod === 'ONLINE'
                          ? 'Online (Razorpay)'
                          : 'Pay at Store'}
                    </p>

                    <p className="mt-1 text-sm text-muted-foreground">
                      {order.paymentStatus}
                    </p>

                    {order.paymentMethod === 'PAY_AT_STORE' && order.paidAt && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Paid at: {new Date(order.paidAt).toLocaleString('en-IN')}
                      </p>
                    )}

                    {order.razorpayOrderId && (
                      <p className="mt-1 text-xs text-muted-foreground break-all">
                        RZP Order: {order.razorpayOrderId}
                      </p>
                    )}

                    {order.razorpayPaymentId && (
                      <p className="mt-1 text-xs text-muted-foreground break-all">
                        RZP Payment: {order.razorpayPaymentId}
                      </p>
                    )}

                    {order.razorpayPaymentIds && order.razorpayPaymentIds.length > 1 && (
                      <p className="mt-1 text-xs text-destructive break-all">
                        Captured payment attempts: {order.razorpayPaymentIds.join(', ')}
                      </p>
                    )}

                    {order.proposedSlot && (
                      <div className="mt-3 rounded-lg border border-border bg-muted/50 p-3">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                          Reschedule Proposal
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Status: {order.proposedSlot.status.charAt(0).toUpperCase() + order.proposedSlot.status.slice(1).toLowerCase()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Proposed: {new Date(order.proposedSlot.time).toLocaleString('en-IN')}
                        </p>
                        {order.proposedSlot.note && (
                          <p className="text-xs text-muted-foreground">
                            Note: {order.proposedSlot.note}
                          </p>
                        )}
                        {order.proposedSlot.expiresAt && (
                          <p className="text-xs text-muted-foreground">
                            Expires: {new Date(order.proposedSlot.expiresAt).toLocaleString('en-IN')}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground">
                      Inventory
                    </p>

                    <p className="mt-1 font-semibold text-primary">
                      {order.inventoryStatus
                        ? order.inventoryStatus.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())
                        : 'Not tracked (legacy order)'}
                    </p>
                    {order.reconciliationStatus === 'REVIEW_REQUIRED' && (
                      <p role="status" className="mt-2 text-sm font-medium text-destructive">
                        Manual review required{order.reconciliationReason ? `: ${order.reconciliationReason}` : ''}
                      </p>
                    )}
                  </div>

                </div>

                {/* Items */}
                <div className="border-b border-border py-6">
                  <h3 className="font-semibold text-primary">
                    Items
                  </h3>

                  <div className="mt-4 divide-y divide-border">
                    {order.items.map((item, index) => (
                      <div
                        key={`${order._id}-${index}`}
                        className="flex items-center justify-between gap-4 py-3"
                      >
                        <div>
                          <p className="font-medium text-primary">
                            {item.productName}
                          </p>

                          <p className="text-sm text-muted-foreground">
                            {item.quantity} × ₹
                            {item.unitPrice.toLocaleString('en-IN')}
                          </p>
                        </div>

                        <p className="font-semibold text-primary">
                          ₹{item.totalPrice.toLocaleString('en-IN')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Status */}
                <div className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-end sm:justify-between">

                  <div>
                    <p className="text-sm text-muted-foreground">
                      Current Status
                    </p>

                    <p className="mt-1 text-xl font-bold text-primary">
                      {formatStatus(order.orderStatus)}
                    </p>
                  </div>

                  <div className="w-full sm:w-72">
                    {(() => {
                      // Determine the next action based on fulfilment type.
                      let action =
                        nextStatusAction[order.orderStatus]

                      if (order.orderStatus === 'PREPARING') {
                        action =
                          order.fulfillmentType === 'PICKUP'
                            ? {
                                status: 'READY_FOR_PICKUP' as OrderStatus,
                                label: 'Mark Ready for Pickup',
                              }
                            : {
                                status: 'READY' as OrderStatus,
                                label: 'Mark Ready',
                              }
                      }

                      const canCancel =
                        cancellableStatuses.includes(
                          order.orderStatus,
                        )

                      const isUpdating =
                        updatingOrder === order.orderNumber

                      const canMarkPaid =
                        order.paymentMethod === 'PAY_AT_STORE' &&
                        order.paymentStatus === 'PENDING'

                      if (!action && !canCancel && !canMarkPaid) {
                        return (
                          <p className="text-sm text-muted-foreground">
                            No further actions available.
                          </p>
                        )
                      }

                      return (
                        <div className="flex flex-col gap-2">
                          {action && (
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() =>
                                updateStatus(
                                  order.orderNumber,
                                  action.status,
                                )
                              }
                              className="w-full rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
                            >
                              {action.label}
                            </button>
                          )}

                          {canMarkPaid && (
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Mark order ${order.orderNumber} as paid? Payment will be collected at the store.`,
                                  )
                                ) {
                                  void fetch(
                                    `/api/orders/${encodeURIComponent(order.orderNumber)}/mark-paid`,
                                    {
                                      method: 'POST',
                                      headers: {
                                        'Content-Type': 'application/json',
                                        Authorization: `Bearer ${localStorage.getItem('admin-token')}`,
                                      },
                                    },
                                  )
                                    .then(async (res) => {
                                      if (!res.ok) {
                                        const data = await res.json()
                                        throw new Error(
                                          data.message || 'Unable to mark order as paid',
                                        )
                                      }
                                      return res.json()
                                    })
                                    .then((data) => {
                                      setOrders((currentOrders) =>
                                        currentOrders.map((o) =>
                                          o.orderNumber === order.orderNumber
                                            ? {
                                                ...o,
                                                paymentStatus: 'PAID',
                                                paidAt: data.order?.paidAt,
                                                paidBy: data.order?.paidBy,
                                              }
                                            : o,
                                        ),
                                      )
                                    })
                                    .catch((err) => {
                                      setError(
                                        err instanceof Error
                                          ? err.message
                                          : 'Unable to mark order as paid',
                                      )
                                    })
                                }
                              }}
                              className="w-full rounded-lg border border-primary px-4 py-2.5 font-medium text-primary hover:bg-primary/5 disabled:opacity-60"
                            >
                              Mark Paid
                            </button>
                          )}

                          {/* Suggest another time */}
                          {proposingOrder === order._id ? (
                            <div className="flex flex-col gap-2">
                              <label className="text-xs font-medium text-muted-foreground">
                                New date & time
                              </label>
                              <div className="grid gap-2 sm:grid-cols-2">
                                <input
                                  type="date"
                                  value={proposeDate}
                                  onChange={(e) => setProposeDate(e.target.value)}
                                  className="text-xs rounded-lg border border-border px-2 py-2"
                                />
                                <input
                                  type="time"
                                  value={proposeTime}
                                  onChange={(e) => setProposeTime(e.target.value)}
                                  className="text-xs rounded-lg border border-border px-2 py-2"
                                />
                              </div>
                              <label className="text-xs font-medium text-muted-foreground">
                                Note (optional)
                              </label>
                              <textarea
                                value={proposeNote}
                                onChange={(e) => setProposeNote(e.target.value)}
                                rows={2}
                                className="text-xs rounded-lg border border-border px-2 py-2"
                                placeholder="e.g. Requested slot unavailable"
                              />
                              <button
                                type="button"
                                disabled={proposing || !proposeDate || !proposeTime}
                                onClick={() =>
                                  proposeSlot(
                                    order.orderNumber,
                                    proposeDate,
                                    proposeTime,
                                    proposeNote,
                                  )
                                }
                                className="w-full rounded-lg bg-primary px-2 py-2 text-xs text-primary-foreground disabled:opacity-60"
                              >
                                {proposing ? 'Proposing…' : 'Suggest Time'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setProposingOrder(null)
                                  setProposeDate('')
                                  setProposeTime('')
                                  setProposeNote('')
                                }}
                                className="w-full rounded-lg border border-border px-2 py-2 text-xs text-muted-foreground hover:bg-muted"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() => {
                                setProposingOrder(order._id)
                                setProposeDate('')
                                setProposeTime('')
                                setProposeNote('')
                              }}
                              className="w-full rounded-lg border border-primary px-2 py-2 text-xs text-primary hover:bg-primary/5 disabled:opacity-60"
                            >
                              Suggest Another Time
                            </button>
                          )}

                          {/* WhatsApp click-to-chat */}
                          {order.phone && (
                            <a
                              href={`https://wa.me/${order.phone}?text=${encodeURIComponent(
                                `S.V. Bakery - Order ${order.orderNumber}: ${order.proposedSlot?.note || 'A new time has been suggested for your order.'} Please check your order page for details.`,
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full rounded-lg border border-primary px-2 py-2 text-xs text-primary hover:bg-primary/5 disabled:opacity-60"
                            >
                              Open WhatsApp
                            </a>
                          )}

                          {canCancel && (
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Cancel order ${order.orderNumber}?`,
                                  )
                                ) {
                                  updateStatus(
                                    order.orderNumber,
                                    'CANCELLED',
                                  )
                                }
                              }}
                              className="w-full rounded-lg border border-destructive/30 px-4 py-2.5 font-medium text-destructive hover:bg-destructive/5 disabled:opacity-60"
                            >
                              Cancel Order
                            </button>
                          )}

                          {isUpdating && (
                            <p className="text-sm text-muted-foreground">
                              Updating order...
                            </p>
                          )}
                        </div>
                      )
                    })()}
                  </div>

                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

export default withAdminAuth(AdminOrdersPage)
