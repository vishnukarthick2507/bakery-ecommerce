'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
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
  LogOutIcon,
} from 'lucide-react'
import { withAdminAuth } from '@/components/admin/admin-auth'
import { cn } from '@/lib/utils'

type NavItem = {
  href: string
  label: string
  icon: React.ElementType
}

const adminNavItems: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart },
  { href: '/admin/products', label: 'Products', icon: Package },
  { href: '/admin/orders', label: 'Orders', icon: ShoppingCart },
  { href: '/admin/customers', label: 'Customers', icon: Users },
  { href: '/admin/custom-cakes', label: 'Custom Cakes', icon: Cake },
  { href: '/admin/inventory', label: 'Inventory', icon: Package },
  { href: '/admin/payments', label: 'Payments', icon: CreditCard },
  { href: '/admin/reports', label: 'Reports', icon: FileText },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
]

const analyticsNavItems: NavItem[] = [
  { href: '/admin/analytics/sales', label: 'Sales', icon: BarChart },
  { href: '/admin/analytics/products', label: 'Products', icon: Package },
  { href: '/admin/analytics/customers', label: 'Customers', icon: Users },
  { href: '/admin/analytics/financial', label: 'Financial', icon: CreditCard },
  { href: '/admin/analytics/inventory', label: 'Inventory', icon: Package },
]

const viewStoreItem = { href: '/', label: 'View Store' }

const sidebarCollapsed = 'w-20'
const sidebarExpanded = 'w-72'

const navLinkBase =
  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all'

const navLinkActive =
  'bg-champagne-gold/10 border border-champagne-gold/30 bg-champagne-gold/5 text-champagne-gold shadow-sm'

const navLinkInactive =
  'border-transparent text-secondary-text hover:bg-white hover:text-primary hover:border-gold-border/40'

