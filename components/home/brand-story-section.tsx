import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export function BrandStorySection() {
  return (
    <section className="bg-background py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="relative aspect-[4/5] overflow-hidden rounded-3xl shadow-xl border border-gold-border">
            <Image
              src="/images/hero.png"
              alt="Artisan bakers crafting sourdough loaves at Bluebell Bakehouse"
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover object-center"
            />
          </div>
          <div>
            <h2 className="font-heading text-3xl font-bold text-primary sm:text-4xl tracking-tight">
              Crafted with care, baked daily
            </h2>
            <p className="mt-6 text-lg text-secondary-text leading-relaxed">
              At Bluebell Bakehouse, we believe every loaf and every cake tells a
              story. Our bakers arrive before dawn to mix, shape and bake by hand,
              using only the finest ingredients and time-honoured techniques.
            </p>
            <p className="mt-4 text-lg text-secondary-text leading-relaxed">
              From buttery croissants to celebration cakes, everything is made
              fresh in our Chromepet kitchen — never frozen, never rushed.
            </p>
            <Link
              href="/about"
              className="mt-8 inline-flex items-center gap-2 rounded-lg border border-champagne-gold bg-champagne-gold px-7 py-3 font-semibold text-midnight-navy hover:bg-champagne-gold/90 transition-colors"
            >
              Our story <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
