import type { AvailabilityStatus, CategorySlug, Product, ProductVariant } from '@/lib/types'

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
  isVeg?: boolean
  weight?: number
  grams?: number
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
  donuts: 'donuts',
  puffs: 'puffs',
  rolls: 'rolls',
  samosas: 'samosas',
  sandwiches: 'sandwiches',
  // Handle capitalized variants from backend
  Cakes: 'cakes',
  Brownies: 'brownies',
  Cheesecakes: 'cheesecakes',
  Pastries: 'pastries',
  Breads: 'breads',
  Cookies: 'cookies',
  Cupcakes: 'cupcakes',
  Savouries: 'savouries',
  Donuts: 'donuts',
  Puffs: 'puffs',
  Rolls: 'rolls',
  Samosas: 'samosas',
  Sandwiches: 'sandwiches',
}

function mapCategory(category: string): Product['category'] {
  const normalized = category.trim().toLowerCase()
  // Unknown backend categories are preserved as normalized slugs instead of
  // being silently rewritten to another category like cakes.
  return categoryMap[normalized] ?? normalized
}

function mapAvailability(availability: string | undefined, stock?: number): AvailabilityStatus {
  if (availability === 'OUT_OF_STOCK' || availability === 'DISABLED') {
    return 'SOLD_OUT'
  }
  if (typeof stock === 'number' && stock <= 0) {
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

  const variant: ProductVariant = {
    id: `${id}-default`,
    label: 'Standard',
    price: raw.price,
    mrp: raw.price,
  }
  const weight =
    typeof raw.weight === 'number'
      ? raw.weight
      : typeof raw.grams === 'number'
        ? raw.grams
        : undefined
  if (weight !== undefined) {
    variant.grams = weight
  }

  return {
    id,
    slug: raw.slug,
    name: raw.name,
    category: mapCategory(raw.category),
    description: raw.description,
    image,
    stock,
    variants: [variant],
    rating: 0,
    reviewCount: 0,
    ...(typeof raw.isVeg === 'boolean' ? { isVeg: raw.isVeg } : {}),
    availability: mapAvailability(raw.availability, stock),
    readyInMinutes: raw.preparationTime,
    tags: [],
    ingredients: [],
    allergens: [],
    shelfLife: '',
  }
}
