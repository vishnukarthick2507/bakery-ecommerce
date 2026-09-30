import {
  categories as mockCategories,
  offers as mockOffers,
  products as mockProducts,
  testimonials as mockTestimonials,
} from '@/lib/mock-data'
import { siteConfig } from '@/lib/site-config'
import type {
  Address,
  CartItem,
  CreateOrderInput,
  CustomCakeRequest,
  Offer,
  Order,
  Product,
  ProductFilters,
  User,
  WeightRange,
} from '@/lib/types'
import { readDb, writeDb } from './mock-db'

/**
 * API service layer.
 * Every function here is async and returns plain data so it can be swapped
 * for `fetch()` calls to a real backend without touching any UI code.
 */

const LATENCY_MS = 350
const delay = (ms = LATENCY_MS) => new Promise((r) => setTimeout(r, ms))

export class ApiError extends Error {}

/* ---------- Catalogue ---------- */

export async function getCategories() {
  await delay(150)
  return mockCategories
}

const weightRanges: Record<WeightRange, [number, number]> = {
  'under-250': [0, 249],
  '250-500': [250, 500],
  '500-1000': [501, 1000],
  'over-1000': [1001, Number.POSITIVE_INFINITY],
}

export function basePrice(product: Product) {
  return Math.min(...product.variants.map((v) => v.price))
}

export async function getProducts(filters: ProductFilters = {}): Promise<Product[]> {
  await delay()
  const search = filters.search?.trim().toLowerCase()

  const result = mockProducts.filter((p) => {
    if (search) {
      const haystack = `${p.name} ${p.description} ${p.category}`.toLowerCase()
      if (!haystack.includes(search)) return false
    }
    if (filters.categories?.length && !filters.categories.includes(p.category)) return false
    const price = basePrice(p)
    if (filters.minPrice !== undefined && price < filters.minPrice) return false
    if (filters.maxPrice !== undefined && price > filters.maxPrice) return false
    if (filters.weights?.length) {
      const matches = p.variants.some((v) =>
        filters.weights!.some((w) => {
          const [min, max] = weightRanges[w]
          return v.grams >= min && v.grams <= max
        }),
      )
      if (!matches) return false
    }
    if (filters.availability?.length && !filters.availability.includes(p.availability)) return false
    if (filters.minRating && p.rating < filters.minRating) return false
    if (filters.vegOnly && !p.isVeg) return false
    return true
  })

  switch (filters.sort) {
    case 'price-asc':
      return result.sort((a, b) => basePrice(a) - basePrice(b))
    case 'price-desc':
      return result.sort((a, b) => basePrice(b) - basePrice(a))
    case 'rating':
      return result.sort((a, b) => b.rating - a.rating)
    default:
      return result.sort((a, b) => b.reviewCount - a.reviewCount)
  }
}

export async function getProductsByTag(tag: Product['tags'][number]) {
  await delay()
  return mockProducts.filter((p) => p.tags.includes(tag))
}

export async function getAvailableNow() {
  await delay()
  return mockProducts.filter((p) => p.availability === 'AVAILABLE_NOW' && p.tags.includes('fresh'))
}

export async function getProductBySlug(slug: string) {
  await delay(200)
  return mockProducts.find((p) => p.slug === slug) ?? null
}

export async function getRelatedProducts(product: Product) {
  await delay(200)
  return mockProducts
    .filter((p) => p.category === product.category && p.id !== product.id)
    .slice(0, 4)
}

/** Synchronous lookup used by the cart to resolve line items. */
export function getProductSnapshot(productId: string) {
  return mockProducts.find((p) => p.id === productId) ?? null
}

export async function getOffers() {
  await delay(150)
  return mockOffers
}

export async function getTestimonials() {
  await delay(150)
  return mockTestimonials
}

/* ---------- Pricing ---------- */

export interface PricedLine {
  item: CartItem
  product: Product
  variant: Product['variants'][number]
  lineTotal: number
}

export function priceCart(items: CartItem[]) {
  const lines: PricedLine[] = []
  for (const item of items) {
    const product = getProductSnapshot(item.productId)
    const variant = product?.variants.find((v) => v.id === item.variantId)
    if (!product || !variant) continue
    lines.push({ item, product, variant, lineTotal: variant.price * item.quantity })
  }
  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0)
  const savings = lines.reduce((sum, l) => sum + (l.variant.mrp - l.variant.price) * l.item.quantity, 0)
  return { lines, subtotal, savings }
}

export function computeTotals(
  subtotal: number,
  fulfilment: 'pickup' | 'delivery',
  offer?: Offer | null,
) {
  let discount = 0
  let deliveryFee =
    fulfilment === 'delivery' && subtotal < siteConfig.freeDeliveryAbove ? siteConfig.deliveryFee : 0
  if (offer && subtotal >= offer.minOrder) {
    if (offer.discountType === 'percent') discount = Math.round((subtotal * offer.value) / 100)
    if (offer.discountType === 'flat') discount = offer.value
    if (offer.discountType === 'free-delivery') deliveryFee = 0
  }
  return { discount, deliveryFee, total: Math.max(0, subtotal - discount + deliveryFee) }
}

