'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

import { withAdminAuth } from '@/components/admin/admin-auth'

type Availability =
  | 'AVAILABLE'
  | 'OUT_OF_STOCK'
  | 'DISABLED'

type Product = {
  _id: string
  name: string
  slug: string
  description: string
  price: number
  category: string
  images?: string[]
  stock: number
  availability: Availability
  preparationTime: number
  active: boolean
  createdAt: string
}

type ProductForm = {
  name: string
  slug: string
  description: string
  price: string
  category: string
  stock: string
  preparationTime: string
  availability: Availability
  image: string
}

const API_URL = ''

const emptyForm: ProductForm = {
  name: '',
  slug: '',
  description: '',
  price: '',
  category: 'Cakes',
  stock: '0',
  preparationTime: '60',
  availability: 'AVAILABLE',
  image: '',
}

function formatAvailability(
  availability: Availability,
) {
  return availability
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    )
}

function createSlug(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function availabilityBadge(availability: Availability, active: boolean) {
  if (!active) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
        Disabled
      </span>
    )
  }
  const isAvailable = availability === 'AVAILABLE'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        isAvailable
          ? 'border-primary/20 bg-primary/10 text-primary'
          : 'border-border/50 bg-muted text-muted-foreground',
      )}
    >
      {formatAvailability(availability)}
    </span>
  )
}

