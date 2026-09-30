'use client'

import { PackageOpenIcon } from 'lucide-react'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Section, SectionHeading } from '@/components/section-heading'
import { ProductGrid, ProductGridSkeleton } from '@/components/product/product-grid'
import { useAvailableNow, useTaggedProducts } from '@/hooks/use-api'
import type { Product } from '@/lib/types'

interface RailProps {
  id: string
  eyebrow?: string
  title: string
  description?: string
  href?: string
  className?: string
  emptyTitle: string
  emptyDescription: string
}

function RailBody({
  products,
  isLoading,
  emptyTitle,
  emptyDescription,
}: {
  products?: Product[]
  isLoading: boolean
  emptyTitle: string
  emptyDescription: string
}) {
  if (isLoading) return <ProductGridSkeleton count={4} />
  if (!products?.length)
    return (
      <Empty className="border border-dashed bg-card">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <PackageOpenIcon />
          </EmptyMedia>
          <EmptyTitle>{emptyTitle}</EmptyTitle>
          <EmptyDescription>{emptyDescription}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  return <ProductGrid products={products.slice(0, 4)} />
}

export function TaggedRail({ tag, ...props }: RailProps & { tag: Product['tags'][number] }) {
  const { data, isLoading } = useTaggedProducts(tag)
  return (
    <Section labelledBy={props.id} className={props.className}>
      <SectionHeading {...props} />
      <RailBody products={data} isLoading={isLoading} {...props} />
    </Section>
  )
}

export function AvailableNowRail(props: RailProps) {
  const { data, isLoading } = useAvailableNow()
  return (
    <Section labelledBy={props.id} className={props.className}>
      <SectionHeading {...props} />
      <RailBody products={data} isLoading={isLoading} {...props} />
    </Section>
  )
}
