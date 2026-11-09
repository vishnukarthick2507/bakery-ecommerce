'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  LogOutIcon,
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Cake,
  CreditCard,
  BarChart,
  Settings,
  Menu,
  X,
  FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type NavItem = {
  href: string
  label: string
  icon: React.ElementType
}

const adminNavItems: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/orders', label: 'Orders', icon: ShoppingCart },
  { href: '/admin/products', label: 'Products', icon: Package },
  { href: '/admin/inventory', label: 'Inventory', icon: Cake },
  { href: '/admin/customers', label: 'Customers', icon: Users },
  { href: '/admin/custom-cakes', label: 'Custom Cakes', icon: Cake },
  { href: '/admin/payments', label: 'Payments', icon: CreditCard },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart },
  { href: '/admin/analytics/sales', label: 'Sales Analytics', icon: BarChart },
  { href: '/admin/analytics/products', label: 'Product Performance', icon: Package },
  { href: '/admin/analytics/customers', label: 'Customer Intelligence', icon: Users },
  { href: '/admin/analytics/financial', label: 'Financial Analytics', icon: CreditCard },
  { href: '/admin/analytics/inventory', label: 'Inventory Analytics', icon: Package },
  { href: '/admin/analytics/reports', label: 'Reports', icon: FileText },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
]

const viewStoreItem: NavItem = { href: '/', label: 'View Store', icon: LayoutDashboard }

const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches

const inactiveLink =
  'rounded-xl border-transparent px-3 py-2 text-sm font-medium text-muted-foreground transition-all hover:bg-cream/50 hover:text-caramel hover:border-caramel/20'
const activeLink =
  'rounded-xl border border-caramel bg-caramel px-3 py-2 text-sm font-semibold text-caramel-foreground shadow-sm'

export default function AdminNav({ className }: { className?: string } = {}) {
  const pathname = usePathname()
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        credentials: 'include',
      })
    } finally {
      setLoggingOut(false)
      router.replace('/admin/login')
    }
  }

  return (
    <>
      {/* Mobile menu trigger */}
      <button
        type="button"
        className="md:hidden rounded-xl bg-caramel px-3 py-2 text-caramel-foreground font-semibold shadow-sm"
        onClick={() => setMobileMenuOpen((prev) => !prev)}
        aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
      >
        {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-y-0 left-0 z-50 w-72 bg-card border-r border-border md:hidden shadow-2xl transform transition-transform duration-300">
          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-xl bg-caramel text-caramel-foreground">
                <Cake className="size-5" aria-hidden="true" />
              </div>
              <span className="font-heading font-bold text-caramel text-sm">S.V. Bakery</span>
            </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-cream/50"
              aria-label="Close menu"
            >
              <X className="size-5" />
            </button>
          </div>
          <nav className="px-4 py-2 space-y-1" aria-label="Admin navigation">
            {adminNavItems.map((item) => {
              const isActive = pathname === item.href
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all',
                    isActive
                      ? activeLink
                      : inactiveLink,
                  )}
                >
                  <Icon className={`size-5 shrink-0 ${isActive ? 'text-caramel-foreground' : 'text-muted-foreground'}`} aria-hidden="true" />
                  {item.label}
                </Link>
              )
            })}
            <Link
              href={viewStoreItem.href}
              onClick={() => setMobileMenuOpen(false)}
              className={inactiveLink}
            >
              <LayoutDashboard className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              {viewStoreItem.label}
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all',
                inactiveLink,
                loggingOut ? 'opacity-60 cursor-not-allowed' : 'hover:bg-destructive/10 hover:text-destructive',
              )}
            >
              <LogOutIcon className="size-5 shrink-0" aria-hidden="true" />
              {loggingOut ? 'Signing out…' : 'Logout'}
            </button>
          </nav>
        </div>
      )}

      {/* Desktop sidebar */}
      <nav
        className={cn(
          'hidden md:flex flex-col w-64 shrink-0 border-r border-border bg-card',
          className,
        )}
        aria-label="Admin navigation"
      >
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-caramel text-caramel-foreground shadow-sm">
              <Cake className="size-5" aria-hidden="true" />
            </div>
            <span className="font-heading font-bold text-caramel">S.V. Bakery</span>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden rounded-lg p-1.5 text-muted-foreground hover:bg-cream/50"
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </button>
        </div>
        <nav className="px-2 py-3 space-y-0.5" aria-label="Admin navigation">
          {adminNavItems.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all',
                  isActive ? activeLink : inactiveLink,
                )}
              >
                <Icon className={`size-5 shrink-0 ${isActive ? 'text-caramel-foreground' : 'text-muted-foreground'}`} aria-hidden="true" />
                {item.label}
              </Link>
            )
          })}
          <Link
            href={viewStoreItem.href}
            className={inactiveLink}
          >
            <LayoutDashboard className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            {viewStoreItem.label}
          </Link>
        </nav>
        <div className="mt-auto px-4 py-4 border-t border-border">
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className={cn(
              'flex items-center gap-3 w-full rounded-xl px-3 py-2 text-sm font-medium transition-all',
              inactiveLink,
              loggingOut ? 'opacity-60 cursor-not-allowed' : 'hover:bg-destructive/10 hover:text-destructive',
            )}
          >
            <LogOutIcon className="size-5 shrink-0" aria-hidden="true" />
            {loggingOut ? 'Signing out…' : 'Logout'}
          </button>
        </div>
      </nav>
    </>
  )
}
