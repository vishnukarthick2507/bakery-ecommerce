import type { Metadata } from 'next'
import { PageHeader } from '@/components/page-header'
import { CustomCakeForm } from '@/components/custom-cake/custom-cake-form'

export const metadata: Metadata = {
  title: 'Custom Cakes',
  description:
    'Design a custom celebration cake with S.V. Bakery, Chromepet, Chennai.',
}

export default function CustomCakePage() {
  return (
    <>
      <PageHeader
        title="Custom Cakes"
        description="Tell us about your celebration and we'll design the cake around it."
        breadcrumbs={[
          { href: '/', label: 'Home' },
          { label: 'Custom Cakes' },
        ]}
      />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <CustomCakeForm />
      </main>
    </>
  )
}
