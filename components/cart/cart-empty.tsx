import Link from 'next/link'
import { ShoppingBagIcon } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'

export function CartEmpty({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Empty className="border border-border bg-card p-10 text-center shadow-sm">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ShoppingBagIcon className="size-10 text-primary" />
        </EmptyMedia>
        <EmptyTitle className="text-xl font-semibold text-primary tracking-tight">Your cart is empty</EmptyTitle>
        <EmptyDescription className="text-base">
          Browse today&apos;s fresh bakes and add your favourites to get started.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Link href="/products" onClick={onNavigate} className={cn(buttonVariants({ variant: 'caramel', size: 'lg' }), 'w-full sm:w-auto')}>
          Browse products
        </Link>
      </EmptyContent>
    </Empty>
  )
}
