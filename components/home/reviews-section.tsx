'use client'

import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Section, SectionHeading } from '@/components/section-heading'
import { StarRow } from '@/components/product/product-meta'
import { useTestimonials } from '@/hooks/use-api'

export function ReviewsSection() {
  const { data, isLoading } = useTestimonials()

  return (
    <Section labelledBy="reviews-title">
      <SectionHeading id="reviews-title" eyebrow="Reviews" title="What our customers say" />
      <ul className="grid gap-4 md:grid-cols-3">
        {isLoading
          ? Array.from({ length: 3 }, (_, i) => (
              <li key={i}>
                <Skeleton className="h-48 rounded-xl" />
              </li>
            ))
          : data?.map((t) => (
              <li key={t.id}>
                <Card className="h-full shadow-sm">
                  <CardContent className="flex flex-1 flex-col gap-3">
                    <StarRow value={t.rating} />
                    <blockquote className="leading-relaxed text-pretty text-foreground">
                      {`“${t.comment}”`}
                    </blockquote>
                  </CardContent>
                  <CardFooter className="flex-col items-start gap-0">
                    <p className="font-semibold">{t.name}</p>
                    <p className="text-sm text-muted-foreground">{t.location}</p>
                  </CardFooter>
                </Card>
              </li>
            ))}
      </ul>
    </Section>
  )
}