function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] =
    useState<Product | null>(null)

  const [form, setForm] =
    useState<ProductForm>(emptyForm)

  const [saving, setSaving] = useState(false)

  const [updatingProduct, setUpdatingProduct] =
    useState<string | null>(null)

  async function fetchProducts() {
    try {
      setLoading(true)
      setError('')

      const response = await fetch(
        '/api/products?includeInactive=true',
        {
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('admin-token')}`,
          },
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.message ||
            'Unable to fetch products',
        )
      }

      const fetchedProducts = data as Product[]
      setProducts(fetchedProducts)
      setCategories(
        Array.from(new Set(fetchedProducts.map((product) => product.category)))
          .sort((first, second) => first.localeCompare(second)),
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load products',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProducts()
  }, [])

  function openAddForm() {
    setEditingProduct(null)
    setForm(emptyForm)
    setShowForm(true)
    setError('')
  }

  function openEditForm(product: Product) {
    setEditingProduct(product)

    setForm({
      name: product.name,
      slug: product.slug,
      description: product.description,
      price: String(product.price),
      category: product.category,
      stock: String(product.stock),
      preparationTime: String(
        product.preparationTime,
      ),
      availability: product.availability,
      image: product.images?.[0] ?? '',
    })

    setShowForm(true)
    setError('')
  }

  function closeForm() {
    if (saving) return

    setShowForm(false)
    setEditingProduct(null)
    setForm(emptyForm)
  }

  function updateForm(
    field: keyof ProductForm,
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  async function saveProduct(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    try {
      setSaving(true)
      setError('')

      const price = Number(form.price)
      const stock = Number(form.stock)
      const preparationTime = Number(
        form.preparationTime,
      )

      if (!form.name.trim()) {
        throw new Error(
          'Product name is required',
        )
      }

      if (!form.description.trim()) {
        throw new Error(
          'Product description is required',
        )
      }

      if (!Number.isFinite(price) || price <= 0) {
        throw new Error(
          'Price must be greater than 0',
        )
      }

      if (
        !Number.isInteger(stock) ||
        stock < 0
      ) {
        throw new Error(
          'Stock must be a whole number greater than or equal to 0',
        )
      }

      if (
        !Number.isFinite(preparationTime) ||
        preparationTime < 0
      ) {
        throw new Error(
          'Preparation time must be 0 or greater',
        )
      }

      const slug =
        form.slug.trim() ||
        createSlug(form.name)

      const payload = {
        name: form.name.trim(),
        slug,
        description:
          form.description.trim(),
        price,
        category:
          form.category.trim(),
        stock,
        preparationTime,
        availability:
          form.availability,
        ...(editingProduct
          ? {}
          : { active: true }),
        ...(form.image.trim()
          ? {
              images: [
                form.image.trim(),
              ],
            }
          : {
              images: [],
            }),
      }

      const response = await fetch(
        editingProduct
          ? `/api/products/${editingProduct._id}`
          : '/api/products',
        {
          method: editingProduct
            ? 'PATCH'
            : 'POST',
          headers: {
            'Content-Type':
              'application/json',
            Authorization: `Bearer ${localStorage.getItem('admin-token')}`,
          },
          body: JSON.stringify(payload),
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.message ||
            'Unable to save product',
        )
      }

      if (editingProduct) {
        setProducts((current) =>
          current.map((product) =>
            product._id ===
            editingProduct._id
              ? data.product
              : product,
          ),
        )
      } else {
        setProducts((current) => [
          data.product,
          ...current,
        ])
      }

      closeForm()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to save product',
      )
    } finally {
      setSaving(false)
    }
  }

  async function updateStock(
    productId: string,
    stock: number,
  ) {
    try {
      setUpdatingProduct(productId)
      setError('')

      const response = await fetch(
        `/api/products/${productId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type':
              'application/json',
            Authorization: `Bearer ${localStorage.getItem('admin-token')}`,
          },
          body: JSON.stringify({
            stock,
          }),
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.message ||
            'Unable to update stock',
        )
      }

      setProducts((current) =>
        current.map((product) =>
          product._id === productId
            ? data.product
            : product,
        ),
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update stock',
      )
    } finally {
      setUpdatingProduct(null)
    }
  }

  async function updateAvailability(
    productId: string,
    availability: Availability,
  ) {
    try {
      setUpdatingProduct(productId)
      setError('')

      const response = await fetch(
        `/api/products/${productId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type':
              'application/json',
            Authorization: `Bearer ${localStorage.getItem('admin-token')}`,
          },
          body: JSON.stringify({
            availability,
          }),
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.message ||
            'Unable to update availability',
        )
      }

      setProducts((current) =>
        current.map((product) =>
          product._id === productId
            ? data.product
            : product,
        ),
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update availability',
      )
    } finally {
      setUpdatingProduct(null)
    }
  }

  async function setProductActive(
    productId: string,
    active: boolean,
  ) {
    try {
      setUpdatingProduct(productId)
      setError('')

      const response = await fetch(
        `${API_URL}/api/products/${productId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type':
              'application/json',
            Authorization: `Bearer ${localStorage.getItem('admin-token')}`,
          },
          body: JSON.stringify(
            active
              ? {
                  active: true,
                  availability:
                    'AVAILABLE',
                }
              : {
                  active: false,
                  availability:
                    'DISABLED',
                },
          ),
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.message ||
            (active
              ? 'Unable to enable product'
              : 'Unable to disable product'),
        )
      }

      setProducts((current) =>
        current.map((product) =>
          product._id === productId
            ? data.product
            : product,
        ),
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update product',
      )
    } finally {
      setUpdatingProduct(null)
    }
  }

  return (
    <main className="min-h-screen bg-muted/20">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-medium text-primary">
              S.V. Bakery Admin
            </p>

            <Link
              href="/admin"
              className="text-sm text-muted-foreground hover:underline"
            >
              ← Back to Dashboard
            </Link>

            <h1 className="mt-3 text-3xl font-bold text-primary">
              Products
            </h1>

            <p className="mt-2 text-muted-foreground">
              Manage products, prices, stock and availability.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={fetchProducts}
              disabled={loading}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
            >
              {loading
                ? 'Refreshing...'
                : 'Refresh'}
            </button>

            <button
              type="button"
              onClick={openAddForm}
              className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              + Add Product
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Add / Edit form */}
        {showForm && (
          <section className="mt-8 rounded-xl border border-border bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-primary">
                  {editingProduct
                    ? 'Edit Product'
                    : 'Add Product'}
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  {editingProduct
                    ? 'Update this product and save the changes to MongoDB.'
                    : 'Create a new bakery product in MongoDB.'}
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-60"
              >
                Cancel
              </button>
            </div>

            <form
              onSubmit={saveProduct}
              className="mt-8 grid gap-5 md:grid-cols-2"
            >
              {/* Name */}
              <div>
                <label className="text-sm font-medium text-foreground">
                  Product Name *
                </label>

                <input
                  value={form.name}
                  onChange={(event) => {
                    const name =
                      event.target.value

                    setForm((current) => ({
                      ...current,
                      name,
                      slug:
                        editingProduct
                          ? current.slug
                          : createSlug(name),
                    }))
                  }}
                  placeholder="Red Velvet Cake"
                  className="mt-2 w-full rounded-lg border border-border bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              {/* Slug */}
              <div>
                <label className="text-sm font-medium text-foreground">
                  Slug *
                </label>

                <input
                  value={form.slug}
                  onChange={(event) =>
                    updateForm(
                      'slug',
                      event.target.value,
                    )}
                  placeholder="red-velvet-cake"
                  className="mt-2 w-full rounded-lg border border-border bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              {/* Price */}
              <div>
                <label className="text-sm font-medium text-foreground">
                  Price (₹) *
                </label>

                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.price}
                  onChange={(event) =>
                    updateForm(
                      'price',
                      event.target.value,
                    )}
                  placeholder="750"
                  className="mt-2 w-full rounded-lg border border-border bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              {/* Category */}
              <div>
                <label className="text-sm font-medium text-foreground">
                  Category *
                </label>

                <select
                  value={form.category}
                  onChange={(event) =>
                    updateForm(
                      'category',
                      event.target.value,
                    )}
                  className="mt-2 w-full rounded-lg border border-border bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-primary"
                >
                  {(categories.includes(
                    form.category,
                  )
                    ? categories
                    : [
                        form.category,
                        ...categories,
                      ])
                  .map((category) => (
                    <option
                      key={category}
                      value={category}
                    >
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              {/* Stock */}
              <div>
                <label className="text-sm font-medium text-foreground">
                  Stock *
                </label>

                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.stock}
                  onChange={(event) =>
                    updateForm(
                      'stock',
                      event.target.value,
                    )}
                  placeholder="10"
                  className="mt-2 w-full rounded-lg border border-border bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              {/* Preparation */}
              <div>
                <label className="text-sm font-medium text-foreground">
                  Preparation Time (minutes) *
                </label>

                <input
                  type="number"
                  min="0"
                  step="1"
                  value={
                    form.preparationTime
                  }
                  onChange={(event) =>
                    updateForm(
                      'preparationTime',
                      event.target.value,
                    )}
                  placeholder="120"
                  className="mt-2 w-full rounded-lg border border-border bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              {/* Availability */}
              <div>
                <label className="text-sm font-medium text-foreground">
                  Availability *
                </label>

                <select
                  value={form.availability}
                  onChange={(event) =>
                    updateForm(
                      'availability',
                      event.target.value,
                    )}
                  className="mt-2 w-full rounded-lg border border-border bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="AVAILABLE">
                    Available
                  </option>

                  <option value="OUT_OF_STOCK">
                    Out of Stock
                  </option>

                  <option value="DISABLED">
                    Disabled
                  </option>
                </select>
              </div>

              {/* Image URL */}
              <div>
                <label className="text-sm font-medium text-foreground">
                  Image URL
                </label>

                <input
                  type="url"
                  value={form.image}
                  onChange={(event) =>
                    updateForm(
                      'image',
                      event.target.value,
                    )}
                  placeholder="https://..."
                  className="mt-2 w-full rounded-lg border border-border bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Description */}
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-foreground">
                  Description *
                </label>

                <textarea
                  value={form.description}
                  onChange={(event) =>
                    updateForm(
                      'description',
                      event.target.value,
                    )}
                  placeholder="Rich, moist red velvet cake with cream cheese frosting."
                  rows={4}
                  className="mt-2 w-full resize-none rounded-lg border border-border bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-3 md:col-span-2">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="rounded-lg border border-border px-6 py-3 font-medium hover:bg-muted disabled:opacity-60"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving
                    ? 'Saving...'
                    : editingProduct
                      ? 'Save Changes'
                      : 'Create Product'}
                </button>
              </div>
            </form>
          </section>
        )}

        {/* Loading */}
        {loading && (
          <div className="mt-8 rounded-xl border border-border p-10 text-center">
            Loading products...
          </div>
        )}

        {/* Empty */}
        {!loading &&
          !error &&
          products.length === 0 && (
            <div className="mt-8 rounded-xl border border-border p-10 text-center shadow-sm">
              <h2 className="text-xl font-semibold text-primary">
                No products found
              </h2>

              <p className="mt-2 text-muted-foreground">
                Add your first bakery product.
              </p>
            </div>
          )
        }

        {/* Products */}
        {!loading &&
          products.length > 0 && (
            <div className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {products.map((product) => (
                <section
                  key={product._id}
                  className="rounded-xl border border-border bg-white p-6 shadow-sm"
                >
                  <div className="border-b border-border pb-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-xl font-bold text-primary">
                          {product.name}
                        </h2>

                        <p className="mt-1 text-sm text-muted-foreground">
                          {product.category}
                        </p>
                      </div>

                      {availabilityBadge(product.availability, product.active)}
                    </div>
                  </div>

                  <div className="space-y-4 py-5">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Price
                      </p>

                      <p className="mt-1 text-2xl font-bold text-primary">
                        ₹
                        {product.price.toLocaleString(
                          'en-IN',
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-muted-foreground">
                        Preparation
                      </p>

                      <p className="mt-1 font-medium">
                        {product.preparationTime}{' '}
                        minutes
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-muted-foreground">
                        Product ID
                      </p>

                      <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                        {product._id}
                      </p>
                    </div>
                  </div>

                  {/* Stock */}
                  <div className="border-t border-border pt-5">
                    <label
                      htmlFor={`stock-${product._id}`}
                      className="text-sm font-medium text-foreground"
                    >
                      Stock
                    </label>

                    <div className="mt-2 flex gap-2">
                      <input
                        id={`stock-${product._id}`}
                        type="number"
                        min="0"
                        step="1"
                        defaultValue={
                          product.stock
                        }
                        disabled={
                          updatingProduct ===
                          product._id
                        }
                        className="w-full rounded-lg border border-border bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
                        onKeyDown={(event) => {
                          if (
                            event.key !==
                            'Enter'
                          ) {
                            return
                          }

                          const value =
                            Number(
                              (
                                event.target as HTMLInputElement
                              ).value,
                            )

                          if (
                            Number.isInteger(
                              value,
                            ) &&
                            value >= 0
                          ) {
                            updateStock(
                              product._id,
                              value,
                            )
                          }
                        }}
                      />

                      <button
                        type="button"
                        disabled={
                          updatingProduct ===
                          product._id
                        }
                        onClick={(event) => {
                          const input =
                            event.currentTarget
                              .previousElementSibling as HTMLInputElement

                          const value =
                            Number(
                              input.value,
                            )

                          if (
                            Number.isInteger(
                              value,
                            ) &&
                            value >= 0
                          ) {
                            updateStock(
                              product._id,
                              value,
                            )
                          }
                        }}
                        className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
                      >
                        Save
                      </button>
                    </div>
                  </div>

                  {/* Availability */}
                  <div className="mt-5">
                    <label
                      htmlFor={`availability-${product._id}`}
                      className="text-sm font-medium text-foreground"
                    >
                      Availability
                    </label>

                    <select
                      id={`availability-${product._id}`}
                      value={
                        product.availability
                      }
                      disabled={
                        updatingProduct ===
                        product._id
                      }
                      onChange={(event) =>
                        updateAvailability(
                          product._id,
                          event.target
                            .value as Availability,
                        )}
                      className="mt-2 w-full rounded-lg border border-border bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
                    >
                      <option value="AVAILABLE">
                        Available
                      </option>

                      <option value="OUT_OF_STOCK">
                        Out of Stock
                      </option>

                      <option value="DISABLED">
                        Disabled
                      </option>
                    </select>
                  </div>

                  {/* Edit */}
                  <button
                    type="button"
                    onClick={() =>
                      openEditForm(product)
                    }
                    className="mt-5 w-full rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground hover:opacity-90"
                  >
                    Edit Product
                  </button>

                  {/* Disable / Enable */}
                  {product.active ? (
                    <button
                      type="button"
                      disabled={
                        updatingProduct ===
                        product._id
                      }
                      onClick={() =>
                        setProductActive(
                          product._id,
                          false,
                        )
                      }
                      className="mt-3 w-full rounded-lg border border-destructive/30 px-4 py-3 font-medium text-destructive hover:bg-destructive/5 disabled:opacity-60"
                    >
                      Disable Product
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={
                        updatingProduct ===
                        product._id
                      }
                      onClick={() =>
                        setProductActive(
                          product._id,
                          true,
                        )
                      }
                      className="mt-3 w-full rounded-lg border border-primary px-4 py-3 font-medium text-primary hover:bg-primary/5 disabled:opacity-60"
                    >
                      Enable Product
                    </button>
                  )}

                  {updatingProduct ===
                    product._id && (
                    <p className="mt-3 text-sm text-muted-foreground">
                      Updating product...
                    </p>
                  )}
                </section>
              ))}
            </div>
          )}
      </div>
    </main>
  )
}

export default withAdminAuth(AdminProductsPage)
