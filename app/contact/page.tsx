import type { Metadata } from 'next'
import { PageHeader } from '@/components/page-header'

export const metadata: Metadata = {
  title: 'Contact Us',
  description: 'Get in touch with Bluebell Bakehouse.',
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

      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 md:grid-cols-2">
          <section className="rounded-2xl border bg-background p-6 sm:p-8">
            <h2 className="text-2xl font-semibold">
              Get in Touch
            </h2>

            <div className="mt-6 space-y-4">
              <div>
                <p className="font-semibold">Phone</p>
                <p className="text-muted-foreground">
                  Contact us for orders and enquiries.
                </p>
              </div>

              <div>
                <p className="font-semibold">Email</p>
                <p className="text-muted-foreground">
                  hello@bluebellbakehouse.com
                </p>
              </div>

              <div>
                <p className="font-semibold">Opening Hours</p>
                <p className="text-muted-foreground">
                  Monday – Sunday
                </p>
                <p className="text-muted-foreground">
                  9:00 AM – 9:00 PM
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border bg-background p-6 sm:p-8">
            <h2 className="text-2xl font-semibold">
              Visit Us
            </h2>

            <p className="mt-4 leading-7 text-muted-foreground">
              Visit Bluebell Bakehouse for freshly baked cakes,
              brownies, pastries, breads and other treats.
            </p>

            <div className="mt-6">
              <p className="font-semibold">Address</p>
              <p className="mt-1 text-muted-foreground">
                Bluebell Bakehouse
              </p>
              <p className="text-muted-foreground">
                Your bakery address will appear here.
              </p>
            </div>
          </section>
        </div>
      </main>
    </>
  )
}