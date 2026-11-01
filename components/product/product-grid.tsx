import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { Product } from '@/lib/types'
import { ProductCard } from './product-card'

const gridClass = 'grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4'

export function ProductGrid({ products, className }: { products: Product[]; className?: string }) {
  return (
    <ul className={cn(gridClass, className)} role="list">
      {products.map((p, i) => (
        <li key={p.id}>
          <ProductCard product={p} priority={i < 2} />
        </li>
      ))}
    </ul>
  )
}

export function ProductCardSkeleton() {
  return (
    <Card className="gap-0 overflow-hidden p-0 border border-border shadow-sm">
      <Skeleton className="aspect-[4/5] rounded-none" />
      <div className="flex flex-col gap-2 p-3 sm:p-4">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-10 w-full" />
      </div>
    </Card>
  )
}

export function ProductGridSkeleton({ count = 8, className }: { count?: number; className?: string }) {
  return (
    <div className={cn(gridClass, className)} aria-busy="true" aria-label="Loading products">
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  )
}
