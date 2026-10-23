import type { Metadata } from 'next'
import { ProductsBrowser } from '@/components/products/products-browser'
import { PageHeader } from '@/components/page-header'
import { getCategories } from '@/lib/api'
import { categoryLabel } from '@/lib/category-options'
import type { AvailabilityStatus, CategorySlug, SortOption } from '@/lib/types'

export const metadata: Metadata = {
  title: 'Shop',
  description:
    'Browse fresh cakes, pastries, breads, cookies and savouries. Filter by category, price and availability.',
}

const availabilityValues: AvailabilityStatus[] = [
  'AVAILABLE_NOW',
  'SOLD_OUT',
]

const sortValues: SortOption[] = [
  'popular',
  'price-asc',
  'price-desc',
]

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const categories = await getCategories()
  const categoryOptions = categories.map((category) => ({
    value: category.value,
    label: category.name,
  }))

  const pick = (key: string) =>
    typeof params[key] === 'string' ? params[key] : undefined

  const category = categoryOptions.find(
    (option) => categories.find((item) => item.value === option.value)?.slug === pick('category'),
  )?.value

  const availability = availabilityValues.find(
    (a) => a === pick('availability'),
  )

  const sort = sortValues.find(
    (s) => s === pick('sort'),
  )

  const q = pick('q')

  const heading = category
    ? categoryLabel(category)
    : 'All products'

  return (
    <>
      <PageHeader
        title={heading}
        description="Everything is baked in-house. Items marked 'Available now' can be picked up or delivered today."
        breadcrumbs={[
          { href: '/', label: 'Home' },
          { label: 'Shop' },
        ]}
      />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <ProductsBrowser
          key={`${category}-${availability}-${sort}-${q}`}
          initialCategory={category}
          initialAvailability={availability}
          initialSort={sort}
          initialSearch={q}
          categoryOptions={categoryOptions}
        />
      </div>
    </>
  )
}