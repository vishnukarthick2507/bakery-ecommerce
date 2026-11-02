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
    <section aria-labelledby="custom-cake-title" className="bg-primary text-white">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 md:grid-cols-2 md:py-24 lg:gap-16">
        <div className="relative order-last aspect-[4/3] overflow-hidden rounded-[2.5rem] shadow-2xl md:order-first">
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-black/10 to-transparent" />
          <Image
            src="/images/custom-cake.png"
            alt="A two-tier custom celebration cake with blue and white frosting"
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover object-center"
          />
        </div>
        <div className="flex flex-col gap-6">
          <p className="w-fit rounded-full bg-primary px-3 py-1 text-xs font-semibold tracking-widest text-primary-foreground uppercase">
            Custom cakes
          </p>
          <h2 id="custom-cake-title" className="text-3xl font-bold sm:text-4xl">
            A cake designed around your celebration
          </h2>
          <p className="leading-relaxed text-white/80">
            Birthdays, weddings, baby showers and office milestones. Eggless options available on
            every design. Please order at least 48 hours in advance.
          </p>
          <ol className="flex flex-col gap-4">
            {steps.map((step, i) => (
              <li key={step} className="flex items-start gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-foreground/10 text-sm font-semibold border border-primary-foreground/20">
                  {i + 1}
                </span>
                <span className="text-sm leading-6 text-white/90">{step}</span>
              </li>
            ))}
          </ol>
          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:gap-3">
            <Link href="/custom-cake" className={cn(buttonVariants({ variant: 'caramel', size: 'xl' }), 'w-full sm:w-auto')}>
              <CheckIcon data-icon="inline-start" />
              Start your design
            </Link>
            <a
              href={whatsappLink('Hi S.V. Bakery! I would like to discuss a custom cake.')}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: 'whatsapp', size: 'xl' }), 'w-full sm:w-auto')}
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
