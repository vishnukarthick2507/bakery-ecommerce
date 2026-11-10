import Image from 'next/image'
import Link from 'next/link'
import { CakeIcon, ClockIcon, ShoppingBagIcon, TruckIcon, WheatIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const highlights = [
  { icon: WheatIcon, label: 'Baked fresh every morning' },
  { icon: TruckIcon, label: 'Same-day delivery' },
  { icon: ClockIcon, label: 'Pickup from 7 AM' },
]

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative bg-primary overflow-hidden">
      <div className="absolute inset-0 bg-[url('/images/hero.png')] bg-cover bg-center opacity-60" aria-hidden="true" />
      <div className="absolute inset-0 bg-gradient-to-b from-primary/70 via-primary/40 to-primary/20" aria-hidden="true" />
      <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-8 px-4 py-12 sm:px-6 md:grid-cols-2 md:py-24 lg:gap-16 lg:py-32">
        <div className="flex flex-col gap-6">
          <p
            className={cn(
              'w-fit rounded-full bg-champagne-gold/20 px-3 py-1 text-sm font-semibold text-white tracking-wide uppercase border border-champagne-gold/40',
              'animate-in fade-in slide-in-from-bottom-4 duration-700',
            )}
          >
            Artisan bakery · Chromepet, Chennai
          </p>
          <h1
            id="hero-title"
            className={cn(
              'font-heading text-4xl leading-tight font-bold text-white sm:text-6xl lg:text-7xl tracking-tight',
              'animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150',
            )}
          >
            Freshly Baked.<br />
            Made With Love.
          </h1>
          <p
            className={cn(
              'max-w-lg text-lg leading-relaxed text-white/85',
              'animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300',
            )}
          >
            Cakes, breads and pastries made from scratch in small batches. Order
            ahead for pickup or delivery, or design a cake that&apos;s entirely
            yours.
          </p>
          <div
            className={cn(
              'flex flex-col gap-4 sm:flex-row',
              'animate-in fade-in slide-in-from-bottom-4 duration-700 delay-[450ms]',
            )}
          >
            <Link
              href="/products"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-champagne-gold px-8 py-4 font-semibold text-midnight-navy shadow-sm hover:bg-champagne-gold/90 transition-colors"
            >
              <ShoppingBagIcon data-icon="inline-start" className="size-5" />
              Order now
            </Link>
            <Link
              href="/custom-cake"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-champagne-gold/60 bg-white/10 px-8 py-4 font-semibold text-white hover:bg-white/20 transition-colors"
            >
              <CakeIcon data-icon="inline-start" className="size-5" />
              Custom cake
            </Link>
          </div>
          <ul
            className={cn(
              'flex flex-wrap gap-x-6 gap-y-3 pt-4',
              'animate-in fade-in slide-in-from-bottom-4 duration-700 delay-[600ms]',
            )}
          >
            {highlights.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2.5 text-sm text-white/80">
                <Icon className="size-4 text-champagne-gold" aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>
        </div>
        <div
          className={cn(
            'hidden lg:block relative aspect-[4/3] overflow-hidden rounded-3xl shadow-2xl border border-white/20',
            'animate-in fade-in zoom-in duration-700 delay-700',
          )}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
          <Image
            src="/images/hero.png"
            alt="A display of freshly baked artisan cakes, croissants and sourdough loaves at Bluebell Bakehouse"
            fill
            priority
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover object-center"
          />
        </div>
      </div>
    </section>
  )
}
