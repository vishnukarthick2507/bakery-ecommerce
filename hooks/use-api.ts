'use client'

import useSWR from 'swr'
import {
  getAvailableNow,
  getOffers,
  getProducts,
  getProductsByTag,
  getTestimonials,
} from '@/lib/api'
import type { Product, ProductFilters } from '@/lib/types'

export function useProducts(filters: ProductFilters) {
  return useSWR(['products', JSON.stringify(filters)], () => getProducts(filters), {
    keepPreviousData: true,
  })
}

export function useTaggedProducts(tag: Product['tags'][number]) {
  return useSWR(['products-tag', tag], () => getProductsByTag(tag))
}

export function useAvailableNow() {
  return useSWR('products-available-now', getAvailableNow)
}

export function useOffers() {
  return useSWR('offers', getOffers)
}

export function useTestimonials() {
  return useSWR('testimonials', getTestimonials)
}
