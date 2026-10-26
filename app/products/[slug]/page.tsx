import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getProductBySlug } from '@/lib/api'
import { ProductDetailClient } from '@/components/product/product-detail-client'

interface ProductPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params

  try {
    const product = await getProductBySlug(slug)

    if (!product) {
      return {
        title: 'Product Not Found',
      }
    }

    return {
      title: product.name,
      description: product.description,
    }
  } catch {
    return {
      title: 'Product Unavailable',
    }
  }
}

export default async function ProductPage({
  params,
}: ProductPageProps) {
  const { slug } = await params

  let product
  try {
    product = await getProductBySlug(slug)
  } catch {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <div className="rounded-xl border border-border bg-background p-10 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted text-3xl">
            ⚠️
          </div>

          <h1 className="mt-6 text-3xl font-semibold text-primary">
            Something went wrong
          </h1>

          <p className="mt-3 text-muted-foreground">
            We couldn&apos;t load this product right now.
            Please try again in a moment.
          </p>

          <Link
            href="/products"
            className="mt-7 inline-flex rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground hover:opacity-90"
          >
            Back to Products
          </Link>
        </div>
      </main>
    )
  }

  if (!product) {
    notFound()
  }

  return <ProductDetailClient product={product} />
}
