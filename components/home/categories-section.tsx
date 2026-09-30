import Image from 'next/image'
import Link from 'next/link'
import { Section, SectionHeading } from '@/components/section-heading'
import type { Category } from '@/lib/types'

export function CategoriesSection({ categories }: { categories: Category[] }) {
  return (
    <Section labelledBy="categories-title">
      <SectionHeading id="categories-title" title="Shop by category" href="/products" hrefLabel="All products" />
      <ul className="grid grid-cols-3 gap-3 sm:gap-5 lg:grid-cols-6">
        {categories.map((c) => (
          <li key={c.slug}>
            <Link
              href={`/products?category=${c.slug}`}
              className="group flex flex-col items-center gap-3 rounded-2xl border bg-card p-3 text-center shadow-sm transition-shadow hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:p-4"
            >
              <span className="relative aspect-square w-full overflow-hidden rounded-xl bg-cream">
                <Image
                  src={c.image || '/placeholder.svg'}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 15vw, 30vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold sm:text-base">{c.name}</span>
                <span className="hidden text-xs text-muted-foreground sm:block">{c.description}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  )
}
