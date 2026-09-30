import type { Metadata } from 'next'
import { ProductsBrowser } from '@/components/products/products-browser'
import { PageHeader } from '@/components/page-header'
import { categories } from '@/lib/mock-data'
import type { AvailabilityStatus, CategorySlug, SortOption } from '@/lib/types'

export const metadata: Metadata = {
  title: 'Shop',
  description: 'Browse fresh cakes, pastries, breads, cookies and savouries. Filter by category, price, weight and availability.',
}

const availabilityValues: AvailabilityStatus[] = ['AVAILABLE_NOW', 'READY_IN_TIME', 'PRE_ORDER', 'SOLD_OUT']
const sortValues: SortOption[] = ['popular', 'price-asc', 'price-desc', 'rating']

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const pick = (key: string) => (typeof params[key] === 'string' ? (params[key] as string) : undefined)

  const category = categories.find((c) => c.slug === pick('category'))?.slug as CategorySlug | undefined
  const availability = availabilityValues.find((a) => a === pick('availability'))
  const sort = sortValues.find((s) => s === pick('sort'))
  const q = pick('q')

  const heading = category ? categories.find((c) => c.slug === category)!.name : 'All products'

  return (
    <>
      <PageHeader
        title={heading}
        description="Everything is baked in-house. Items marked 'Available now' can be picked up or delivered today."
        breadcrumbs={[{ href: '/', label: 'Home' }, { label: 'Shop' }]}
      />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <ProductsBrowser
          key={`${category}-${availability}-${sort}-${q}`}
          initialCategory={category}
          initialAvailability={availability}
          initialSort={sort}
          initialSearch={q}
        />
      </div>
    </>
  )
}
