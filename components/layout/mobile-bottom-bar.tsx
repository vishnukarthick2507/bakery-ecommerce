'use client'

import { MessageCircleIcon, ShoppingBagIcon } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { useCart } from '@/components/cart/cart-provider'
import { formatPrice } from '@/lib/format'
import { whatsappLink } from '@/lib/site-config'
import { cn } from '@/lib/utils'

export function MobileBottomBar() {
  const { count, pricing, setOpen, hydrated } = useCart()
  const showCount = hydrated && count > 0

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(15,47,102,0.08)] backdrop-blur md:hidden">
      <div className="flex gap-2">
        <Button
          size="xl"
          className="flex-1 justify-between"
          onClick={() => setOpen(true)}
          aria-label={`Open cart, ${count} items`}
        >
          <span className="flex items-center gap-2">
            <ShoppingBagIcon data-icon="inline-start" />
            Cart
            {showCount && (
              <span className="flex min-w-5 items-center justify-center rounded-full bg-caramel px-1.5 text-xs font-semibold text-caramel-foreground">
                {count}
              </span>
            )}
          </span>
          {showCount && <span className="font-semibold">{formatPrice(pricing.subtotal)}</span>}
        </Button>
        <a
          href={whatsappLink('Hi Bluebell Bakehouse! I have a question about an order.')}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ variant: 'whatsapp', size: 'xl' }))}
        >
          <MessageCircleIcon data-icon="inline-start" />
          WhatsApp
        </a>
      </div>
    </div>
  )
}
