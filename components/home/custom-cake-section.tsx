import Image from 'next/image'
import Link from 'next/link'
import { CheckIcon, MessageCircleIcon } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { whatsappLink } from '@/lib/site-config'
import { cn } from '@/lib/utils'

const steps = [
  'Pick a flavour, size and number of tiers',
  'Share your theme, colours or a reference photo',
  'We confirm the design and price on WhatsApp',
  'Collect it or get it delivered on your date',
]

export function CustomCakeSection() {
  return (
    <section aria-labelledby="custom-cake-title" className="bg-navy text-primary-foreground">
      <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-12 sm:px-6 md:grid-cols-2 md:py-16 lg:gap-14">
        <div className="relative order-last aspect-[4/3] overflow-hidden rounded-3xl md:order-first">
          <Image
            src="/images/custom-cake.png"
            alt="A two-tier custom celebration cake with blue and white frosting"
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover"
          />
        </div>
        <div className="flex flex-col gap-5">
          <p className="w-fit rounded-full bg-caramel px-3 py-1 text-xs font-semibold tracking-widest text-caramel-foreground uppercase">
            Custom cakes
          </p>
          <h2 id="custom-cake-title" className="text-3xl font-bold sm:text-4xl">
            A cake designed around your celebration
          </h2>
          <p className="leading-relaxed text-primary-foreground/80">
            Birthdays, weddings, baby showers and office milestones. Eggless options available on
            every design. Please order at least 48 hours in advance.
          </p>
          <ol className="flex flex-col gap-3">
            {steps.map((step, i) => (
              <li key={step} className="flex items-start gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-foreground/15 text-xs font-semibold">
                  {i + 1}
                </span>
                <span className="text-sm leading-6">{step}</span>
              </li>
            ))}
          </ol>
          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <Link href="/custom-cake" className={cn(buttonVariants({ variant: 'caramel', size: 'xl' }))}>
              <CheckIcon data-icon="inline-start" />
              Start your design
            </Link>
            <a
              href={whatsappLink('Hi Bluebell Bakehouse! I would like to discuss a custom cake.')}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: 'whatsapp', size: 'xl' }))}
            >
              <MessageCircleIcon data-icon="inline-start" />
              Chat on WhatsApp
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
