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

interface CartContextValue {
  items: CartItem[]
  hydrated: boolean
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
  removeItem: (
    productId: string,
    variantId: string,
  ) => void
  clear: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [items, setItems] = useState<CartItem[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [isOpen, setOpen] = useState(false)

  // Load cart from localStorage
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CART_KEY)

      if (raw) {
        const parsed: unknown = JSON.parse(raw)

        if (Array.isArray(parsed)) {
          setItems(parsed as CartItem[])
        }
      }
    } catch {
      // Ignore malformed localStorage data
    }

    setHydrated(true)
  }, [])

  // Load real products from backend
  useEffect(() => {
    getProducts()
      .then((data) => {
        setProducts(data)
      })
      .catch(() => {
        setProducts([])
      })
  }, [])

  // Save cart to localStorage
  useEffect(() => {
    if (!hydrated) {
      return
    }

    window.localStorage.setItem(
      CART_KEY,
      JSON.stringify(items),
    )
  }, [items, hydrated])

  // Add item
  const addItem = useCallback<
    CartContextValue['addItem']
  >((item, opts) => {
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
                quantity: Math.min(
                  MAX_QTY,
                  existing.quantity + item.quantity,
                ),
              }
            : existing,
        )
      }

      return [
        ...previousItems,
        {
          ...item,
          quantity: Math.min(
            MAX_QTY,
            item.quantity,
          ),
        },
      ]
    })

    if (!opts?.silent) {
      toast.success(
        opts?.productName
          ? `${opts.productName} added to cart`
          : 'Added to cart',
        {
          action: {
            label: 'View cart',
            onClick: () => setOpen(true),
          },
        },
      )
    }
  }, [])

  // Update quantity
  const updateQuantity = useCallback(
    (
      productId: string,
      variantId: string,
      quantity: number,
    ) => {
      setItems((previousItems) => {
        if (quantity <= 0) {
          return previousItems.filter(
            (item) =>
              !(
                item.productId === productId &&
                item.variantId === variantId
              ),
          )
        }

        return previousItems.map((item) =>
          item.productId === productId &&
          item.variantId === variantId
            ? {
                ...item,
                quantity: Math.min(
                  MAX_QTY,
                  quantity,
                ),
              }
            : item,
        )
      })
    },
    [],
  )

  // Remove item
  const removeItem = useCallback(
    (
      productId: string,
      variantId: string,
    ) => {
      setItems((previousItems) =>
        previousItems.filter(
          (item) =>
            !(
              item.productId === productId &&
              item.variantId === variantId
            ),
        ),
      )
    },
    [],
  )

  // Clear entire cart
  const clear = useCallback(() => {
    setItems([])
  }, [])

  // Cart values
  const value = useMemo<CartContextValue>(
    () => ({
      items,
      hydrated,

      count: items.reduce(
        (total, item) =>
          total + item.quantity,
        0,
      ),

      pricing: priceCart(
        items,
        products,
      ),

      isOpen,
      setOpen,

      addItem,
      updateQuantity,
      removeItem,
      clear,
    }),
    [
      items,
      products,
      hydrated,
      isOpen,
      addItem,
      updateQuantity,
      removeItem,
      clear,
    ],
  )

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  )
}

// Cart hook
export function useCart() {
  const context = useContext(CartContext)

  if (!context) {
    throw new Error(
      'useCart must be used within CartProvider',
    )
  }

  return context
}

// Maximum quantity allowed
export const CART_MAX_QTY = MAX_QTY