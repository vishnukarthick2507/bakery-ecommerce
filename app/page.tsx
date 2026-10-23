import { Hero } from '@/components/home/hero'
import { CategoriesSection } from '@/components/home/categories-section'
import { AvailableNowRail } from '@/components/home/product-rail'
import { CustomCakeSection } from '@/components/home/custom-cake-section'
import { ContactBlock } from '@/components/contact/contact-block'
import { Section, SectionHeading } from '@/components/section-heading'
import { getCategories } from '@/lib/api'

export default async function HomePage() {
  const categories = await getCategories()

  return (
    <>
      <Hero />
      <CategoriesSection categories={categories} />
      <AvailableNowRail
        id="fresh-title"
        eyebrow="Freshly available"
        title="Out of the oven, ready to go"
        description="Available for immediate pickup or delivery."
        href="/products?availability=AVAILABLE_NOW"
        emptyTitle="Nothing on the shelf right now"
        emptyDescription="Our next batch is in the oven. Pre-order to reserve yours."
      />
      <CustomCakeSection />
      <Section labelledBy="contact-title" className="bg-secondary">
        <SectionHeading id="contact-title" eyebrow="Visit us" title="Find the bakery" />
        <ContactBlock />
      </Section>
    </>
  )
}
