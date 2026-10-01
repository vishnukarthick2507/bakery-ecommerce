import type { Metadata } from 'next'
import { PageHeader } from '@/components/page-header'

export const metadata: Metadata = {
  title: 'About Us',
  description: 'Learn more about Bluebell Bakehouse.',
}

export default function AboutPage() {
  return (
    <>
      <PageHeader
        title="About Bluebell Bakehouse"
        description="Freshly baked with care, every day."
        breadcrumbs={[
          { href: '/', label: 'Home' },
          { label: 'About' },
        ]}
      />

      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 md:grid-cols-2">
          <section className="rounded-2xl border bg-background p-6 sm:p-8">
            <h2 className="text-2xl font-semibold">
              Our Story
            </h2>

            <p className="mt-4 leading-7 text-muted-foreground">
              Bluebell Bakehouse is a neighbourhood bakery creating
              fresh cakes, breads, pastries, brownies and celebration
              cakes with carefully selected ingredients.
            </p>

            <p className="mt-4 leading-7 text-muted-foreground">
              From everyday treats to special occasions, our goal is
              to make every order fresh, delicious and memorable.
            </p>
          </section>

          <section className="rounded-2xl border bg-background p-6 sm:p-8">
            <h2 className="text-2xl font-semibold">
              What We Believe
            </h2>

            <div className="mt-5 space-y-4">
              <div>
                <h3 className="font-semibold">Fresh Every Day</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  We focus on freshly prepared bakery products.
                </p>
              </div>

              <div>
                <h3 className="font-semibold">Quality Ingredients</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  We aim to use quality ingredients in everything we bake.
                </p>
              </div>

              <div>
                <h3 className="font-semibold">Made for You</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  From simple cakes to custom celebrations, every order
                  deserves care and attention.
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  )
}