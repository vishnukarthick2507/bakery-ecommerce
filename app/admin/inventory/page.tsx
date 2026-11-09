'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { withAdminAuth } from '@/components/admin/admin-auth'
import AdminLayout from '@/components/admin/admin-layout'

type Product = {
  _id: string
  name: string
  category: string
  stock: number
  availability: 'AVAILABLE' | 'OUT_OF_STOCK' | 'DISABLED'
  active: boolean
}

function AdminInventoryPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [stockDrafts, setStockDrafts] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [movementsTab, setMovementsTab] = useState<'stock' | 'movements'>('stock')
  const [movements, setMovements] = useState<Array<{
    id: string
    productId: string
    productName: string
    quantityChange: number
    previousStock: number
    newStock: number
    reason: string
    relatedOrderId: string | null
    relatedUserId: string | null
    createdAt: string
  }>>([])
  const [movementsLoading, setMovementsLoading] = useState(false)
  const [movementsError, setMovementsError] = useState('')

  async function fetchProducts() {
    try {
      setLoading(true)
      setError('')
      const response = await fetch('/api/products?includeInactive=true', {
        cache: 'no-store',
        credentials: 'include',
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.message || 'Unable to fetch inventory')
      }
      setProducts(data)
      setStockDrafts(
        Object.fromEntries(data.map((product: Product) => [product._id, String(product.stock)])),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load inventory')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProducts()
  }, [])

  useEffect(() => {
    if (movementsTab === 'movements') {
      fetchMovements()
    }
  }, [movementsTab])

  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    return products.filter((product) =>
      `${product.name} ${product.category}`.toLowerCase().includes(normalizedSearch),
    )
  }, [products, search])

  async function saveStock(product: Product) {
    const nextStock = Number(stockDrafts[product._id])
    if (!Number.isInteger(nextStock) || nextStock < 0) {
      setError('Stock must be a whole number greater than or equal to zero.')
      return
    }

    const availability = product.availability === 'DISABLED'
      ? 'DISABLED'
      : nextStock === 0
        ? 'OUT_OF_STOCK'
        : 'AVAILABLE'

    try {
      setSavingId(product._id)
      setError('')
      setMessage('')
      const response = await fetch(`/api/products/${encodeURIComponent(product._id)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ stock: nextStock, availability }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.message || 'Unable to update stock')
      }

      setProducts((current) => current.map((item) =>
        item._id === product._id ? data.product : item,
      ))
      setMessage(`${product.name} inventory updated.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update stock')
    } finally {
      setSavingId(null)
    }
  }

  async function fetchMovements() {
    try {
      setMovementsLoading(true)
      setMovementsError('')
      const response = await fetch('/api/admin/inventory/movements', {
        cache: 'no-store',
        credentials: 'include',
      })
      if (!response.ok) {
        throw new Error('Unable to fetch inventory movements')
      }
      const data = await response.json()
      setMovements(data.movements ?? [])
    } catch (err) {
      setMovementsError(err instanceof Error ? err.message : 'Unable to fetch movements')
    } finally {
      setMovementsLoading(false)
    }
  }

  return (
    <AdminLayout>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-sm font-medium text-primary">Bluebell Bakehouse Admin</p>
        <Link href="/admin" className="mt-2 inline-block text-sm text-muted-foreground hover:underline">
          ← Back to Dashboard
        </Link>
        <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-3xl font-bold text-primary">Inventory</h1>
            <p className="mt-2 text-muted-foreground">
              Stock and availability are saved to the shared product catalogue.
            </p>
          </div>
          <div className="flex gap-2">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search products"
              aria-label="Search products"
              className="h-11 rounded-lg border border-border bg-white px-3 outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="button"
              onClick={fetchProducts}
              disabled={loading}
              className="h-11 rounded-lg border border-border bg-white px-4 text-sm font-medium hover:bg-muted disabled:opacity-60"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setMovementsTab('movements')}
              className="h-11 rounded-lg border border-border bg-white px-4 text-sm font-medium hover:bg-muted"
            >
              Movement History
            </button>
            <Link
              href="/"
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              View Store
            </Link>
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" role="alert">
            {error}
          </div>
        )}
        {message && (
          <p className="mt-4 text-sm text-primary" role="status">{message}</p>
        )}

        {loading ? (
          <div className="mt-8 rounded-xl border border-border p-10 text-center">Loading inventory...</div>
        ) : !error && filteredProducts.length === 0 ? (
          <div className="mt-8 rounded-xl border border-border p-10 text-center shadow-sm">
            <h2 className="text-xl font-semibold text-primary">No matching products</h2>
          </div>
        ) : !error ? (
          <div className="mt-8 divide-y divide-border rounded-xl border border-border bg-white shadow-sm">
            {filteredProducts.map((product) => {
              const outOfStock = product.stock <= 0 || product.availability === 'OUT_OF_STOCK'
              return (
                <article key={product._id} className="grid items-center gap-4 p-5 sm:grid-cols-[1fr_auto_auto_auto]">
                  <div>
                    <h2 className="font-semibold text-primary">{product.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{product.category}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {!product.active || product.availability === 'DISABLED'
                        ? 'Disabled'
                        : outOfStock
                          ? 'Out of stock'
                          : 'In stock'}
                    </p>
                  </div>
                  <p className="text-sm">
                    <span className="block text-muted-foreground">Current stock</span>
                    <span className="mt-1 block font-semibold text-primary">{product.stock}</span>
                  </p>
                  <label className="grid gap-1 text-sm font-medium">
                    Set stock
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={stockDrafts[product._id] ?? ''}
                      onChange={(event) => setStockDrafts((current) => ({
                        ...current,
                        [product._id]: event.target.value,
                      }))}
                      className="h-10 w-28 rounded-lg border border-border bg-white px-3 outline-none focus:ring-2 focus:ring-primary"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => saveStock(product)}
                    disabled={savingId === product._id || Number(stockDrafts[product._id]) === product.stock}
                    className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    {savingId === product._id ? 'Saving...' : 'Save'}
                  </button>
                </article>
              )
            })}
          </div>
        ) : null}

        {/* Inventory Movements Tab */}
        {movementsTab === 'movements' && (
          <div className="mt-10 rounded-xl border border-border bg-white shadow-sm">
            <div className="flex items-center justify-between p-6">
              <h2 className="text-xl font-bold text-primary">Inventory Movement History</h2>
              <button
                type="button"
                onClick={() => setMovementsTab('stock')}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-caramel hover:bg-cream/50 transition-colors"
              >
                ← Back to Stock
              </button>
            </div>
            {movementsLoading && (
              <div className="p-10 text-center">
                Loading movement history...
              </div>
            )}
            {movementsError && (
              <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" role="alert">
                {movementsError}
              </div>
            )}
            {!movementsLoading && !movementsError && movements.length === 0 && (
              <div className="p-10 text-center text-muted-foreground">
                No inventory movements recorded yet.
              </div>
            )}
            {!movementsLoading && !movementsError && movements.length > 0 && (
              <div className="divide-y divide-border">
                {movements.map((m) => (
                  <article key={m.id} className="p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="font-semibold text-primary">{m.productName}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {m.quantityChange > 0 ? '+' : ''}{m.quantityChange} units
                      </p>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <span className="block">Reason: {m.reason.replaceAll('_', ' ')}</span>
                      {m.relatedOrderId && (
                        <span className="block">Order: {m.relatedOrderId}</span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <span className="block">
                        Stock: {m.previousStock} → {m.newStock}
                      </span>
                      <span className="block">
                        {new Date(m.createdAt).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}

export default withAdminAuth(AdminInventoryPage)
