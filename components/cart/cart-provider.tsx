'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { priceCart } from '@/lib/api'
import type { CartItem } from '@/lib/types'

const CART_KEY = 'bluebell-cart-v1'
const MAX_QTY = 20

interface CartContextValue {
  items: CartItem[]
  hydrated: boolean
  count: number
  pricing: ReturnType<typeof priceCart>
  isOpen: boolean
  setOpen: (open: boolean) => void
  addItem: (item: CartItem, opts?: { silent?: boolean; productName?: string }) => void
  updateQuantity: (productId: string, variantId: string, quantity: number) => void
  removeItem: (productId: string, variantId: string) => void
  clear: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [isOpen, setOpen] = useState(false)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CART_KEY)
      if (raw) setItems(JSON.parse(raw))
    } catch {
      /* ignore malformed cart */
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(CART_KEY, JSON.stringify(items))
  }, [items, hydrated])

  const addItem = useCallback<CartContextValue['addItem']>((item, opts) => {
    setItems((prev) => {
      const existing = prev.find(
        (i) => i.productId === item.productId && i.variantId === item.variantId,
      )
      if (existing) {
        return prev.map((i) =>
          i === existing ? { ...i, quantity: Math.min(MAX_QTY, i.quantity + item.quantity) } : i,
        )
      }
      return [...prev, { ...item, quantity: Math.min(MAX_QTY, item.quantity) }]
    })
    if (!opts?.silent) {
      toast.success(opts?.productName ? `${opts.productName} added to cart` : 'Added to cart', {
        action: { label: 'View cart', onClick: () => setOpen(true) },
      })
    }
  }, [])

  const updateQuantity = useCallback((productId: string, variantId: string, quantity: number) => {
    setItems((prev) =>
      quantity <= 0
        ? prev.filter((i) => !(i.productId === productId && i.variantId === variantId))
        : prev.map((i) =>
            i.productId === productId && i.variantId === variantId
              ? { ...i, quantity: Math.min(MAX_QTY, quantity) }
              : i,
          ),
    )
  }, [])

  const removeItem = useCallback((productId: string, variantId: string) => {
    setItems((prev) => prev.filter((i) => !(i.productId === productId && i.variantId === variantId)))
  }, [])

  const clear = useCallback(() => setItems([]), [])

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      hydrated,
      count: items.reduce((n, i) => n + i.quantity, 0),
      pricing: priceCart(items),
      isOpen,
      setOpen,
      addItem,
      updateQuantity,
      removeItem,
      clear,
    }),
    [items, hydrated, isOpen, addItem, updateQuantity, removeItem, clear],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}

export const CART_MAX_QTY = MAX_QTY