const navLinkIconActive = 'size-5 shrink-0 text-champagne-gold'
const navLinkIconInactive = 'size-5 shrink-0 text-secondary-text'

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const isCollapsed = !sidebarOpen

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        credentials: 'include',
      })
    } catch {
      // Ignore; cookie cleared client-side regardless.
    }
    document.cookie = 'admin-token=; path=/; max-age=0'
    window.location.href = '/admin/login'
  }

  // Close sidebar on mobile when navigating
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
      setSidebarOpen(false)
    }
  }, [pathname])

  const isActive = (href: string) => pathname === href

  const renderNavLinks = (mobile = false) => (
    <>
      {adminNavItems.map((item) => {
        const active = isActive(item.href)
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={mobile ? () => setMobileMenuOpen(false) : undefined}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
              active
                ? 'bg-champagne-gold/10 border border-champagne-gold/30 bg-champagne-gold/5 text-champagne-gold shadow-sm'
                : 'border-transparent text-secondary-text hover:bg-white hover:text-primary hover:border-gold-border/40',
            )}
            aria-current={active ? 'page' : undefined}
          >
            <Icon
              className={cn(
                'size-5 shrink-0',
                active ? 'text-champagne-gold' : 'text-secondary-text',
              )}
              aria-hidden="true"
            />
            {!isCollapsed || !mobile ? <span>{item.label}</span> : null}
          </Link>
        )
      })}
      <Link
        href={viewStoreItem.href}
        onClick={mobile ? () => setMobileMenuOpen(false) : undefined}
        className={cn(
          'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
          'border-transparent text-secondary-text hover:bg-gold-border/50 hover:text-primary',
        )}
      >
        <LayoutDashboard className="size-5 shrink-0 text-secondary-text" aria-hidden="true" />
        {viewStoreItem.label}
      </Link>
      <button
        type="button"
        onClick={() => {
          setMobileMenuOpen(false)
          handleLogout()
        }}
        className={cn(
          'flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
          'border-transparent text-secondary-text hover:bg-destructive/10 hover:text-destructive',
        )}
      >
        <LogOutIcon className="size-5 shrink-0" aria-hidden="true" />
        Logout
      </button>
    </>
  )

  return (
    <div className="flex min-h-screen bg-warm-ivory">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-col transition-all duration-300 border-r border-gold-border',
          isCollapsed ? sidebarCollapsed : sidebarExpanded,
          'bg-midnight-navy text-white shadow-xl',
        )}
        aria-label="Admin navigation"
      >
        <div className="flex items-center justify-between px-4 py-5">
          <Link
            href="/admin"
            className="flex items-center gap-2"
            title="Bluebell Bakehouse Admin"
          >
            <div className="flex size-9 items-center justify-center rounded-xl bg-champagne-gold text-midnight-navy shadow-sm">
              <Cake className="size-5" aria-hidden="true" />
            </div>
            {!isCollapsed && (
              <span className="font-heading font-bold text-champagne-gold tracking-tight">
                Bluebell
              </span>
            )}
          </Link>
          {isCollapsed && (
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-1.5 text-champagne-gold hover:bg-white/10"
              aria-label="Expand navigation"
            >
              <Menu className="size-5" />
            </button>
          )}
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5" aria-label="Main navigation">
          {renderNavLinks()}
        </nav>

        <div className="mt-auto px-4 py-5 border-t border-gold-border/40">
          <button
            type="button"
            onClick={handleLogout}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
              'border-transparent text-secondary-text hover:bg-white/10 hover:text-white',
            )}
          >
            <LogOutIcon className="size-5 shrink-0 text-secondary-text" aria-hidden="true" />
            {!isCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Desktop + Mobile content area */}
      <div className="flex-1 min-w-0 flex-col relative">
        {/* Desktop header */}
        <header
          className={cn(
            'lg:block sticky top-0 z-30 flex items-center justify-between border-b border-gold-border bg-white/95 backdrop-blur px-6 py-4 shadow-sm',
          )}
        >
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden rounded-lg p-2 text-secondary-text hover:bg-gold-border hover:text-primary"
              aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              {sidebarOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
            <div className="hidden lg:flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-champagne-gold text-midnight-navy">
                <Cake className="size-4" aria-hidden="true" />
              </div>
              <span className="font-heading font-bold text-midnight-navy">
                Bluebell Bakehouse
              </span>
              <span className="text-xs text-secondary-text">Admin</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleLogout}
              className="hidden lg:flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-secondary-text border border-gold-border hover:bg-gold-border/50 hover:text-primary transition-colors"
            >
              <LogOutIcon className="size-4" aria-hidden="true" />
              Logout
            </button>
          </div>
        </header>

        {/* Mobile header */}
        <header
          className="lg:hidden flex items-center justify-between border-b border-gold-border bg-white px-4 py-3"
        >
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="rounded-lg p-2 text-secondary-text hover:bg-gold-border"
            aria-label="Open menu"
          >
            <Menu className="size-6" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-champagne-gold text-midnight-navy">
              <Cake className="size-4" aria-hidden="true" />
            </div>
            <span className="font-heading font-bold text-midnight-navy">
              Bluebell Bakehouse
            </span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg p-2 text-secondary-text hover:bg-gold-border"
            aria-label="Logout"
          >
            <LogOutIcon className="size-5" />
          </button>
        </header>

        <main className="flex-1 overflow-x-auto overflow-y-hidden bg-warm-ivory p-6 lg:p-8">
          {children}
        </main>
      </div>

      {/* Mobile drawer overlay */}
      {mobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-gold-border shadow-2xl transform transition-transform duration-300 lg:hidden">
            <div className="px-4 py-4 border-b border-gold-border">
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-champagne-gold text-midnight-navy">
                  <Cake className="size-4" aria-hidden="true" />
                </div>
                <span className="font-heading font-bold text-midnight-navy">
                  Bluebell Bakehouse
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="absolute right-3 top-3 rounded-lg p-1 text-secondary-text hover:bg-gold-border"
                aria-label="Close menu"
              >
                <X className="size-5" />
              </button>
            </div>
            <nav className="px-4 py-4 space-y-1" aria-label="Admin navigation">
              {renderNavLinks(true)}
            </nav>
          </div>
        </>
      )}
    </div>
  )
}

export { withAdminAuth }
