'use client'

import useSWR from 'swr'
import {
  getAvailableNow,
  getCurrentUser,
  getMyOrders,
  getOffers,
  getOrder,
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

export function useSession() {
  return useSWR('session', getCurrentUser)
}

export function useMyOrders(enabled: boolean) {
  return useSWR(enabled ? 'my-orders' : null, getMyOrders)
}

export function useOrder(orderId: string | null) {
  return useSWR(orderId ? ['order', orderId] : null, () => getOrder(orderId!), {
    refreshInterval: 30000,
  })
}
