'use client';

import { useEffect, useState } from 'react';
import { CinematicIntro } from '@/components/home/cinematic-intro'
import { Hero } from '@/components/home/hero'
import { CategoriesSection } from '@/components/home/categories-section'
import { AvailableNowRail } from '@/components/home/product-rail'
import { OffersSection } from '@/components/home/offers-section'
import { ReviewsSection } from '@/components/home/reviews-section'
import { CustomCakeSection } from '@/components/home/custom-cake-section'
import { BrandStorySection } from '@/components/home/brand-story-section'
import { NewsletterSection } from '@/components/home/newsletter-section'
import { ContactBlock } from '@/components/contact/contact-block'
import { Section, SectionHeading } from '@/components/section-heading'
import { getCategories } from '@/lib/api'

export default function HomePage() {
  const [categories, setCategories] = useState<Array<{ slug: string; value: string; name: string; description: string; image: string }>>([])
  const [introComplete, setIntroComplete] = useState(false)

  useEffect(() => {
    getCategories().then(cats => setCategories(cats))
  }, [])

  return (
    <>
      <CinematicIntro onComplete={() => setIntroComplete(true)} />
      {introComplete && (
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
          <BrandStorySection />
          <OffersSection />
          <ReviewsSection />
          <CustomCakeSection />
          <NewsletterSection />
          <Section labelledBy="contact-title" className="bg-primary">
            <SectionHeading id="contact-title" eyebrow="Visit us" title="Find the bakery" />
            <ContactBlock />
          </Section>
        </>
      )}
    </>
  )
}
