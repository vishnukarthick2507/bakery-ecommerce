'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { toast } from 'sonner'

import { getProducts, priceCart } from '@/lib/api'
import type { CartItem, Product } from '@/lib/types'

const CART_KEY = 'sv-sweets-cart-v1'
const MAX_QTY = 20
const MONGO_OBJECT_ID = /^[a-f0-9]{24}$/i

type CatalogStatus = 'loading' | 'loaded' | 'failed'

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function sanitizeStoredCartItem(value: unknown): CartItem | null {
  if (!isRecord(value)) return null

  const { productId, variantId, quantity, note } = value
  if (typeof productId !== 'string' || productId.length === 0) return null
  if (typeof variantId !== 'string' || variantId.length === 0) return null
  if (typeof quantity !== 'number' || !Number.isInteger(quantity)) return null
  if (quantity < 1 || quantity > MAX_QTY) return null

  const item: CartItem = { productId, variantId, quantity }
  if (typeof note === 'string' && note.length > 0) {
    item.note = note
  }
  return item
}

function isCatalogRenderableItem(item: CartItem, products: Product[]): boolean {
  // Only reconcile against positively-verified product/variant mappings.
  if (!MONGO_OBJECT_ID.test(item.productId)) return false
  const product = products.find((candidate) => candidate.id === item.productId)
  if (!product) return false
  return product.variants.some((variant) => variant.id === item.variantId)
}

function cartItemsEqual(a: CartItem[], b: CartItem[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i]
    const y = b[i]
    if (!x || !y) return false
    if (x.productId !== y.productId) return false
    if (x.variantId !== y.variantId) return false
    if (x.quantity !== y.quantity) return false
    if ((x.note ?? '') !== (y.note ?? '')) return false
  }
  return true
}

interface CartContextValue {
  items: CartItem[]
  hydrated: boolean
  catalogStatus: CatalogStatus
  count: number
  pricing: ReturnType<typeof priceCart>
  isOpen: boolean
  setOpen: (open: boolean) => void
  addItem: (
    item: CartItem,
    opts?: {
      silent?: boolean
      productName?: string
    },
  ) => void
  updateQuantity: (
    productId: string,
    variantId: string,
    quantity: number,
  ) => void
  removeItem: (productId: string, variantId: string) => void
  clear: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [catalogStatus, setCatalogStatus] = useState<CatalogStatus>('loading')
  const [isOpen, setOpen] = useState(false)

  // Load cart from localStorage (sanitize malformed entries; do not discard valid
  // entries because the catalogue is unavailable).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CART_KEY)

