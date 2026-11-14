'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { withAdminAuth } from '@/components/admin/admin-auth'
import AdminLayout from '@/components/admin/admin-layout'
import { cn } from '@/lib/utils'
import { ClockIcon } from 'lucide-react'

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
    status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'ALTERNATIVE_REQUESTED'
    expiresAt?: string
  }
  rescheduleProposals?: Array<{
    proposalId: string
    previousConfirmedSlot?: string
    proposedSlot: string
    reason: string
    proposedAt: string
    status: string
    customerResponse?: string
    customerResponseAt?: string
    customerAlternativeSlot?: string
    customerAlternativeNote?: string
  }>
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
  isArchived?: boolean
  archivedAt?: string
  archivedBy?: string
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

const archiveEligibleStatuses: OrderStatus[] = [
  'DELIVERED',
  'COLLECTED',
  'CANCELLED',
]

function formatStatus(status: OrderStatus) {
  return status
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

const RESPONSE_WINDOW_OPTIONS = [
  { value: 1, label: '1 hour' },
  { value: 2, label: '2 hours' },
  { value: 3, label: '3 hours (default)' },
  { value: 4, label: '4 hours' },
  { value: 6, label: '6 hours' },
  { value: 12, label: '12 hours' },
  { value: 24, label: '24 hours (1 day)' },
  { value: 48, label: '48 hours (2 days)' },
  { value: 72, label: '72 hours (3 days)' },
]

function proposalStatusBadge(status?: string) {
  if (!status) return null

  const badges: Record<string, { label: string; className: string }> = {
    PENDING: {
      label: 'Proposal Pending',
      className: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
    },
    ALTERNATIVE_REQUESTED: {
      label: 'Alternative Requested',
      className: 'border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-400',
    },
    ACCEPTED: {
      label: 'Proposal Accepted',
      className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    },
    DECLINED: {
      label: 'Proposal Declined',
      className: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400',
    },
    EXPIRED: {
      label: 'Proposal Expired',
      className: 'border-destructive/30 bg-destructive/10 text-destructive',
    },
  }

  const badge = badges[status] ?? {
    label: status.replaceAll('_', ' '),
    className: 'border-border bg-cream text-muted-foreground',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        badge.className,
      )}
    >
      {badge.label}
    </span>
  )
}

