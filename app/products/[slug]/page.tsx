import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getProducts } from '@/lib/api'
import { ProductDetailClient } from '@/components/product/product-detail-client'

interface ProductPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params

  try {
    const products = await getProducts()
    const product = products.find((p) => p.slug === slug)

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

  let products
  try {
    products = await getProducts()
  } catch {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <div className="rounded-2xl border bg-background p-10 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted text-3xl">
            ⚠️
          </div>

          <h1 className="mt-6 text-3xl font-semibold">
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

  const product = products.find((p) => p.slug === slug)

  if (!product) {
    notFound()
  }

  return <ProductDetailClient product={product} />
}
