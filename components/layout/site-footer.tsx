import Link from 'next/link'
import { MailIcon, MapPinIcon, PhoneIcon } from 'lucide-react'
import { categories } from '@/lib/mock-data'
import { navLinks, siteConfig } from '@/lib/site-config'

export function SiteFooter() {
  return (
    <footer className="bg-navy text-primary-foreground">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-3">
          <p className="font-heading text-2xl font-bold">{siteConfig.name}</p>
          <p className="text-sm leading-relaxed text-primary-foreground/80">{siteConfig.description}</p>
        </div>

        <nav aria-label="Footer" className="flex flex-col gap-3">
          <h2 className="font-sans text-sm font-semibold tracking-wide uppercase">Explore</h2>
          <ul className="flex flex-col gap-2 text-sm text-primary-foreground/80">
            {navLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="hover:text-primary-foreground hover:underline">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex flex-col gap-3">
          <h2 className="font-sans text-sm font-semibold tracking-wide uppercase">Shop</h2>
          <ul className="flex flex-col gap-2 text-sm text-primary-foreground/80">
            {categories.map((c) => (
              <li key={c.slug}>
                <Link href={`/products?category=${c.slug}`} className="hover:text-primary-foreground hover:underline">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="font-sans text-sm font-semibold tracking-wide uppercase">Visit us</h2>
          <address className="flex flex-col gap-3 text-sm not-italic text-primary-foreground/80">
            <span className="flex gap-2">
              <MapPinIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {siteConfig.address.line1}, {siteConfig.address.city} {siteConfig.address.pincode}
            </span>
            <a href={`tel:+${siteConfig.whatsappNumber}`} className="flex gap-2 hover:text-primary-foreground">
              <PhoneIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {siteConfig.phoneDisplay}
            </a>
            <a href={`mailto:${siteConfig.email}`} className="flex gap-2 hover:text-primary-foreground">
              <MailIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {siteConfig.email}
            </a>
          </address>
        </div>
      </div>
      <div className="border-t border-primary-foreground/15">
        <p className="mx-auto max-w-7xl px-4 py-5 text-xs text-primary-foreground/70 sm:px-6">
          © {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
