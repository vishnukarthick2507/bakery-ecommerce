import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { absolute: 'S.V. Bakery Admin' },
}

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children
}