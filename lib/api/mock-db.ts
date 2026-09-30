import { seedOrders, seedUser } from '@/lib/mock-data'
import type { CustomCakeRequest, Order, User } from '@/lib/types'

/**
 * Temporary persistence for the mock API layer only.
 * Replace the functions in `lib/api/index.ts` with real backend calls and delete this file.
 */

type StoredUser = User & { password: string }

interface MockDb {
  users: StoredUser[]
  orders: Order[]
  cakeRequests: Array<CustomCakeRequest & { id: string; createdAt: string }>
  sessionUserId: string | null
}

const STORAGE_KEY = 'bluebell-mock-db-v1'

const initialDb = (): MockDb => ({
  users: [structuredClone(seedUser)],
  orders: structuredClone(seedOrders),
  cakeRequests: [],
  sessionUserId: null,
})

let memoryDb: MockDb | null = null

export function readDb(): MockDb {
  if (typeof window === 'undefined') {
    memoryDb ??= initialDb()
    return memoryDb
  }
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    const db = initialDb()
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
    return db
  }
  try {
    return JSON.parse(raw) as MockDb
  } catch {
    return initialDb()
  }
}

export function writeDb(db: MockDb) {
  if (typeof window === 'undefined') {
    memoryDb = db
    return
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
}
