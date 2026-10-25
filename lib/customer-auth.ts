export type CustomerProfile = {
  id: string
  name: string
  email: string
  phone: string
  createdAt: string
  updatedAt: string
}

export type CustomerOrderItem = {
  productId: string
  productName: string
  variantId: string
  quantity: number
  unitPrice: number
  itemTotal?: number
  totalPrice: number
}

export type CustomerOrder = {
  _id: string
  orderNumber: string
  userId?: string
  customerName: string
  customer?: { name: string; email: string; phone: string }
  phone: string
  fulfillmentType: 'DELIVERY' | 'PICKUP'
  address?: { addressLine: string; city: string; pincode: string }
  scheduledDate: string
  scheduledTime: string
  paymentMethod: 'COD' | 'ONLINE'
  paymentStatus: 'PENDING' | 'PAID' | 'FAILED'
  orderStatus:
    | 'PLACED'
    | 'PAYMENT_CONFIRMED'
    | 'CONFIRMED'
    | 'PREPARING'
    | 'READY'
    | 'OUT_FOR_DELIVERY'
    | 'DELIVERED'
    | 'CANCELLED'
  items: CustomerOrderItem[]
  subtotal: number
  deliveryFee: number
  totalAmount: number
  createdAt: string
  updatedAt: string
}

export function getCustomerToken() {
  return typeof window === 'undefined'
    ? null
    : window.localStorage.getItem('customer-token')
}

export function customerAuthHeaders(): Record<string, string> {
  const token = getCustomerToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export function clearCustomerSession() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem('customer-token')
  }
}

export function formatOrderStatus(status: CustomerOrder['orderStatus']) {
  return status
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}