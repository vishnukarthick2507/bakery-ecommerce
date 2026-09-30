import Image from 'next/image'
import Link from 'next/link'
import { CakeIcon, ClockIcon, ShoppingBagIcon, TruckIcon, WheatIcon } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const highlights = [
  { icon: WheatIcon, label: 'Baked fresh every morning' },
  { icon: TruckIcon, label: 'Same-day delivery slots' },
  { icon: ClockIcon, label: 'Pickup from 7 AM' },
]

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="bg-secondary">
      <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-10 sm:px-6 md:grid-cols-2 md:py-16 lg:gap-14 lg:py-20">
        <div className="flex flex-col gap-6">
          <p className="w-fit rounded-full bg-background px-3 py-1 text-sm font-medium text-primary shadow-sm">
            Neighbourhood bakery · Indiranagar
          </p>
          <h1 id="hero-title" className="text-4xl leading-tight font-bold text-navy sm:text-5xl lg:text-6xl">
            Freshly Baked Happiness
          </h1>
          <p className="max-w-lg text-lg leading-relaxed text-pretty text-muted-foreground">
            Cakes, breads and pastries made from scratch in small batches. Order ahead for pickup or
            delivery, or design a cake that&apos;s entirely yours.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/products" className={cn(buttonVariants({ size: 'xl' }), 'h-12 px-6')}>
              <ShoppingBagIcon data-icon="inline-start" />
              Order now
            </Link>
            <Link href="/custom-cake" className={cn(buttonVariants({ variant: 'caramel', size: 'xl' }), 'h-12 px-6')}>
              <CakeIcon data-icon="inline-start" />
              Custom cake
            </Link>
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 pt-2">
            {highlights.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2 text-sm text-foreground">
                <Icon className="size-4 text-primary" aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative aspect-[4/3] overflow-hidden rounded-3xl shadow-lg md:aspect-square lg:aspect-[4/3.4]">
          <Image
            src="/images/hero.png"
            alt="A display of freshly baked cakes, croissants and breads at Bluebell Bakehouse"
            fill
            priority
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover"
          />
        </div>
      </div>
    </section>
  )
}
