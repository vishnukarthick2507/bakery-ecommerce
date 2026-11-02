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
      <ul className="grid gap-6 md:grid-cols-3">
        {isLoading
          ? Array.from({ length: 3 }, (_, i) => (
              <li key={i}>
                <Skeleton className="h-52 rounded-2xl" />
              </li>
            ))
          : data?.map((t) => (
              <li key={t.id}>
                <Card className="h-full border border-border rounded-2xl bg-card shadow-sm transition-shadow duration-200 hover:shadow-md">
                  <CardContent className="flex flex-1 flex-col gap-4 p-6 sm:p-8">
                    <StarRow value={t.rating} />
                    <blockquote className="leading-relaxed text-pretty text-muted-foreground">
                      {`“${t.comment}”`}
                    </blockquote>
                  </CardContent>
                  <CardFooter className="flex-col items-start gap-2 p-6 sm:p-8 border-t border-border">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground">{t.name}</p>
                      <span className="text-xs text-muted-foreground">·</span>
                      <p className="text-sm text-muted-foreground">{t.location}</p>
                    </div>
                  </CardFooter>
                </Card>
              </li>
            ))}
      </ul>
    </Section>
  )
}
