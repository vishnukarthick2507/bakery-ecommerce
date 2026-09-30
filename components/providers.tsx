'use client'

import { Toaster } from '@/components/ui/sonner'
import { CartProvider } from '@/components/cart/cart-provider'
import { CartSheet } from '@/components/cart/cart-sheet'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      {children}
      <CartSheet />
      <Toaster position="top-center" richColors closeButton />
    </CartProvider>
  )
}
