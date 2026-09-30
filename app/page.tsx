import { Hero } from '@/components/home/hero'
import { CategoriesSection } from '@/components/home/categories-section'
import { AvailableNowRail, TaggedRail } from '@/components/home/product-rail'
import { CustomCakeSection } from '@/components/home/custom-cake-section'
import { OffersSection } from '@/components/home/offers-section'
import { ReviewsSection } from '@/components/home/reviews-section'
import { ContactBlock } from '@/components/contact/contact-block'
import { Section, SectionHeading } from '@/components/section-heading'
import { getCategories } from '@/lib/api'

export default async function HomePage() {
  const categories = await getCategories()

  return (
    <>
      <Hero />
      <CategoriesSection categories={categories} />
      <TaggedRail
        tag="bestseller"
        id="bestsellers-title"
        eyebrow="Best sellers"
        title="Customer favourites"
        description="The bakes our regulars order again and again."
        href="/products?sort=popular"
        emptyTitle="No best sellers yet"
        emptyDescription="Check back soon — we're still counting the votes."
      />
      <TaggedRail
        tag="special"
        id="specials-title"
        eyebrow="Today's specials"
        title="Baked specially for today"
        description="Limited batches from our pastry chef. Once they're gone, they're gone."
        href="/products"
        className="bg-secondary"
        emptyTitle="No specials today"
        emptyDescription="Our chef is planning tomorrow's menu. Browse the full range meanwhile."
      />
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
      <OffersSection />
      <ReviewsSection />
      <Section labelledBy="contact-title" className="bg-secondary">
        <SectionHeading id="contact-title" eyebrow="Visit us" title="Find the bakery" />
        <ContactBlock />
      </Section>
    </>
  )
}
