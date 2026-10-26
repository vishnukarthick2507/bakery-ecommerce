import Link from 'next/link'
import { ShoppingBagIcon } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'

export function CartEmpty({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Empty className="border border-border bg-white p-8 text-center">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ShoppingBagIcon className="text-muted-foreground" />
        </EmptyMedia>
        <EmptyTitle className="text-primary">Your cart is empty</EmptyTitle>
        <EmptyDescription>
          Browse today&apos;s fresh bakes and add your favourites to get started.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Link href="/products" onClick={onNavigate} className={buttonVariants({ size: 'lg' })}>
          Browse products
        </Link>
      </EmptyContent>
    </Empty>
  )
}
