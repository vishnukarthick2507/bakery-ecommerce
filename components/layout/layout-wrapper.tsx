'use client'

import { usePathname } from 'next/navigation'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { MobileBottomBar } from '@/components/layout/mobile-bottom-bar'

export function LayoutWrapper({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname()
  const isAdminRoute = pathname.startsWith('/admin')

  return (
    <>
      {!isAdminRoute && <SiteHeader />}
      {children}
      {!isAdminRoute && (
        <div className="pb-20 md:pb-0 bg-primary">
          <SiteFooter />
        </div>
      )}
      {!isAdminRoute && <MobileBottomBar />}
    </>
  )
}
