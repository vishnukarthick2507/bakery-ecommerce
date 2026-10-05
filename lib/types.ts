export type AvailabilityStatus =
  | 'AVAILABLE_NOW'
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

export interface Product {
  id: string
  slug: string
  name: string
  /** Canonical slug when known; unknown backend values are preserved as-is. */
  category: CategorySlug | (string & {})
  description: string
  image: string
  variants: ProductVariant[]
  rating: number
  reviewCount: number
  isVeg: boolean
  availability: AvailabilityStatus
  readyInMinutes?: number
  tags: Array<'bestseller' | 'special' | 'fresh'>
  ingredients: string[]
  allergens: string[]
  shelfLife: string
}

export type SortOption = 'popular' | 'price-asc' | 'price-desc'

export interface ProductFilters {
  search?: string
  categories?: CategorySlug[]
  minPrice?: number
  maxPrice?: number
  availability?: AvailabilityStatus[]
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

export interface CustomCakeRequest {
  name: string
  phone: string
  flavour: string
  weight: string
  theme: string
  messageOnCake?: string
  instructions?: string
  referenceImageUrl?: string
}
