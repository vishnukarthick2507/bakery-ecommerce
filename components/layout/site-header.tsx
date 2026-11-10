'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { CakeSliceIcon, MenuIcon, ShoppingBagIcon, UserRoundIcon } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useCart } from '@/components/cart/cart-provider'
import { navLinks, siteConfig } from '@/lib/site-config'
import { cn } from '@/lib/utils'

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn('flex items-center gap-2', className)}>
      <span className="flex size-10 items-center justify-center rounded-2xl bg-champagne-gold text-midnight-navy shadow-sm">
        <CakeSliceIcon className="size-5" aria-hidden="true" />
      </span>
      <span className="font-heading text-lg leading-none font-bold text-primary sm:text-xl tracking-tight">
        {siteConfig.name}
      </span>
    </Link>
  )
}

export function SiteHeader() {
  const pathname = usePathname()
  const { count, setOpen, hydrated } = useCart()
  const [menuOpen, setMenuOpen] = useState(false)

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href))

  return (
    <header className="sticky top-0 z-40 border-b border-gold-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Button
          variant="ghost"
          size="icon-lg"
          className="lg:hidden text-primary hover:text-primary/80"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
        >
          <MenuIcon />
        </Button>
        <Logo />

        <nav aria-label="Main" className="ml-6 hidden lg:block">
          <ul className="flex items-center gap-2">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={isActive(link.href) ? 'page' : undefined}
                  className={cn(
                    'rounded-xl px-4 py-2 text-sm font-medium text-primary transition-all hover:bg-gold-border hover:text-primary hover:border-champagne-gold/30 border-transparent',
                    isActive(link.href)
                      && 'bg-gold-border text-primary border-champagne-gold/50 font-semibold',
                  )}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <Link
            href="/account/landing"
            aria-label="Customer account"
            title="Customer account"
            className={cn(buttonVariants({ variant: 'outline', size: 'icon-lg' }), 'hidden sm:inline-flex text-primary hover:text-primary')}
          >
            <UserRoundIcon />
          </Link>
          <Button
            variant="outline"
            size="lg"
            onClick={() => setOpen(true)}
            className="relative hidden md:inline-flex"
            aria-label={`Open cart, ${count} items`}
          >
            <ShoppingBagIcon data-icon="inline-start" />
            Cart
            {hydrated && count > 0 && (
              <span className="ml-1.5 flex min-w-5 items-center justify-center rounded-full bg-champagne-gold px-1.5 text-xs font-semibold text-midnight-navy shadow-sm">
                {count}
              </span>
            )}
          </Button>
          <Link
            href="/products"
            className={cn(buttonVariants({ variant: 'caramel', size: 'lg' }), 'hidden md:inline-flex')}
          >
            Order now
          </Link>
        </div>
      </div>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-80 border-l border-gold-border">
          <SheetHeader className="pb-4">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <Logo />
          </SheetHeader>
          <nav aria-label="Mobile" className="px-4">
            <ul className="flex flex-col gap-1">
              <li>
                <Link
                  href="/account/landing"
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-xl px-4 py-3 text-base font-medium text-primary transition-colors hover:bg-gold-border hover:text-primary"
                >
                  My account
                </Link>
              </li>
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    aria-current={isActive(link.href) ? 'page' : undefined}
                    className={cn(
                      'block rounded-xl px-4 py-3 text-base font-medium transition-all border-transparent',
                      'text-primary hover:text-primary hover:bg-gold-border hover:border-champagne-gold/30',
                      isActive(link.href)
                        && 'bg-gold-border text-primary border-champagne-gold/50 font-semibold',
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  )
}