function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | OrderStatus>('ALL')
  const [fulfillmentFilter, setFulfillmentFilter] = useState<FulfillmentFilter>('ALL')
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<'ALL' | 'COD' | 'ONLINE' | 'PAY_AT_STORE'>('ALL')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'ALL' | 'PENDING' | 'PAID' | 'FAILED'>('ALL')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [proposingOrder, setProposingOrder] = useState<string | null>(null)
  const [proposeDate, setProposeDate] = useState('')
  const [proposeTime, setProposeTime] = useState('')
  const [proposeNote, setProposeNote] = useState('')
  const [proposing, setProposing] = useState(false)
  const [proposeResponseWindow, setProposeResponseWindow] = useState<number>(3)
  const [tab, setTab] = useState<'active' | 'archived'>('active')
  const [archivingOrderNumber, setArchivingOrderNumber] = useState<string | null>(null)
  const [restoringOrderNumber, setRestoringOrderNumber] = useState<string | null>(null)
  const [confirmArchiveOrderNumber, setConfirmArchiveOrderNumber] = useState<string | null>(null)
  const [confirmRestoreOrderNumber, setConfirmRestoreOrderNumber] = useState<string | null>(null)

  async function fetchOrders() {
    try {
      setLoading(true)
      setError('')

      const params = new URLSearchParams()
      if (search.trim()) params.set('search', search.trim())
      if (statusFilter !== 'ALL') params.set('orderStatus', statusFilter)
      if (fulfillmentFilter !== 'ALL') params.set('fulfillmentType', fulfillmentFilter)
      if (paymentMethodFilter !== 'ALL') params.set('paymentMethod', paymentMethodFilter)
      if (paymentStatusFilter !== 'ALL') params.set('paymentStatus', paymentStatusFilter)
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)
      if (tab === 'archived') params.set('archived', 'true')

      const response = await fetch(`/api/orders?${params}`, {
        cache: 'no-store',
        credentials: 'include',
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
  }, [tab])

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
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
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
    responseWindowHours: number = proposeResponseWindow,
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
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            time: dateTime.toISOString(),
            note: note.trim(),
            responseWindowHours,
          }),
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Unable to propose slot')
      }

      setOrders((current) => current.map((item) => item._id === order._id
        ? { ...item, ...data.order }
        : item))

      // Refresh orders to reflect the proposal
      void fetchOrders()

      // Close the form
      setProposingOrder(null)
      setProposeDate('')
      setProposeTime('')
      setProposeNote('')
      setProposeResponseWindow(3)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to propose slot',
      )
    } finally {
      setProposing(false)
    }
  }

  async function handleArchiveOrder(orderNumber: string) {
    if (!window.confirm(
      `Archive order ${orderNumber}?\n\nThe order will be removed from the active list but will remain stored and accessible to customers and guests.`
    )) {
      return
    }
    setArchivingOrderNumber(orderNumber)
    setError('')
    try {
      const response = await fetch(
        `/api/orders/${encodeURIComponent(orderNumber)}/archive`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        },
      )
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.message || 'Unable to archive order')
      }
      setOrders((currentOrders) =>
        currentOrders.map((o) =>
          o.orderNumber === orderNumber
            ? { ...o, ...data.order, isArchived: true }
            : o,
        ),
      )
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to archive order')
    } finally {
      setArchivingOrderNumber(null)
    }
  }

  async function handleRestoreOrder(orderNumber: string) {
    if (!window.confirm(
      `Restore order ${orderNumber}?\n\nThe order will be returned to the active list.`
    )) {
      return
    }
    setRestoringOrderNumber(orderNumber)
    setError('')
    try {
      const response = await fetch(
        `/api/orders/${encodeURIComponent(orderNumber)}/restore`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        },
      )
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.message || 'Unable to restore order')
      }
      setOrders((currentOrders) =>
        currentOrders.map((o) =>
          o.orderNumber === orderNumber
            ? { ...o, ...data.order, isArchived: false }
            : o,
        ),
      )
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to restore order')
    } finally {
      setRestoringOrderNumber(null)
    }
  }

  return (
    <AdminLayout>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-semibold text-caramel uppercase tracking-wider">
              Bluebell Bakehouse Admin
            </p>

            <Link
              href="/admin"
              className="text-sm text-muted-foreground hover:underline"
            >
              ← Back to Dashboard
            </Link>

            <h1 className="mt-2 text-3xl font-bold text-primary tracking-tight">
              Orders
            </h1>

            <p className="mt-3 text-muted-foreground leading-relaxed">
              View and manage customer orders.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={fetchOrders}
              disabled={loading}
              className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-caramel hover:bg-cream/50 disabled:opacity-60 transition-colors"
            >
              {loading ? 'Refreshing...' : 'Refresh Orders'}
            </button>
            <Link
              href="/"
              className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-caramel hover:bg-cream/50 transition-colors"
            >
              View Store
            </Link>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab('active')}
            className={`px-5 py-2.5 text-sm font-medium rounded-xl border ${
              tab === 'active'
                ? 'bg-caramel text-caramel-foreground border-caramel'
                : 'border-border text-muted-foreground hover:bg-cream/50'
            } transition-colors`}
          >
            Active Orders
          </button>
          <button
            type="button"
            onClick={() => setTab('archived')}
            className={`px-5 py-2.5 text-sm font-medium rounded-xl border ${
              tab === 'archived'
                ? 'bg-caramel text-caramel-foreground border-caramel'
                : 'border-border text-muted-foreground hover:bg-cream/50'
            } transition-colors`}
          >
            Archived Orders
          </button>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            Search orders
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Order number, customer or phone"
              className="h-11 rounded-xl border border-border bg-card px-3 font-normal outline-none focus:ring-2 focus:ring-caramel"
            />
          </label>

          <label className="grid gap-2 text-sm font-semibold text-foreground">
            Status
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'ALL' | OrderStatus)}
              className="h-11 rounded-xl border border-border bg-card px-3 font-normal outline-none focus:ring-2 focus:ring-caramel"
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

          <label className="grid gap-2 text-sm font-semibold text-foreground">
            Fulfillment
            <select
              value={fulfillmentFilter}
              onChange={(event) => setFulfillmentFilter(event.target.value as FulfillmentFilter)}
              className="h-11 rounded-xl border border-border bg-card px-3 font-normal outline-none focus:ring-2 focus:ring-caramel"
            >
              <option value="ALL">Delivery and pickup</option>
              <option value="DELIVERY">Delivery</option>
              <option value="PICKUP">Pickup</option>
            </select>
          </label>

          <label className="grid gap-2 text-sm font-semibold text-foreground">
            Payment Method
            <select
              value={paymentMethodFilter}
              onChange={(event) => setPaymentMethodFilter(event.target.value as 'ALL' | 'COD' | 'ONLINE' | 'PAY_AT_STORE')}
              className="h-11 rounded-xl border border-border bg-card px-3 font-normal outline-none focus:ring-2 focus:ring-caramel"
            >
              <option value="ALL">All methods</option>
              <option value="COD">Cash on Delivery</option>
              <option value="ONLINE">Online Payment</option>
              <option value="PAY_AT_STORE">Pay at Store</option>
            </select>
          </label>

          <label className="grid gap-2 text-sm font-semibold text-foreground">
            Payment Status
            <select
              value={paymentStatusFilter}
              onChange={(event) => setPaymentStatusFilter(event.target.value as 'ALL' | 'PENDING' | 'PAID' | 'FAILED')}
              className="h-11 rounded-xl border border-border bg-card px-3 font-normal outline-none focus:ring-2 focus:ring-caramel"
            >
              <option value="ALL">All payment statuses</option>
              <option value="PENDING">Pending</option>
              <option value="PAID">Paid</option>
              <option value="FAILED">Failed</option>
            </select>
          </label>

          <label className="grid gap-2 text-sm font-semibold text-foreground">
            From Date
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="h-11 rounded-xl border border-border bg-card px-3 font-normal outline-none focus:ring-2 focus:ring-caramel"
            />
          </label>

          <label className="grid gap-2 text-sm font-semibold text-foreground">
            To Date
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="h-11 rounded-xl border border-border bg-card px-3 font-normal outline-none focus:ring-2 focus:ring-caramel"
            />
          </label>
        </div>

        {error && (
          <div className="mt-6 rounded-[2rem] border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive shadow-sm">
            {error}
          </div>
        )}

        {loading && (
          <div className="mt-10 rounded-[2rem] border border-border bg-card p-12 text-center shadow-sm">
            Loading orders...
          </div>
        )}

        {!loading && !error && orders.length === 0 && (
          <div className="mt-10 rounded-[2rem] border border-border bg-card p-12 text-center shadow-sm">
            <h2 className="text-xl font-semibold text-primary">
              {tab === 'archived' ? 'No archived orders yet' : 'No orders yet'}
            </h2>

            <p className="mt-3 text-muted-foreground">
              {tab === 'archived'
                ? 'Archived orders will appear here.'
                : 'Customer orders will appear here.'}
            </p>
          </div>
        )}

        {!loading && !error && orders.length > 0 && filteredOrders.length === 0 && (
          <div className="mt-10 rounded-[2rem] border border-border bg-card p-12 text-center shadow-sm">
            <h2 className="text-xl font-semibold text-primary">No matching orders</h2>
            <p className="mt-3 text-muted-foreground">
              Change or clear the search and filters to see other orders.
            </p>
          </div>
        )}

        {!loading && !error && filteredOrders.length > 0 && (
          <div className="mt-10 space-y-8">
            {filteredOrders.map((order) => (
              <section
                key={order._id}
                className="rounded-[2rem] border border-border bg-card p-8 shadow-sm sm:p-10"
              >
                {/* Order header */}
                <div className="flex flex-col justify-between gap-5 border-b border-border pb-7 sm:flex-row">
                  <div>
                    <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">
                      Order Number
                    </p>

                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-bold text-primary tracking-tight">
                        {order.orderNumber}
                      </h2>
                      {order.proposedSlot && proposalStatusBadge(order.proposedSlot.status)}
                    </div>

                    <p className="mt-3 text-sm text-muted-foreground">
                      Placed{' '}
                      {new Date(order.createdAt).toLocaleString('en-IN')}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-bold text-primary">₹{order.totalAmount.toLocaleString('en-IN')}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{formatStatus(order.orderStatus)}</p>
                  </div>
                </div>

                {/* Customer details */}
                <div className="grid gap-7 border-b border-border py-7 md:grid-cols-4">

                  <div>
                    <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">
                      Customer
                    </p>

                    <p className="mt-2 font-semibold text-primary">
                      {order.customerName}
                    </p>

                    <p className="mt-1 text-sm">
                      {order.phone}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">
                      Fulfillment
                    </p>

                    <p className="mt-2 font-semibold text-primary">
                      {order.fulfillmentType === 'DELIVERY'
                        ? 'Delivery'
                        : 'Pickup'}
                    </p>

                    <p className="mt-1 text-sm text-muted-foreground">
                      {order.scheduledDate} · {order.scheduledTime}
                    </p>

                    {order.requestedSlot && (
                      <p className="mt-2 text-xs text-muted-foreground">
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
                    <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">
                      Payment
                    </p>

                    <p className="mt-2 font-semibold text-primary">
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
                      <p className="mt-2 text-xs text-muted-foreground">
                        Paid at: {new Date(order.paidAt).toLocaleString('en-IN')}
                      </p>
                    )}

                    {order.razorpayOrderId && (
                      <p className="mt-2 text-xs text-muted-foreground break-all">
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
                      <div className="mt-4 rounded-[1.5rem] border border-caramel/20 bg-caramel/5 p-4">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <p className="text-xs font-semibold text-caramel uppercase tracking-wider">
                            Reschedule Proposal
                          </p>
                          {proposalStatusBadge(order.proposedSlot.status)}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">Proposed:</span>{' '}
                          {new Date(order.proposedSlot.time).toLocaleString('en-IN')}
                        </p>
                        {order.proposedSlot.note && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">Reason:</span> {order.proposedSlot.note}
                          </p>
                        )}
                        {order.proposedSlot.expiresAt && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">Expires:</span>{' '}
                            {new Date(order.proposedSlot.expiresAt).toLocaleString('en-IN')}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">
                      Inventory
                    </p>

                    <p className="mt-2 font-semibold text-primary">
                      {order.inventoryStatus
                        ? order.inventoryStatus.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())
                        : 'Not tracked (legacy order)'}
                    </p>
                    {order.reconciliationStatus === 'REVIEW_REQUIRED' && (
                      <p role="status" className="mt-3 text-sm font-medium text-destructive">
                        Manual review required{order.reconciliationReason ? `: ${order.reconciliationReason}` : ''}
                      </p>
                    )}
                    {order.isArchived && (
                      <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                        <p className="font-semibold">Archived</p>
                        <p className="mt-1">
                          Archived on {order.archivedAt ? new Date(order.archivedAt).toLocaleString('en-IN') : 'Unknown date'}
                        </p>
                      </div>
                    )}
                  </div>

                </div>

                {/* Items */}
                <div className="border-b border-border py-7">
                  <h3 className="font-semibold text-primary uppercase tracking-wider text-sm">
                    Items
                  </h3>

                  <div className="mt-4 divide-y divide-border">
                    {order.items.map((item, index) => (
                      <div
                        key={`${order._id}-${index}`}
                        className="flex items-center justify-between gap-4 py-4"
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

                {/* Customer Alternative Request Alert */}
                {(() => {
                  const latestAlternative = order.rescheduleProposals?.slice().reverse().find(
                    (p) => p.customerAlternativeSlot || p.status === 'ALTERNATIVE_REQUESTED',
                  )
                  if (!latestAlternative?.customerAlternativeSlot && order.proposedSlot?.status !== 'ALTERNATIVE_REQUESTED') {
                    return null
                  }

                  return (
                    <div className="mt-6 rounded-2xl border-2 border-purple-500/30 bg-purple-500/5 p-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="flex size-2 rounded-full bg-purple-600 animate-pulse" />
                            <h4 className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400">
                              Customer Requested Another Time
                            </h4>
                          </div>

                          {latestAlternative?.customerAlternativeSlot && (
                            <p className="mt-2 text-sm text-foreground">
                              <span className="font-semibold text-primary">Requested Slot:</span>{' '}
                              {new Date(latestAlternative.customerAlternativeSlot).toLocaleString('en-IN', {
                                weekday: 'short',
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          )}

                          {latestAlternative?.customerAlternativeNote && (
                            <p className="mt-1 text-sm text-foreground">
                              <span className="font-semibold text-primary">Customer Explanation:</span>{' '}
                              &ldquo;{latestAlternative.customerAlternativeNote}&rdquo;
                            </p>
                          )}

                          {latestAlternative?.customerResponseAt && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Requested on {new Date(latestAlternative.customerResponseAt).toLocaleString('en-IN')}
                            </p>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setProposingOrder(order._id)
                            if (latestAlternative?.customerAlternativeSlot) {
                              const d = new Date(latestAlternative.customerAlternativeSlot)
                              const yyyy = d.getFullYear()
                              const mm = String(d.getMonth() + 1).padStart(2, '0')
                              const dd = String(d.getDate()).padStart(2, '0')
                              const hh = String(d.getHours()).padStart(2, '0')
                              const min = String(d.getMinutes()).padStart(2, '0')
                              setProposeDate(`${yyyy}-${mm}-${dd}`)
                              setProposeTime(`${hh}:${min}`)
                              setProposeNote(
                                latestAlternative.customerAlternativeNote
                                  ? `Responding to request: ${latestAlternative.customerAlternativeNote}`
                                  : 'Proposed slot based on customer request',
                              )
                            } else {
                              setProposeDate('')
                              setProposeTime('')
                              setProposeNote('')
                            }
                            setProposeResponseWindow(3)
                          }}
                          className="shrink-0 rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-purple-700 transition-colors"
                        >
                          Respond & Propose Time
                        </button>
                      </div>
                    </div>
                  )
                })()}

                {/* Status */}
                <div className="flex flex-col gap-5 pt-7 sm:flex-row sm:items-end sm:justify-between">

                  <div>
                    <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">
                      Current Status
                    </p>

                    <p className="mt-2 text-2xl font-bold text-primary">
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
                        <div className="flex flex-col gap-3">
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
                              className="w-full rounded-xl bg-caramel px-5 py-3.5 font-semibold text-caramel-foreground shadow-sm hover:bg-caramel/90 disabled:opacity-60 transition-colors"
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
                                      credentials: 'include',
                                      headers: {
                                        'Content-Type': 'application/json',
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
                              className="w-full rounded-xl border border-caramel px-5 py-3 font-medium text-caramel hover:bg-caramel/5 disabled:opacity-60 transition-colors"
                            >
                              Mark Paid
                            </button>
                          )}

                          {/* Reschedule Order */}
                          {proposingOrder === order._id ? (
                            <section className="mt-4 rounded-2xl border border-caramel/40 bg-caramel/5 p-6 sm:p-8 shadow-sm">
                              <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-bold text-primary">
                                  Reschedule Order
                                </h3>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setProposingOrder(null)
                                    setProposeDate('')
                                    setProposeTime('')
                                    setProposeNote('')
                                    setProposeResponseWindow(3)
                                  }}
                                  className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-caramel hover:bg-cream/50 transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>

                              {/* Current Schedule */}
                              <div className="grid gap-4 sm:grid-cols-2 mb-6">
                                <div className="rounded-xl border border-border bg-card p-4">
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                    Current Schedule
                                  </p>
                                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                                    <ClockIcon className="size-4" aria-hidden="true" />
                                    <span>
                                      {new Date(
                                        order.scheduledDate +
                                          ' ' +
                                          order.scheduledTime,
                                      ).toLocaleString('en-IN')}
                                    </span>
                                  </p>
                                  {order.proposedSlot?.status === 'PENDING' && (
                                    <p className="mt-2 text-xs text-amber-700 flex items-center gap-1">
                                      <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" aria-hidden="true" />
                                      Pending proposal exists
                                    </p>
                                  )}
                                </div>
                                {proposeDate && proposeTime && (
                                  <div className="rounded-xl border border-emerald/30 bg-emerald/5 p-4">
                                    <p className="text-xs font-semibold text-emerald uppercase tracking-wider mb-2">
                                      Proposed Schedule
                                    </p>
                                    <p className="text-sm font-semibold text-emerald flex items-center gap-2">
                                      <ClockIcon className="size-4" aria-hidden="true" />
                                      <span>
                                        {new Date(
                                          `${proposeDate}T${proposeTime}:00`,
                                        ).toLocaleString('en-IN')}
                                      </span>
                                    </p>
                                  </div>
                                )}
                              </div>

                              <div className="space-y-4">
                                <div className="flex flex-col gap-2">
                                  <label className="text-xs font-semibold text-caramel uppercase tracking-wider block mb-1">
                                    New Date &amp; Time
                                  </label>
                                  <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="flex flex-col gap-2">
                                      <label className="text-xs font-semibold text-caramel uppercase tracking-wider">
                                        Date
                                      </label>
                                      <input
                                        type="date"
                                        value={proposeDate}
                                        onChange={(e) =>
                                          setProposeDate(e.target.value)
                                        }
                                        min={new Date()
                                          .toISOString()
                                          .split('T')[0]}
                                        className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-caramel"
                                      />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                      <label className="text-xs font-semibold text-caramel uppercase tracking-wider">
                                        Time
                                      </label>
                                      <input
                                        type="time"
                                        value={proposeTime}
                                        onChange={(e) =>
                                          setProposeTime(e.target.value)
                                        }
                                        className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-caramel"
                                      />
                                    </div>
                                  </div>
                                </div>

                                <div className="flex flex-col gap-2">
                                  <label className="text-xs font-semibold text-caramel uppercase tracking-wider block mb-1">
                                    Customer Response Window
                                  </label>
                                  <select
                                    value={proposeResponseWindow}
                                    onChange={(e) =>
                                      setProposeResponseWindow(
                                        Number(e.target.value),
                                      )
                                    }
                                    className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-caramel"
                                  >
                                    {RESPONSE_WINDOW_OPTIONS.map((opt) => (
                                      <option
                                        key={opt.value}
                                        value={opt.value}
                                      >
                                        {opt.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div className="flex flex-col gap-2">
                                  <label className="text-xs font-semibold text-caramel uppercase tracking-wider block mb-1">
                                    Reason for Rescheduling (required)
                                  </label>
                                  <textarea
                                    value={proposeNote}
                                    onChange={(e) =>
                                      setProposeNote(e.target.value)
                                    }
                                    required
                                    maxLength={500}
                                    rows={3}
                                    className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-caramel"
                                    placeholder="Explain why the delivery time needs to change"
                                  />
                                </div>

                                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                                  <button
                                    type="button"
                                    disabled={
                                      proposing ||
                                      !proposeDate ||
                                      !proposeTime ||
                                      !proposeNote.trim()
                                    }
                                    onClick={() =>
                                      proposeSlot(
                                        order.orderNumber,
                                        proposeDate,
                                        proposeTime,
                                        proposeNote,
                                        proposeResponseWindow,
                                      )
                                    }
                                    className="flex-1 sm:flex-none w-full sm:w-48 rounded-xl bg-caramel px-5 py-3 text-sm font-semibold text-caramel-foreground disabled:opacity-60 disabled:cursor-not-allowed hover:bg-caramel/90 transition-colors shadow-sm"
                                  >
                                    {proposing
                                      ? 'Proposing…'
                                      : 'Confirm Reschedule'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setProposingOrder(null)
                                      setProposeDate('')
                                      setProposeTime('')
                                      setProposeNote('')
                                      setProposeResponseWindow(3)
                                    }}
                                    className="flex-1 sm:flex-none w-full sm:w-48 rounded-xl border border-border px-5 py-3 text-sm font-semibold text-caramel hover:bg-cream/50 transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </div>

                                {error && (
                                  <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                                    {error}
                                  </div>
                                )}
                              </div>
                            </section>
                          ) : (
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() => {
                                setProposingOrder(order._id)
                                setProposeDate('')
                                setProposeTime('')
                                setProposeNote('')
                                setProposeResponseWindow(3)
                              }}
                              className="w-full rounded-xl border border-caramel px-3 py-2.5 text-xs text-caramel hover:bg-caramel/5 disabled:opacity-60 transition-colors"
                            >
                              Suggest Another Time
                            </button>
                          )}

                          {order.rescheduleProposals?.length ? (
                            <section className="mt-4 space-y-3 border-t border-border pt-4" aria-label="Reschedule history">
                              <h4 className="text-sm font-semibold">Reschedule history</h4>
                              {order.rescheduleProposals.map((proposal) => (
                                <div key={proposal.proposalId} className="rounded-lg bg-cream/40 p-3 text-xs space-y-1">
                                  <p>Previous confirmed: {proposal.previousConfirmedSlot ? new Date(proposal.previousConfirmedSlot).toLocaleString('en-IN') : 'Not recorded'}</p>
                                  <p>Proposed: {new Date(proposal.proposedSlot).toLocaleString('en-IN')}</p>
                                  <p>Reason: {proposal.reason}</p>
                                  <p>Proposal date: {new Date(proposal.proposedAt).toLocaleString('en-IN')} · {proposal.status.replaceAll('_', ' ')}</p>
                                  {proposal.customerResponse && <p>Customer response: {proposal.customerResponse.replaceAll('_', ' ')}{proposal.customerResponseAt ? ` · ${new Date(proposal.customerResponseAt).toLocaleString('en-IN')}` : ''}</p>}
                                  {proposal.customerAlternativeSlot && <p className="font-medium">Requested alternative: {new Date(proposal.customerAlternativeSlot).toLocaleString('en-IN')}{proposal.customerAlternativeNote ? ` · ${proposal.customerAlternativeNote}` : ''}</p>}
                                </div>
                              ))}
                            </section>
                          ) : null}

                          {/* WhatsApp click-to-chat */}
                          {order.phone && (
                            <a
                              href={`https://wa.me/${order.phone}?text=${encodeURIComponent(
                                `Bluebell Bakehouse - Order ${order.orderNumber}: ${order.proposedSlot?.note || 'A new time has been suggested for your order.'} Please check your order page for details.`,
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full rounded-xl border border-caramel px-3 py-2.5 text-xs text-caramel hover:bg-caramel/5 disabled:opacity-60 transition-colors"
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
                              className="w-full rounded-xl border border-destructive/30 px-5 py-3 font-medium text-destructive hover:bg-destructive/5 disabled:opacity-60 transition-colors"
                            >
                              Cancel Order
                            </button>
                          )}

                          {!order.isArchived &&
                            archiveEligibleStatuses.includes(
                              order.orderStatus as typeof archiveEligibleStatuses[number],
                            ) && (
                            <button
                              type="button"
                              disabled={
                                isUpdating ||
                                archivingOrderNumber === order.orderNumber
                              }
                              onClick={() => handleArchiveOrder(order.orderNumber)}
                              className="w-full rounded-xl border border-destructive/30 px-5 py-3 font-medium text-destructive hover:bg-destructive/5 disabled:opacity-60 transition-colors"
                            >
                              {archivingOrderNumber === order.orderNumber
                                ? 'Archiving…'
                                : 'Archive Order'}
                            </button>
                          )}
                          {order.isArchived && (
                            <button
                              type="button"
                              disabled={
                                isUpdating ||
                                restoringOrderNumber === order.orderNumber
                              }
                              onClick={() => handleRestoreOrder(order.orderNumber)}
                              className="w-full rounded-xl border border-caramel px-5 py-3 font-medium text-caramel hover:bg-caramel/5 disabled:opacity-60 transition-colors"
                            >
                              {restoringOrderNumber === order.orderNumber
                                ? 'Restoring…'
                                : 'Restore Order'}
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
    </AdminLayout>
  )
}

export default withAdminAuth(AdminOrdersPage)