export async function validateCoupon(code: string, subtotal: number): Promise<Offer> {
  await delay(300)
  const offer = mockOffers.find((o) => o.code === code.trim().toUpperCase())
  if (!offer) throw new ApiError('This coupon code is not valid.')
  if (subtotal < offer.minOrder)
    throw new ApiError(`Add items worth ₹${offer.minOrder - subtotal} more to use ${offer.code}.`)
  return offer
}

/* ---------- Orders ---------- */

function withSimulatedProgress(order: Order): Order {
  if (order.status !== 'PLACED') return order
  const minutes = (Date.now() - new Date(order.createdAt).getTime()) / 60000
  if (minutes < 1) return order
  const confirmedAt = new Date(new Date(order.createdAt).getTime() + 60000).toISOString()
  return {
    ...order,
    status: 'CONFIRMED',
    statusHistory: [...order.statusHistory, { status: 'CONFIRMED', at: confirmedAt }],
  }
}

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  await delay(800)
  if (!input.items.length) throw new ApiError('Your cart is empty.')
  const { lines, subtotal } = priceCart(input.items)
  const unavailable = lines.find((l) => l.product.availability === 'SOLD_OUT')
  if (unavailable) throw new ApiError(`${unavailable.product.name} is sold out.`)

  const offer = input.couponCode
    ? mockOffers.find((o) => o.code === input.couponCode) ?? null
    : null
  const totals = computeTotals(subtotal, input.fulfilment, offer)

  const db = readDb()
  const now = new Date().toISOString()
  const order: Order = {
    id: `BB-${Math.floor(10000 + Math.random() * 89999)}`,
    userId: db.sessionUserId ?? undefined,
    customerName: input.customerName,
    phone: input.phone,
    lines: lines.map((l) => ({
      productId: l.product.id,
      name: l.product.name,
      image: l.product.image,
      variantLabel: l.variant.label,
      unitPrice: l.variant.price,
      quantity: l.item.quantity,
    })),
    subtotal,
    ...totals,
    couponCode: offer?.code,
    fulfilment: input.fulfilment,
    address: input.fulfilment === 'delivery' ? input.address : undefined,
    scheduledDate: input.scheduledDate,
    timeSlot: input.timeSlot,
    payment: input.payment,
    paymentStatus: input.payment === 'online' ? 'PAID' : 'PENDING',
    status: 'PLACED',
    createdAt: now,
    statusHistory: [{ status: 'PLACED', at: now }],
  }
  db.orders.unshift(order)
  writeDb(db)
  return order
}

export async function getOrder(orderId: string): Promise<Order | null> {
  await delay()
  const order = readDb().orders.find((o) => o.id.toUpperCase() === orderId.trim().toUpperCase())
  return order ? withSimulatedProgress(order) : null
}

export async function getMyOrders(): Promise<Order[]> {
  await delay()
  const db = readDb()
  if (!db.sessionUserId) return []
  return db.orders.filter((o) => o.userId === db.sessionUserId).map(withSimulatedProgress)
}

export async function submitCustomCakeRequest(input: CustomCakeRequest) {
  await delay(800)
  const db = readDb()
  const id = `CC-${Math.floor(1000 + Math.random() * 8999)}`
  db.cakeRequests.push({ ...input, id, createdAt: new Date().toISOString() })
  writeDb(db)
  return { id }
}

/* ---------- Auth & profile ---------- */

function publicUser(user: User & { password?: string }): User {
  const { password: _password, ...rest } = user
  return rest
}

export async function getCurrentUser(): Promise<User | null> {
  await delay(150)
  const db = readDb()
  const user = db.users.find((u) => u.id === db.sessionUserId)
  return user ? publicUser(user) : null
}

export async function login(email: string, password: string): Promise<User> {
  await delay(600)
  const db = readDb()
  const user = db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
  if (!user || user.password !== password) throw new ApiError('Incorrect email or password.')
  db.sessionUserId = user.id
  writeDb(db)
  return publicUser(user)
}

export async function register(input: {
  name: string
  email: string
  phone: string
  password: string
}): Promise<User> {
  await delay(600)
  const db = readDb()
  if (db.users.some((u) => u.email.toLowerCase() === input.email.trim().toLowerCase()))
    throw new ApiError('An account with this email already exists.')
  const user = {
    id: `u-${crypto.randomUUID()}`,
    name: input.name.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    password: input.password,
    addresses: [],
  }
  db.users.push(user)
  db.sessionUserId = user.id
  writeDb(db)
  return publicUser(user)
}

export async function logout() {
  await delay(150)
  const db = readDb()
  db.sessionUserId = null
  writeDb(db)
}

export async function addAddress(address: Omit<Address, 'id'>): Promise<User> {
  await delay(400)
  const db = readDb()
  const user = db.users.find((u) => u.id === db.sessionUserId)
  if (!user) throw new ApiError('Please log in first.')
  user.addresses.push({ ...address, id: crypto.randomUUID() })
  writeDb(db)
  return publicUser(user)
}

export async function removeAddress(addressId: string): Promise<User> {
  await delay(300)
  const db = readDb()
  const user = db.users.find((u) => u.id === db.sessionUserId)
  if (!user) throw new ApiError('Please log in first.')
  user.addresses = user.addresses.filter((a) => a.id !== addressId)
  writeDb(db)
  return publicUser(user)
}
