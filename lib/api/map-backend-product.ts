import type { AvailabilityStatus, CategorySlug, Product } from '@/lib/types'

export type BackendProduct = {
  _id: unknown
  name: string
  slug: string
  description: string
  price: number
  category: string
  images?: string[]
  stock?: number
  availability?: string
  preparationTime?: number
  active?: boolean
}

const PLACEHOLDER_IMAGE = '/placeholder.svg'

const categoryMap: Record<string, CategorySlug> = {
  cakes: 'cakes',
  brownies: 'brownies',
  cheesecakes: 'cheesecakes',
  pastries: 'pastries',
  breads: 'breads',
  cookies: 'cookies',
  cupcakes: 'cupcakes',
  savouries: 'savouries',
}

function mapCategory(category: string): CategorySlug {
  return categoryMap[category.trim().toLowerCase()] ?? 'cakes'
}

function mapAvailability(availability: string | undefined, stock: number): AvailabilityStatus {
  if (stock <= 0 || availability === 'OUT_OF_STOCK' || availability === 'DISABLED') {
    return 'SOLD_OUT'
  }
  return 'AVAILABLE_NOW'
}

export function isBackendProduct(value: unknown): value is BackendProduct {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return (
    item._id != null &&
    String(item._id).length > 0 &&
    typeof item.name === 'string' &&
    typeof item.slug === 'string' &&
    typeof item.description === 'string' &&
    typeof item.price === 'number' &&
    typeof item.category === 'string'
  )
}

export function mapBackendProduct(raw: BackendProduct): Product {
  const id = String(raw._id)
  const image = raw.images?.find((src) => src.trim().length > 0)?.trim() || PLACEHOLDER_IMAGE
  const stock = typeof raw.stock === 'number' ? raw.stock : 0

  return {
    id,
    slug: raw.slug,
    name: raw.name,
    category: mapCategory(raw.category),
    description: raw.description,
    image,
    variants: [
      {
        id: `${id}-default`,
        label: 'Standard',
        grams: 500,
        price: raw.price,
        mrp: raw.price,
      },
    ],
    rating: 0,
    reviewCount: 0,
    isVeg: true,
    availability: mapAvailability(raw.availability, stock),
    readyInMinutes: raw.preparationTime,
    tags: [],
    ingredients: [],
    allergens: [],
    shelfLife: '',
    reviews: [],
  }
}
