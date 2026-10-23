import type { Metadata } from 'next'
import { PageHeader } from '@/components/page-header'
import { ContactBlock } from '@/components/contact/contact-block'

export const metadata: Metadata = {
  title: 'Contact Us',
  description: 'Get in touch with The Cake Point, Chromepet, Chennai.',
}

export default function ContactPage() {
  return (
    <>
      <PageHeader
        title="Contact Us"
        description="We'd love to hear from you."
        breadcrumbs={[
          { href: '/', label: 'Home' },
          { label: 'Contact' },
        ]}
      />

      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <ContactBlock />
      </main>
    </>
  )
}
