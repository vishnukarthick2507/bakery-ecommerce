'use client'

import { useState } from 'react'
import { CheckIcon, CopyIcon, TicketPercentIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Section, SectionHeading } from '@/components/section-heading'
import { useOffers } from '@/hooks/use-api'

export function OffersSection() {
  const { data, isLoading } = useOffers()
  const [copied, setCopied] = useState<string | null>(null)

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(code)
      toast.success(`Code ${code} copied`)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      toast.error('Could not copy. Please note the code manually.')
    }
  }

  return (
    <Section labelledBy="offers-title" className="bg-cream">
      <SectionHeading id="offers-title" eyebrow="Offers" title="Current offers" description="Apply these codes at checkout." />
      <ul className="grid gap-4 md:grid-cols-3">
        {isLoading
          ? Array.from({ length: 3 }, (_, i) => (
              <li key={i}>
                <Skeleton className="h-44 rounded-xl" />
              </li>
            ))
          : data?.map((offer) => (
              <li key={offer.code}>
                <Card className="h-full border-dashed shadow-sm">
                  <CardHeader>
                    <div className="mb-1 flex size-10 items-center justify-center rounded-xl bg-caramel/20 text-caramel-foreground">
                      <TicketPercentIcon className="size-5" aria-hidden="true" />
                    </div>
                    <CardTitle className="font-heading text-xl">{offer.title}</CardTitle>
                    <CardDescription>{offer.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1" />
                  <CardFooter className="justify-between gap-2">
                    <code className="rounded-md bg-secondary px-2.5 py-1 font-mono text-sm font-semibold text-primary">
                      {offer.code}
                    </code>
                    <Button variant="outline" size="sm" onClick={() => copy(offer.code)}>
                      {copied === offer.code ? <CheckIcon data-icon="inline-start" /> : <CopyIcon data-icon="inline-start" />}
                      {copied === offer.code ? 'Copied' : 'Copy code'}
                    </Button>
                  </CardFooter>
                </Card>
              </li>
            ))}
      </ul>
    </Section>
  )
}
