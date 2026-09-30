'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { CakeSliceIcon, MenuIcon, ShoppingBagIcon, UserIcon } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useCart } from '@/components/cart/cart-provider'
import { useSession } from '@/hooks/use-api'
import { navLinks, siteConfig } from '@/lib/site-config'
import { cn } from '@/lib/utils'

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn('flex items-center gap-2', className)}>
      <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <CakeSliceIcon className="size-5" aria-hidden="true" />
      </span>
      <span className="font-heading text-lg leading-none font-bold text-navy sm:text-xl">
        {siteConfig.name}
      </span>
    </Link>
  )
}

export function SiteHeader() {
  const pathname = usePathname()
  const { count, setOpen, hydrated } = useCart()
  const { data: user } = useSession()
  const [menuOpen, setMenuOpen] = useState(false)

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href))

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Button
          variant="ghost"
          size="icon-lg"
          className="lg:hidden"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
        >
          <MenuIcon />
        </Button>
        <Logo />

        <nav aria-label="Main" className="ml-6 hidden lg:block">
          <ul className="flex items-center gap-1">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={isActive(link.href) ? 'page' : undefined}
                  className={cn(
                    'rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
                    isActive(link.href) && 'bg-secondary text-foreground',
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
            href={user ? '/profile' : '/login'}
            className={cn(buttonVariants({ variant: 'ghost', size: 'lg' }), 'hidden sm:inline-flex')}
          >
            <UserIcon data-icon="inline-start" />
            {user ? user.name.split(' ')[0] : 'Login'}
          </Link>
          <Link
            href={user ? '/profile' : '/login'}
            className={cn(buttonVariants({ variant: 'ghost', size: 'icon-lg' }), 'sm:hidden')}
            aria-label={user ? 'Your profile' : 'Log in'}
          >
            <UserIcon />
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
              <span className="ml-1 flex min-w-5 items-center justify-center rounded-full bg-caramel px-1.5 text-xs font-semibold text-caramel-foreground">
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
        <SheetContent side="left" className="w-80">
          <SheetHeader>
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <Logo />
          </SheetHeader>
          <nav aria-label="Mobile" className="px-4">
            <ul className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    aria-current={isActive(link.href) ? 'page' : undefined}
                    className={cn(
                      'block rounded-lg px-3 py-3 text-base font-medium hover:bg-secondary',
                      isActive(link.href) && 'bg-secondary text-primary',
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href={user ? '/profile' : '/login'}
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-lg px-3 py-3 text-base font-medium hover:bg-secondary"
                >
                  {user ? 'My account' : 'Login / Register'}
                </Link>
              </li>
            </ul>
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  )
}
