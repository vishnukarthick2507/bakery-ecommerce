import { offers, testimonials } from '@/lib/mock-data'
import { categoryLabel, categorySlug } from '@/lib/category-options'
import type {
  CartItem,
  CategorySlug,
  CustomCakeRequest,
  Product,
  ProductFilters,
} from '@/lib/types'
import { isBackendProduct, mapBackendProduct } from './map-backend-product'

/**
 * API service layer.
 * Catalogue, cart pricing and custom-cake requests run against the real
 * Express/MongoDB backend. Only static marketing content (offers,
 * testimonials) is served locally.
 */

export class ApiError extends Error {}

function apiBaseUrl() {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL
  if (!baseUrl) {
    throw new ApiError('Product API is not configured.')
  }
  return baseUrl
}

/* ---------- Catalogue ---------- */

export async function getCategories() {
  try {
    const products = await fetchBackendProducts()
    const productsByCategory = new Map<string, Product>()

    for (const product of products) {
      if (!productsByCategory.has(product.category)) {
        productsByCategory.set(product.category, product)
      }
    }

    return Array.from(productsByCategory, ([value, product]) => ({
      slug: categorySlug(value),
      value,
      name: categoryLabel(value),
      description: '',
      image: product.image,
    }))
  } catch {
    return []
  }
}

export function basePrice(product: Product) {
  return Math.min(...product.variants.map((v) => v.price))
}

async function fetchBackendProducts(): Promise<Product[]> {
  let response: Response
  try {
    // Use a relative path so the request is proxied through Next.js's
    // server-side rewrite (/api/:path* -> backend URL) instead of a
    // cross-origin browser fetch to the absolute backend URL.
    response = await fetch('/api/products', { cache: 'no-store' })
  } catch {
    throw new ApiError('Unable to reach the product API.')
  }

  if (!response.ok) {
    throw new ApiError('Failed to load products.')
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new ApiError('Failed to load products.')
  }

  if (!Array.isArray(payload)) {
    throw new ApiError('Failed to load products.')
  }

  return payload.filter(isBackendProduct).map(mapBackendProduct)
}

function applyProductFilters(products: Product[], filters: ProductFilters): Product[] {
  const search = filters.search?.trim().toLowerCase()

  const result = products.filter((p) => {
    if (search) {
      const haystack = `${p.name} ${p.description} ${p.category}`.toLowerCase()
      if (!haystack.includes(search)) return false
    }
    if (filters.categories?.length && !filters.categories.includes(p.category as CategorySlug))
      return false
    const price = basePrice(p)
    if (filters.minPrice !== undefined && price < filters.minPrice) return false
    if (filters.maxPrice !== undefined && price > filters.maxPrice) return false
    if (filters.availability?.length && !filters.availability.includes(p.availability)) return false
    return true
  })

  switch (filters.sort) {
    case 'price-asc':
      return result.sort((a, b) => basePrice(a) - basePrice(b))
    case 'price-desc':
      return result.sort((a, b) => basePrice(b) - basePrice(a))
    default:
      // The backend has no rating/popularity data; keep its newest-first order.
      return result
  }
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const normalizedSlug = slug.trim().toLowerCase()
  if (!normalizedSlug) return null

  const baseUrl = apiBaseUrl()

  let response: Response
  try {
    response = await fetch(`${baseUrl}/api/products/slug/${encodeURIComponent(normalizedSlug)}`, {
      cache: 'no-store',
    })
  } catch {
    throw new ApiError('Unable to reach the product API.')
  }

  if (response.status === 404 || response.status === 400) {
    return null
  }

  if (!response.ok) {
    throw new ApiError('Failed to load product.')
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new ApiError('Failed to load product.')
  }

  if (!isBackendProduct(payload)) {
    throw new ApiError('Failed to load product.')
  }

  return mapBackendProduct(payload)
}

export async function getProducts(filters: ProductFilters = {}): Promise<Product[]> {
  const products = await fetchBackendProducts()
  return applyProductFilters(products, filters)
}

export async function getProductsByTag(tag: Product['tags'][number]) {
  const products = await fetchBackendProducts()
  // The backend catalogue has no tag field yet, so rails show distinct slices
  // of the real products instead of mock items.
  return tag === 'special' ? products.slice(4, 8) : products.slice(0, 4)
}

export async function getAvailableNow() {
  const products = await fetchBackendProducts()
  return products.filter((p) => p.availability === 'AVAILABLE_NOW')
}

/* ---------- Static marketing content ---------- */

export async function getOffers() {
  return offers
}

export async function getTestimonials() {
  return testimonials
}

/* ---------- Cart pricing ---------- */

export interface PricedLine {
  item: CartItem
  product: Product
  variant: Product['variants'][number]
  lineTotal: number
}

export function priceCart(items: CartItem[], products: Product[]) {
  const lines: PricedLine[] = []

  for (const item of items) {
    const product = products.find((p) => p.id === item.productId)
    const variant = product?.variants.find((v) => v.id === item.variantId)

    if (!product || !variant) continue

    lines.push({
      item,
      product,
      variant,
      lineTotal: variant.price * item.quantity,
    })
  }

  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0)
  const savings = lines.reduce(
    (sum, l) => sum + (l.variant.mrp - l.variant.price) * l.item.quantity,
    0,
  )

  return { lines, subtotal, savings }
}

/* ---------- Custom cake requests ---------- */

export async function submitCustomCakeRequest(input: CustomCakeRequest) {
  const baseUrl = apiBaseUrl()

  let response: Response
  try {
    response = await fetch(`${baseUrl}/api/custom-cake-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
  } catch {
    throw new ApiError('Unable to reach the server. Please call or WhatsApp us instead.')
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'message' in payload
        ? String((payload as { message: unknown }).message)
        : 'Unable to submit your request. Please call or WhatsApp us instead.'
    throw new ApiError(message)
  }

  return payload as { message: string; request: { id: string; referenceNumber: string } }
}
