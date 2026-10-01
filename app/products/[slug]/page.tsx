import type { Metadata } from 'next'
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
}

export default async function ProductPage({
  params,
}: ProductPageProps) {
  const { slug } = await params
  const products = await getProducts()
  const product = products.find((p) => p.slug === slug)

  if (!product) {
    notFound()
  }

  return <ProductDetailClient product={product} />
}