      if (raw) {
        const parsed: unknown = JSON.parse(raw)

        if (Array.isArray(parsed)) {
          const sanitized = parsed
            .map(sanitizeStoredCartItem)
            .filter((item): item is CartItem => item !== null)
          setItems(sanitized)
        }
      }
    } catch {
      // Ignore malformed localStorage data
    }

    setHydrated(true)
  }, [])

  // Load real products from backend
  useEffect(() => {
    let cancelled = false

    getProducts()
      .then((data) => {
        if (cancelled) return
        setProducts(data)
        setCatalogStatus('loaded')
      })
      .catch(() => {
        if (cancelled) return
        // Keep any stored cart entries intact on catalogue failure.
        setCatalogStatus('failed')
      })

    return () => {
      cancelled = true
    }
  }, [])

  // Reconcile stored cart entries against the actual catalogue only after a
  // successful load. Never guess identity (e.g. legacy variantId "default").
  useEffect(() => {
    if (!hydrated || catalogStatus !== 'loaded') return

    setItems((previousItems) => {
      const reconciled = previousItems.filter((item) =>
        isCatalogRenderableItem(item, products),
      )
      return cartItemsEqual(previousItems, reconciled) ? previousItems : reconciled
    })
  }, [hydrated, catalogStatus, products])

  // Save cart to localStorage (hydration-gated to avoid clobbering stored data).
  useEffect(() => {
    if (!hydrated) {
      return
    }

    window.localStorage.setItem(CART_KEY, JSON.stringify(items))
  }, [items, hydrated])

  // Add item
  const addItem = useCallback<CartContextValue['addItem']>(
    (item, opts) => {
      if (!Number.isInteger(item.quantity) || item.quantity < 1) {
        return
      }

      const product = products.find((candidate) => candidate.id === item.productId)
      const variantExists = product
        ? product.variants.some((variant) => variant.id === item.variantId)
        : false

      // When catalogue is loaded, only accept positively-verified product/variant pairs.
      if (catalogStatus === 'loaded' && (!product || !variantExists)) {
        toast.error('This item is currently unavailable')
        return
      }

      const maxQuantity = product
        ? Math.min(MAX_QTY, Math.max(0, product.stock))
        : MAX_QTY

      if (product && maxQuantity === 0) {
        toast.error(`${product.name} is currently unavailable`)
        return
      }

      setItems((previousItems) => {
        const existingItem = previousItems.find(
          (existing) =>
            existing.productId === item.productId &&
            existing.variantId === item.variantId,
        )

        if (existingItem) {
          return previousItems.map((existing) =>
            existing === existingItem
              ? {
                  ...existing,
                  quantity: Math.min(maxQuantity, existing.quantity + item.quantity),
                }
              : existing,
          )
        }

        const nextItem: CartItem = {
          productId: item.productId,
          variantId: item.variantId,
          quantity: Math.min(maxQuantity, item.quantity),
        }
        if (typeof item.note === 'string' && item.note.length > 0) {
          nextItem.note = item.note
        }

        return [...previousItems, nextItem]
      })

      if (!opts?.silent) {
        toast.success(
          opts?.productName ? `${opts.productName} added to cart` : 'Added to cart',
          {
            action: {
              label: 'View cart',
              onClick: () => setOpen(true),
            },
          },
        )
      }
    },
    [products, catalogStatus],
  )

  // Update quantity
  const updateQuantity = useCallback(
    (productId: string, variantId: string, quantity: number) => {
      const product = products.find((candidate) => candidate.id === productId)
      const maxQuantity = product
        ? Math.min(MAX_QTY, Math.max(0, product.stock))
        : MAX_QTY

      setItems((previousItems) => {
        if (!Number.isInteger(quantity)) {
          return previousItems
        }

        if (product && maxQuantity === 0) {
          return previousItems.filter(
            (item) =>
              !(item.productId === productId && item.variantId === variantId),
          )
        }

        return previousItems.map((item) =>
          item.productId === productId && item.variantId === variantId
            ? {
                ...item,
                quantity: Math.max(1, Math.min(maxQuantity, quantity)),
              }
            : item,
        )
      })
    },
    [products],
  )

  // Remove item
  const removeItem = useCallback((productId: string, variantId: string) => {
    setItems((previousItems) =>
      previousItems.filter(
        (item) =>
          !(item.productId === productId && item.variantId === variantId),
      ),
    )
  }, [])

  // Clear entire cart
  const clear = useCallback(() => {
    setItems([])
  }, [])

  // Cart values: when catalogue is loaded, expose only renderable lines/count to
  // keep badge, rows, and totals consistent. While loading/failed, do not discard
  // stored entries; pricing resolves only against known products.
  const pricing = useMemo(
    () => priceCart(items, products),
    [items, products],
  )

  const displayPricing = useMemo(() => {
    if (catalogStatus !== 'loaded') {
      return { lines: [], subtotal: 0, savings: 0 }
    }
    return pricing
  }, [catalogStatus, pricing])

  const count = useMemo(() => {
    if (catalogStatus !== 'loaded') {
      return 0
    }
    return displayPricing.lines.reduce((total, line) => total + line.item.quantity, 0)
  }, [catalogStatus, displayPricing])

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      hydrated,
      catalogStatus,
      count,
      pricing: displayPricing,

      isOpen,
      setOpen,

      addItem,
      updateQuantity,
      removeItem,
      clear,
    }),
    [
      items,
      hydrated,
      catalogStatus,
      count,
      displayPricing,
      isOpen,
      addItem,
      updateQuantity,
      removeItem,
      clear,
    ],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

// Cart hook
export function useCart() {
  const context = useContext(CartContext)

  if (!context) {
    throw new Error('useCart must be used within CartProvider')
  }

  return context
}

// Maximum quantity allowed
export const CART_MAX_QTY = MAX_QTY