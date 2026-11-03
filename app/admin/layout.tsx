import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { absolute: 'S.V. Bakery Admin' },
}

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen bg-cream/30">
      {children}
    </div>
  )
}