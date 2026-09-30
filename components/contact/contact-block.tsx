import { ClockIcon, MailIcon, MapPinIcon, MessageCircleIcon, PhoneIcon } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { siteConfig, whatsappLink } from '@/lib/site-config'
import { cn } from '@/lib/utils'

export function ContactBlock() {
  const mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(siteConfig.mapQuery)}&output=embed`

  return (
    <div className="grid gap-5 lg:grid-cols-5">
      <Card className="shadow-sm lg:col-span-2">
        <CardHeader>
          <CardTitle className="font-heading text-xl">Get in touch</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <address className="flex flex-col gap-3 text-sm not-italic">
            <span className="flex gap-3">
              <MapPinIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              <span>
                {siteConfig.address.line1}
                <br />
                {siteConfig.address.city} {siteConfig.address.pincode}
              </span>
            </span>
            <a href={`tel:+${siteConfig.whatsappNumber}`} className="flex gap-3 hover:text-primary">
              <PhoneIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              {siteConfig.phoneDisplay}
            </a>
            <a href={`mailto:${siteConfig.email}`} className="flex gap-3 hover:text-primary">
              <MailIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              {siteConfig.email}
            </a>
          </address>

          <a
            href={whatsappLink('Hi Bluebell Bakehouse! I have a question.')}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: 'whatsapp', size: 'xl' }), 'w-full')}
          >
            <MessageCircleIcon data-icon="inline-start" />
            Chat on WhatsApp
          </a>

          <Separator />

          <div className="flex flex-col gap-3">
            <h3 className="flex items-center gap-2 font-sans text-sm font-semibold">
              <ClockIcon className="size-4 text-primary" aria-hidden="true" />
              Opening hours
            </h3>
            <dl className="flex flex-col gap-2 text-sm">
              {siteConfig.openingHours.map((row) => (
                <div key={row.days} className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{row.days}</dt>
                  <dd className="font-medium">{row.hours}</dd>
                </div>
              ))}
            </dl>
          </div>
        </CardContent>
      </Card>

      <div className="relative min-h-72 overflow-hidden rounded-xl border shadow-sm lg:col-span-3">
        <iframe
          title={`Map showing ${siteConfig.name} location`}
          src={mapSrc}
          className="absolute inset-0 size-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    </div>
  )
}
