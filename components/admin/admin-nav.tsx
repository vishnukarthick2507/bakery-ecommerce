'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

type NavItem = {
  href: string
  label: string
}

const adminNavItems: NavItem[] = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/orders', label: 'Orders' },
  { href: '/admin/products', label: 'Products' },
  { href: '/admin/inventory', label: 'Inventory' },
  { href: '/admin/customers', label: 'Customers' },
  { href: '/admin/custom-cakes', label: 'Custom Cakes' },
  { href: '/admin/payments', label: 'Payments' },
  { href: '/admin/analytics', label: 'Analytics' },
  { href: '/admin/settings', label: 'Settings' },
]

const viewStoreItem: NavItem = { href: '/', label: 'View Store' }

const inactiveLink = 'rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-primary'
const activeLink = 'rounded-lg border border-primary bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground'

export default function AdminNav({ className }: { className?: string } = {}) {
  const pathname = usePathname()

  return (
    <nav
      className={cn('flex flex-wrap gap-2 justify-center', className)}
      aria-label="Admin navigation"
    >
      {adminNavItems.map((item) => {
        const isActive = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            className={isActive ? activeLink : inactiveLink}
          >
            {item.label}
          </Link>
        )
      })}
      <Link
        href={viewStoreItem.href}
        className={inactiveLink}
      >
        {viewStoreItem.label}
      </Link>
    </nav>
  )
}
