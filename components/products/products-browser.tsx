'use client'

import { useDeferredValue, useState } from 'react'
import { SearchIcon, SearchXIcon, SlidersHorizontalIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ProductGrid, ProductGridSkeleton } from '@/components/product/product-grid'
import { useProducts } from '@/hooks/use-api'
import type { AvailabilityStatus, CategorySlug, SortOption } from '@/lib/types'
import {
  PRICE_MAX,
  PRICE_MIN,
  ProductFiltersPanel,
  countActiveFilters,
  defaultFilterState,
  type FilterState,
} from './product-filters'

const sortItems: Array<{ value: SortOption; label: string }> = [
  { value: 'popular', label: 'Most popular' },
  { value: 'rating', label: 'Top rated' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
]

export function ProductsBrowser({
  initialCategory,
  initialAvailability,
  initialSort,
  initialSearch,
}: {
  initialCategory?: CategorySlug
  initialAvailability?: AvailabilityStatus
  initialSort?: SortOption
  initialSearch?: string
}) {
  const [search, setSearch] = useState(initialSearch ?? '')
  const [sort, setSort] = useState<SortOption>(initialSort ?? 'popular')
  const [filters, setFilters] = useState<FilterState>({
    ...defaultFilterState,
    categories: initialCategory ? [initialCategory] : [],
    availability: initialAvailability ? [initialAvailability] : [],
  })
  const [sheetOpen, setSheetOpen] = useState(false)
  const deferredSearch = useDeferredValue(search)
  const activeCount = countActiveFilters(filters)

  const { data, isLoading, isValidating } = useProducts({
    search: deferredSearch,
    sort,
    categories: filters.categories,
    minPrice: filters.price[0] === PRICE_MIN ? undefined : filters.price[0],
    maxPrice: filters.price[1] === PRICE_MAX ? undefined : filters.price[1],
    weights: filters.weights,
    availability: filters.availability,
    minRating: filters.minRating || undefined,
    vegOnly: filters.vegOnly || undefined,
  })

  const resetAll = () => {
    setFilters(defaultFilterState)
    setSearch('')
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
      <aside aria-label="Filters" className="hidden lg:block">
        <div className="sticky top-24 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-sans text-base font-semibold">Filters</h2>
            {activeCount > 0 && (
              <Button variant="link" size="sm" onClick={() => setFilters(defaultFilterState)}>
                Clear all
              </Button>
            )}
          </div>
          <ProductFiltersPanel value={filters} onChange={setFilters} idPrefix="desk" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-col gap-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <InputGroup className="h-11 flex-1 bg-card">
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              placeholder="Search cakes, breads, cookies…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search products"
            />
            {search && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton size="icon-xs" onClick={() => setSearch('')} aria-label="Clear search">
                  <XIcon />
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="xl"
              className="flex-1 lg:hidden"
              onClick={() => setSheetOpen(true)}
            >
              <SlidersHorizontalIcon data-icon="inline-start" />
              Filters{activeCount > 0 ? ` (${activeCount})` : ''}
            </Button>
            <Select items={sortItems} value={sort} onValueChange={(v) => v && setSort(v as SortOption)}>
              <SelectTrigger className="h-11! flex-1 bg-card sm:w-52" aria-label="Sort products">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {sortItems.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        <p className="text-sm text-muted-foreground" aria-live="polite">
          {isLoading ? 'Loading products…' : `${data?.length ?? 0} ${data?.length === 1 ? 'product' : 'products'}`}
        </p>

        {isLoading ? (
          <ProductGridSkeleton count={6} className="lg:grid-cols-3" />
        ) : data && data.length > 0 ? (
          <div className={isValidating ? 'opacity-70 transition-opacity' : 'transition-opacity'}>
            <ProductGrid products={data} className="lg:grid-cols-3" />
          </div>
        ) : (
          <Empty className="border border-dashed bg-card">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SearchXIcon />
              </EmptyMedia>
              <EmptyTitle>No products match</EmptyTitle>
              <EmptyDescription>
                Try a different search term or remove a filter. Can&apos;t find what you need? Ask us about a
                custom order.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={resetAll}>Reset search and filters</Button>
            </EmptyContent>
          </Empty>
        )}
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] gap-0 rounded-t-2xl p-0">
          <SheetHeader className="border-b px-5 py-4">
            <SheetTitle className="font-heading text-xl">Filters</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-5 py-5">
            <ProductFiltersPanel value={filters} onChange={setFilters} idPrefix="mob" />
          </div>
          <SheetFooter className="grid grid-cols-2 gap-2 border-t px-5 py-4">
            <Button variant="outline" size="xl" onClick={() => setFilters(defaultFilterState)}>
              Clear all
            </Button>
            <Button size="xl" onClick={() => setSheetOpen(false)}>
              Show {data?.length ?? 0} results
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
