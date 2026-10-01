'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

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

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:5000'

const categories = [
  'Cakes',
  'Brownies',
  'Cheesecakes',
  'Pastries',
  'Breads',
  'Cookies',
  'Cupcakes',
  'Savouries',
  'Sweets',
  'Ice Cream',
]

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

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
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
        `${API_URL}/api/products`,
        {
          cache: 'no-store',
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.message ||
            'Unable to fetch products',
        )
      }

      setProducts(data)
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
        active: true,
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
          ? `${API_URL}/api/products/${editingProduct._id}`
          : `${API_URL}/api/products`,
        {
          method: editingProduct
            ? 'PATCH'
            : 'POST',
          headers: {
            'Content-Type':
              'application/json',
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
        `${API_URL}/api/products/${productId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type':
              'application/json',
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
        `${API_URL}/api/products/${productId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type':
              'application/json',
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

  return (
    <main className="min-h-screen bg-muted/20">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <Link
              href="/admin"
              className="text-sm text-muted-foreground hover:underline"
            >
              ← Back to Dashboard
            </Link>

            <h1 className="mt-3 text-3xl font-bold">
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
              className="rounded-lg border bg-background px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
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
          <section className="mt-8 rounded-2xl border bg-background p-6 shadow-sm sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">
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
                className="rounded-lg border px-4 py-2 text-sm hover:bg-muted disabled:opacity-60"
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
                <label className="text-sm font-medium">
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
                  className="mt-2 w-full rounded-lg border bg-background px-4 py-3 outline-none focus:ring-2"
                  required
                />
              </div>

              {/* Slug */}
              <div>
                <label className="text-sm font-medium">
                  Slug *
                </label>

                <input
                  value={form.slug}
                  onChange={(event) =>
                    updateForm(
                      'slug',
                      event.target.value,
                    )
                  }
                  placeholder="red-velvet-cake"
                  className="mt-2 w-full rounded-lg border bg-background px-4 py-3 outline-none focus:ring-2"
                  required
                />
              </div>

              {/* Price */}
              <div>
                <label className="text-sm font-medium">
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
                    )
                  }
                  placeholder="750"
                  className="mt-2 w-full rounded-lg border bg-background px-4 py-3 outline-none focus:ring-2"
                  required
                />
              </div>

              {/* Category */}
              <div>
                <label className="text-sm font-medium">
                  Category *
                </label>

                <select
                  value={form.category}
                  onChange={(event) =>
                    updateForm(
                      'category',
                      event.target.value,
                    )
                  }
                  className="mt-2 w-full rounded-lg border bg-background px-4 py-3 outline-none focus:ring-2"
                >
                  {categories.map(
                    (category) => (
                      <option
                        key={category}
                        value={category}
                      >
                        {category}
                      </option>
                    ),
                  )}
                </select>
              </div>

              {/* Stock */}
              <div>
                <label className="text-sm font-medium">
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
                    )
                  }
                  placeholder="10"
                  className="mt-2 w-full rounded-lg border bg-background px-4 py-3 outline-none focus:ring-2"
                  required
                />
              </div>

              {/* Preparation */}
              <div>
                <label className="text-sm font-medium">
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
                    )
                  }
                  placeholder="120"
                  className="mt-2 w-full rounded-lg border bg-background px-4 py-3 outline-none focus:ring-2"
                  required
                />
              </div>

              {/* Availability */}
              <div>
                <label className="text-sm font-medium">
                  Availability *
                </label>

                <select
                  value={form.availability}
                  onChange={(event) =>
                    updateForm(
                      'availability',
                      event.target.value,
                    )
                  }
                  className="mt-2 w-full rounded-lg border bg-background px-4 py-3 outline-none focus:ring-2"
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
                <label className="text-sm font-medium">
                  Image URL
                </label>

                <input
                  type="url"
                  value={form.image}
                  onChange={(event) =>
                    updateForm(
                      'image',
                      event.target.value,
                    )
                  }
                  placeholder="https://..."
                  className="mt-2 w-full rounded-lg border bg-background px-4 py-3 outline-none focus:ring-2"
                />
              </div>

              {/* Description */}
              <div className="md:col-span-2">
                <label className="text-sm font-medium">
                  Description *
                </label>

                <textarea
                  value={form.description}
                  onChange={(event) =>
                    updateForm(
                      'description',
                      event.target.value,
                    )
                  }
                  placeholder="Rich, moist red velvet cake with cream cheese frosting."
                  rows={4}
                  className="mt-2 w-full resize-none rounded-lg border bg-background px-4 py-3 outline-none focus:ring-2"
                  required
                />
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-3 md:col-span-2">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="rounded-lg border px-6 py-3 font-medium hover:bg-muted disabled:opacity-60"
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
          <div className="mt-8 rounded-2xl border bg-background p-10 text-center">
            Loading products...
          </div>
        )}

        {/* Empty */}
        {!loading &&
          !error &&
          products.length === 0 && (
            <div className="mt-8 rounded-2xl border bg-background p-10 text-center">
              <h2 className="text-xl font-semibold">
                No products found
              </h2>

              <p className="mt-2 text-muted-foreground">
                Add your first bakery product.
              </p>
            </div>
          )}

        {/* Products */}
        {!loading &&
          products.length > 0 && (
            <div className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {products.map((product) => (
                <section
                  key={product._id}
                  className="rounded-2xl border bg-background p-6 shadow-sm"
                >
                  <div className="border-b pb-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-xl font-bold">
                          {product.name}
                        </h2>

                        <p className="mt-1 text-sm text-muted-foreground">
                          {product.category}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          product.availability ===
                          'AVAILABLE'
                            ? 'bg-green-100 text-green-700'
                            : product.availability ===
                                'OUT_OF_STOCK'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {formatAvailability(
                          product.availability,
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4 py-5">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Price
                      </p>

                      <p className="mt-1 text-2xl font-bold">
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

                      <p className="mt-1 break-all font-mono text-xs">
                        {product._id}
                      </p>
                    </div>
                  </div>

                  {/* Stock */}
                  <div className="border-t pt-5">
                    <label
                      htmlFor={`stock-${product._id}`}
                      className="text-sm font-medium"
                    >
                      Stock
                    </label>

                    <div className="mt-2 flex gap-2">
                      <input
                        id={`stock-${product._id}`}
                        type="number"
                        min="0"
                        defaultValue={
                          product.stock
                        }
                        disabled={
                          updatingProduct ===
                          product._id
                        }
                        className="w-full rounded-lg border bg-background px-4 py-3 outline-none focus:ring-2 disabled:opacity-60"
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
                        className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
                      >
                        Save
                      </button>
                    </div>
                  </div>

                  {/* Availability */}
                  <div className="mt-5">
                    <label
                      htmlFor={`availability-${product._id}`}
                      className="text-sm font-medium"
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
                        )
                      }
                      className="mt-2 w-full rounded-lg border bg-background px-4 py-3 outline-none focus:ring-2 disabled:opacity-60"
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