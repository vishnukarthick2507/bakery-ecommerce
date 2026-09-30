'use client'

import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useMediaQuery } from '@/hooks/use-media-query'
import { formatPrice } from '@/lib/format'
import { siteConfig } from '@/lib/site-config'
import { cn } from '@/lib/utils'
import { useCart } from './cart-provider'
import { CartEmpty } from './cart-empty'
import { CartLine } from './cart-line'

export function CartSheet() {
  const { isOpen, setOpen, pricing, count } = useCart()
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const close = () => setOpen(false)
  const remainingForFreeDelivery = siteConfig.freeDeliveryAbove - pricing.subtotal

  return (
    <Sheet open={isOpen} onOpenChange={setOpen}>
      <SheetContent
        side={isDesktop ? 'right' : 'bottom'}
        className={cn(
          'gap-0 p-0',
          isDesktop ? 'w-full sm:max-w-md' : 'max-h-[85dvh] rounded-t-2xl',
        )}
      >
        {!isDesktop && (
          <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-border" aria-hidden="true" />
        )}
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle className="font-heading text-xl">Your cart</SheetTitle>
          <SheetDescription>
            {count === 0 ? 'No items yet' : `${count} ${count === 1 ? 'item' : 'items'}`}
          </SheetDescription>
        </SheetHeader>

        {pricing.lines.length === 0 ? (
          <div className="flex flex-1 items-center py-8">
            <CartEmpty onNavigate={close} />
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y overflow-y-auto px-5">
              {pricing.lines.map((line) => (
                <CartLine key={`${line.item.productId}-${line.item.variantId}`} line={line} onNavigate={close} />
              ))}
            </ul>
            <SheetFooter className="gap-3 border-t bg-cream px-5 py-4">
              {remainingForFreeDelivery > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Add {formatPrice(remainingForFreeDelivery)} more for free delivery.
                </p>
              ) : (
                <p className="text-xs font-medium text-success">You&apos;ve unlocked free delivery.</p>
              )}
              {pricing.savings > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">You save</span>
                  <span className="font-medium text-success">{formatPrice(pricing.savings)}</span>
                </div>
              )}
              <Separator />
              <div className="flex items-center justify-between">
                <span className="font-medium">Subtotal</span>
                <span className="text-lg font-semibold">{formatPrice(pricing.subtotal)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Link href="/cart" onClick={close} className={buttonVariants({ variant: 'outline', size: 'xl' })}>
                  View cart
                </Link>
                <Link href="/checkout" onClick={close} className={buttonVariants({ size: 'xl' })}>
                  Checkout
                </Link>
              </div>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
