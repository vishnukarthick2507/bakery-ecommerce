export type AvailabilityStatus =
  | 'AVAILABLE_NOW'
  | 'READY_IN_TIME'
  | 'PRE_ORDER'
  | 'SOLD_OUT'

export type CategorySlug =
  | 'cakes'
  | 'pastries'
  | 'breads'
  | 'cookies'
  | 'cupcakes'
  | 'savouries'
  | 'brownies'
  | 'cheesecakes'

export interface Category {
  slug: CategorySlug
  name: string
  description: string
  image: string
}

export interface ProductVariant {
  id: string
  label: string
  grams: number
  price: number
  mrp: number
}

export interface ProductReview {
  id: string
  author: string
  rating: number
  comment: string
  date: string
}

export interface Product {
  id: string
  slug: string
  name: string
  category: CategorySlug
  description: string
  image: string
  variants: ProductVariant[]
  rating: number
  reviewCount: number
  isVeg: boolean
  availability: AvailabilityStatus
  readyInMinutes?: number
  preOrderHours?: number
  tags: Array<'bestseller' | 'special' | 'fresh'>
  ingredients: string[]
  allergens: string[]
  shelfLife: string
  reviews: ProductReview[]
}

export type SortOption = 'popular' | 'price-asc' | 'price-desc' | 'rating'

export type WeightRange = 'under-250' | '250-500' | '500-1000' | 'over-1000'

export interface ProductFilters {
  search?: string
  categories?: CategorySlug[]
  minPrice?: number
  maxPrice?: number
  weights?: WeightRange[]
  availability?: AvailabilityStatus[]
  minRating?: number
  vegOnly?: boolean
  sort?: SortOption
}

export interface CartItem {
  productId: string
  variantId: string
  quantity: number
  note?: string
}

export interface Offer {
  code: string
  title: string
  description: string
  discountType: 'percent' | 'flat' | 'free-delivery'
  value: number
  minOrder: number
}

export interface Testimonial {
  id: string
  name: string
  location: string
  rating: number
  comment: string
}

export interface Address {
  id: string
  label: string
  line1: string
  line2?: string
  city: string
  pincode: string
  phone: string
}

export interface User {
  id: string
  name: string
  email: string
  phone: string
  addresses: Address[]
}

export type FulfilmentMethod = 'pickup' | 'delivery'
export type PaymentMethod = 'online' | 'cod'

export type OrderStatus =
  | 'PLACED'
  | 'CONFIRMED'
  | 'BAKING'
  | 'READY'
  | 'OUT_FOR_DELIVERY'
  | 'COMPLETED'
  | 'CANCELLED'

export interface OrderLine {
  productId: string
  name: string
  image: string
  variantLabel: string
  unitPrice: number
  quantity: number
}

export interface Order {
  id: string
  userId?: string
  customerName: string
  phone: string
  lines: OrderLine[]
  subtotal: number
  discount: number
  deliveryFee: number
  total: number
  couponCode?: string
  fulfilment: FulfilmentMethod
  address?: Omit<Address, 'id'>
  scheduledDate: string
  timeSlot: string
  payment: PaymentMethod
  paymentStatus: 'PAID' | 'PENDING'
  status: OrderStatus
  createdAt: string
  statusHistory: Array<{ status: OrderStatus; at: string }>
}

export interface CreateOrderInput {
  customerName: string
  phone: string
  items: CartItem[]
  couponCode?: string
  fulfilment: FulfilmentMethod
  address?: Omit<Address, 'id'>
  scheduledDate: string
  timeSlot: string
  payment: PaymentMethod
}

export interface CustomCakeRequest {
  name: string
  phone: string
  email?: string
  occasion: string
  flavour: string
  weight: string
  tiers: string
  eggless: boolean
  message?: string
  designNotes?: string
  date: string
  fulfilment: FulfilmentMethod
}
