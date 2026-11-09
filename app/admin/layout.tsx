import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { absolute: 'Bluebell Bakehouse Admin' },
}

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>
}
