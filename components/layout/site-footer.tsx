import Link from 'next/link'
import { CakeSliceIcon, ClockIcon, MapPinIcon, PhoneIcon } from 'lucide-react'
import { siteConfig, whatsappLink } from '@/lib/site-config'
import { cn } from '@/lib/utils'

const footerNav = [
  { href: '/', label: 'Home' },
  { href: '/products', label: 'Shop' },
  { href: '/custom-cake', label: 'Custom Cakes' },
  { href: '/track', label: 'Track Order' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
]

export function SiteFooter() {
  return (
    <footer className="border-t border-gold-border bg-midnight-navy text-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <span className="flex size-8 items-center justify-center rounded-xl bg-champagne-gold text-midnight-navy shadow-sm">
                <CakeSliceIcon className="size-5" aria-hidden="true" />
              </span>
              <span className="font-heading font-bold text-champagne-gold tracking-tight text-lg">
                {siteConfig.name}
              </span>
            </div>
            <p className="text-muted/70 text-sm leading-relaxed max-w-xs">
              Handcrafted sourdough, viennoiserie, celebration cakes and pastries
              baked fresh every day. Premium bakery delivery and pickup in Chennai.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-6">
              Shop
            </h3>
            <ul className="space-y-3">
              {footerNav.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted/70 hover:text-champagne-gold transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-6">
              Support
            </h3>
            <ul className="space-y-3">
              <li>
                <Link href="/contact" className="text-sm text-muted/70 hover:text-champagne-gold transition-colors">
                  Contact us
                </Link>
              </li>
              <li>
                <Link href="/track" className="text-sm text-muted/70 hover:text-champagne-gold transition-colors">
                  Track your order
                </Link>
              </li>
              <li>
                <Link href="/custom-cake" className="text-sm text-muted/70 hover:text-champagne-gold transition-colors">
                  Custom cake requests
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-6">
              Visit us
            </h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-3 text-sm text-muted/70">
                <MapPinIcon className="size-4 shrink-0 text-champagne-gold mt-0.5" aria-hidden="true" />
                <span className="leading-relaxed">
                  {siteConfig.address.line1}<br />
                  {siteConfig.address.city}<br />
                  {siteConfig.address.pincode}
                </span>
              </li>
              <li className="flex items-center gap-3 text-sm text-muted/70">
                <PhoneIcon className="size-4 shrink-0 text-champagne-gold mt-0.5" aria-hidden="true" />
                <a href={`tel:${siteConfig.whatsappNumber}`} className="hover:text-champagne-gold transition-colors">
                  {siteConfig.phoneDisplay}
                </a>
              </li>
              <li className="flex items-center gap-3 text-sm text-muted/70">
                <ClockIcon className="size-4 shrink-0 text-champagne-gold mt-0.5" aria-hidden="true" />
                <span>
                  Mon–Fri: 7:00 AM – 9:00 PM<br />
                  Sat: 7:00 AM – 10:00 PM · Sun: 8:00 AM – 8:00 PM
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gold-border/30 pt-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-sm text-muted/60">
            {siteConfig.name}. Freshly baked, always.
          </p>
          <div className="flex items-center gap-4">
            <a
              href={whatsappLink("Hi Bluebell Bakehouse, I'd like to place an order.")}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg bg-champagne-gold px-3 py-2 text-xs font-medium text-midnight-navy hover:bg-champagne-gold/90 transition-colors"
            >
              <span className="size-4" aria-hidden="true">💬</span>
              WhatsApp
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
