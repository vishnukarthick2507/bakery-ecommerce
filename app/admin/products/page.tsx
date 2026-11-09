'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

import {
  fetchUploadSignature,
  uploadFileToCloudinary,
  type UploadSignature,
} from '@/lib/upload'

import { withAdminAuth } from '@/components/admin/admin-auth'
import AdminLayout from '@/components/admin/admin-layout'

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
  images: string[]
}

const emptyForm: ProductForm = {
  name: '',
  slug: '',
  description: '',
  price: '',
  category: 'Cakes',
  stock: '0',
  preparationTime: '60',
  availability: 'AVAILABLE',
  images: [],
}

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

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
          ? 'border-caramel/20 bg-caramel/10 text-caramel'
          : 'border-border/50 bg-cream text-muted-foreground',
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

  // Image upload state
  const [uploadFiles, setUploadFiles] = useState<File[]>([])
  const [uploadPreviews, setUploadPreviews] = useState<string[]>([])
  const [uploadProgress, setUploadProgress] = useState<Record<number, number>>(
    {},
  )
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  // Revoke object URLs when the component unmounts or the form closes.
  const objectUrlsRef = useRef<string[]>([])

  // Pagination state
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  async function fetchProducts() {
    try {
      setLoading(true)
      setError('')

      const response = await fetch(
        `/api/products?page=${page}&limit=${limit}&includeInactive=true`,
        {
          cache: 'no-store',
          credentials: 'include',
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.message ||
            'Unable to fetch products',
        )
      }

      // Handle both paginated object and plain array (backward compatible)
      let fetchedProducts: Product[] = []
      let fetchedTotal = 0
      let fetchedTotalPages = 0

      if (Array.isArray(data)) {
        fetchedProducts = data
        fetchedTotal = data.length
        fetchedTotalPages = 1
      } else {
        fetchedProducts = data.products ?? []
        fetchedTotal = data.pagination?.total ?? 0
        fetchedTotalPages = data.pagination?.totalPages ?? 1
      }

      setProducts(fetchedProducts)
      setTotal(fetchedTotal)
      setTotalPages(fetchedTotalPages)
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

  function revokePreviews() {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    objectUrlsRef.current = []
  }

  function openAddForm() {
    revokePreviews()
    setEditingProduct(null)
    setForm(emptyForm)
    setUploadFiles([])
    setUploadPreviews([])
    setUploadProgress({})
    setUploadError('')
    setShowForm(true)
    setError('')
  }

  function openEditForm(product: Product) {
    revokePreviews()
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
      images: product.images ?? [],
    })

    setUploadFiles([])
    setUploadPreviews([])
    setUploadProgress({})
    setUploadError('')
    setShowForm(true)
    setError('')
  }

  function closeForm() {
    if (saving) return

    revokePreviews()
    setShowForm(false)
    setEditingProduct(null)
    setForm(emptyForm)
    setUploadFiles([])
    setUploadPreviews([])
    setUploadProgress({})
    setUploadError('')
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

  async function fetchUploadSignature() {
    const response = await fetch('/api/admin/uploads/signature', {
      method: 'POST',
      credentials: 'include',
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(
        data.message || 'Unable to get upload authorization',
      )
    }

    const payload = await response.json()
    return payload.signature
  }

  async function handleImageChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) return

    // Client-side validation for every selected file.
    const invalidType = files.find(
      (file) => !ACCEPTED_IMAGE_TYPES.includes(file.type),
    )
    if (invalidType) {
      setUploadError(
        'Please upload a JPG, PNG or WebP image only.',
      )
      setUploadFiles([])
      setUploadPreviews([])
      setUploadProgress({})
      return
    }

    const tooLarge = files.find((file) => file.size > MAX_FILE_SIZE)
    if (tooLarge) {
      setUploadError('Each image must be smaller than 5 MB.')
      setUploadFiles([])
      setUploadPreviews([])
      setUploadProgress({})
      return
    }

    // Revoke any previews from a previous selection.
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))

    const previews = files.map((file) => URL.createObjectURL(file))
    objectUrlsRef.current = previews

    setUploadFiles(files)
    setUploadPreviews(previews)
    setUploadProgress({})
    setUploadError('')
  }

  async function handleUploadImages() {
    if (uploadFiles.length === 0) return

    setUploading(true)
    setUploadError('')
    const progress: Record<number, number> = {}
    uploadFiles.forEach((_, index) => {
      progress[index] = 0
    })
    setUploadProgress(progress)

    let signature: UploadSignature | null = null
    try {
      signature = await fetchUploadSignature()
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'Unable to get upload authorization',
      )
      setUploading(false)
      return
    }

    if (!signature) {
      setUploadError('Unable to get upload authorization')
      setUploading(false)
      return
    }

    try {
      for (let index = 0; index < uploadFiles.length; index++) {
        const file = uploadFiles[index]

        const secureUrl = await uploadFileToCloudinary(
          file,
          signature,
          {
            onProgress: (percent) => {
              setUploadProgress((current) => ({
                ...current,
                [index]: percent,
              }))
            },
          },
        )

        setUploadProgress((current) => ({
          ...current,
          [index]: 100,
        }))

        setForm((current) => {
          if (current.images.includes(secureUrl)) {
            return current
          }
          return {
            ...current,
            images: [...current.images, secureUrl],
          }
        })
      }

      // Clear the pending selection once every file has uploaded.
      setUploadFiles([])
      setUploadPreviews([])
      setUploadProgress({})
      revokePreviews()
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'Unable to upload image',
      )
    } finally {
      setUploading(false)
    }
  }

  function moveImage(index: number, direction: 'up' | 'down') {
    setForm((current) => {
      const images = [...current.images]
      const target = direction === 'up' ? index - 1 : index + 1
      if (target < 0 || target >= images.length) {
        return current
      }
      ;[images[index], images[target]] = [images[target], images[index]]
      return { ...current, images }
    })
  }

  function removeImage(url: string) {
    setForm((current) => ({
      ...current,
      images: current.images.filter((img) => img !== url),
    }))
  }

  async function saveProduct(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    try {
      setSaving(true)
      setError('')
      setUploadError('')

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
        images: form.images,
      }

      const response = await fetch(
        editingProduct
          ? `/api/products/${editingProduct._id}`
          : '/api/products',
        {
          method: editingProduct
            ? 'PATCH'
            : 'POST',
          credentials: 'include',
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
        `/api/products/${productId}`,
        {
          method: 'PATCH',
          credentials: 'include',
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
        `/api/products/${productId}`,
        {
          method: 'PATCH',
          credentials: 'include',
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

  async function setProductActive(
    productId: string,
    active: boolean,
  ) {
    try {
      setUpdatingProduct(productId)
      setError('')

      const response = await fetch(
        `/api/products/${productId}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type':
              'application/json',
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
    <AdminLayout>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-semibold text-caramel uppercase tracking-wider">
              Bluebell Bakehouse Admin
            </p>

            <Link
              href="/admin"
              className="text-sm text-muted-foreground hover:underline"
            >
              ← Back to Dashboard
            </Link>

            <h1 className="mt-2 text-3xl font-bold text-primary tracking-tight">
              Products
            </h1>

            <p className="mt-3 text-muted-foreground leading-relaxed">
              Manage products, prices, stock and availability.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={fetchProducts}
              disabled={loading}
              className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-caramel hover:bg-cream/50 disabled:opacity-60 transition-colors"
            >
              {loading
                ? 'Refreshing...'
                : 'Refresh'}
            </button>

            <button
              type="button"
              onClick={openAddForm}
              className="rounded-xl bg-caramel px-6 py-3 text-sm font-semibold text-caramel-foreground shadow-sm hover:bg-caramel/90 transition-colors"
            >
              + Add Product
            </button>
            <Link
              href="/"
              className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-caramel hover:bg-cream/50 transition-colors"
            >
              View Store
            </Link>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-6 rounded-[2rem] border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive shadow-sm">
            {error}
          </div>
        )}

        {/* Add / Edit form */}
        {showForm && (
          <section className="mt-10 rounded-[2rem] border border-border bg-card p-8 sm:p-10 shadow-sm">
            <div className="flex items-start justify-between gap-5">
              <div>
                <h2 className="text-2xl font-bold text-primary tracking-tight">
                  {editingProduct
                    ? 'Edit Product'
                    : 'Add Product'}
                </h2>

                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {editingProduct
                    ? 'Update this product and save the changes to MongoDB.'
                    : 'Create a new bakery product in MongoDB.'}
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-caramel hover:bg-cream/50 disabled:opacity-60 transition-colors"
              >
                Cancel
              </button>
            </div>

            <form
              onSubmit={saveProduct}
              className="mt-10 grid gap-6 md:grid-cols-2"
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
                  className="mt-2 w-full rounded-xl border border-border bg-card px-4 py-3 outline-none focus:ring-2 focus:ring-caramel"
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
                  className="mt-2 w-full rounded-xl border border-border bg-card px-4 py-3 outline-none focus:ring-2 focus:ring-caramel"
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
                  className="mt-2 w-full rounded-xl border border-border bg-card px-4 py-3 outline-none focus:ring-2 focus:ring-caramel"
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
                  className="mt-2 w-full rounded-xl border border-border bg-card px-4 py-3 outline-none focus:ring-2 focus:ring-caramel"
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
                  className="mt-2 w-full rounded-xl border border-border bg-card px-4 py-3 outline-none focus:ring-2 focus:ring-caramel"
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
                  className="mt-2 w-full rounded-xl border border-border bg-card px-4 py-3 outline-none focus:ring-2 focus:ring-caramel"
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
                  className="mt-2 w-full rounded-xl border border-border bg-card px-4 py-3 outline-none focus:ring-2 focus:ring-caramel"
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

              {/* Images */}
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-foreground">
                  Images
                </label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Upload product images directly from your computer. JPG, PNG,
                  WebP up to 5 MB each.
                </p>

                <div className="mt-3 grid gap-3">
                  {/* Existing images preview (with reorder + removal) */}
                  {form.images.map((img, idx) => (
                    <div
                      key={img}
                      className="relative group flex items-center gap-3 rounded-xl border border-border bg-cream/50 p-3"
                    >
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <button
                          type="button"
                          onClick={() => moveImage(idx, 'up')}
                          disabled={idx === 0}
                          className="rounded border border-border px-1.5 py-0.5 disabled:opacity-40 disabled:pointer-events-none hover:bg-cream"
                          aria-label={`Move image ${idx + 1} up`}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => moveImage(idx, 'down')}
                          disabled={idx === form.images.length - 1}
                          className="rounded border border-border px-1.5 py-0.5 disabled:opacity-40 disabled:pointer-events-none hover:bg-cream"
                          aria-label={`Move image ${idx + 1} down`}
                        >
                          ↓
                        </button>
                      </div>
                      <img
                        src={img}
                        alt={`Product image ${idx + 1}`}
                        className="h-24 w-24 rounded-xl object-cover flex-shrink-0"
                        onError={(e) => {
                          ;(e.target as HTMLImageElement).src =
                            '/placeholder.svg';
                        }}
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          removeImage(img)
                        }}
                        className="ml-auto rounded-full border border-border bg-card px-1.5 py-0.5 text-xs text-destructive hover:bg-destructive/10"
                        aria-label={`Remove image ${idx + 1}`}
                      >
                        ×
                      </button>
                    </div>
                  ))}

                  {/* Pending uploads (preview + progress) */}
                  {uploadFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex flex-col items-center gap-2 rounded-xl border border-caramel/50 bg-caramel/5 p-3"
                    >
                      <img
                        src={uploadPreviews[idx]}
                        alt={`Preview ${idx + 1}`}
                        className="h-24 w-24 rounded-xl object-cover"
                      />
                      <div className="w-full bg-cream/20 rounded-full h-2">
                        <div
                          className="bg-primary h-full rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress[idx] ?? 0}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground truncate w-full max-w-xs">
                        {file.name}
                      </p>
                    </div>
                  ))}

                  {/* Upload area */}
                  <div
                    className="relative group rounded-xl border border-dashed border-border bg-cream/50 p-5 text-center hover:border-caramel/50 cursor-pointer"
                  >
                    <input
                      type="file"
                      accept={ACCEPTED_IMAGE_TYPES.join(',')}
                      multiple
                      onChange={handleImageChange}
                      className="sr-only"
                      disabled={uploading || uploadFiles.length > 0}
                    />
                    <button
                      type="button"
                      onClick={handleUploadImages}
                      disabled={
                        uploading ||
                        uploadFiles.length === 0
                      }
                      className="w-full flex flex-col items-center gap-2 px-5 py-5 rounded-xl border border-dashed border-border bg-card hover:bg-caramel/5 transition-colors disabled:opacity-60"
                    >
                      {uploading ? (
                        <span className="text-sm text-primary">
                          Uploading {uploadFiles.length} image{uploadFiles.length === 1 ? '' : 's'}…
                        </span>
                      ) : uploadFiles.length > 0 ? (
                        <>
                          <span className="text-sm font-medium text-primary">
                            Upload {uploadFiles.length} image{uploadFiles.length === 1 ? '' : 's'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Selected from computer
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-sm font-medium text-foreground">
                            Upload Image
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Select from computer
                          </span>
                        </>
                      )}
                    </button>

                    {uploadError && (
                      <p className="mt-1 text-xs text-destructive">
                        {uploadError}
                      </p>
                    )}
                  </div>
                </div>
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
                  className="mt-2 w-full resize-none rounded-xl border border-border bg-card px-4 py-3 outline-none focus:ring-2 focus:ring-caramel"
                  required
                />
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-4 md:col-span-2">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="rounded-xl border border-border px-6 py-3.5 font-medium text-caramel hover:bg-cream/50 disabled:opacity-60 transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-caramel px-8 py-4 font-semibold text-caramel-foreground shadow-sm hover:bg-caramel/90 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
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
        )}

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
                      className="w-full rounded-xl border border-border bg-card px-4 py-3 outline-none focus:ring-2 focus:ring-caramel disabled:opacity-60"
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
                    className="mt-2 w-full rounded-xl border border-border bg-card px-4 py-3 outline-none focus:ring-2 focus:ring-caramel disabled:opacity-60"
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

      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground">
            Showing {total} product{' '}
            {total !== 1 ? 's' : ''}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
            >
              Previous
            </button>

            <span className="text-sm font-medium text-muted-foreground">
              Page {page} of {totalPages}
            </span>

            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
            >
              Next
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">
              Per page:
            </label>
            <select
              value={limit}
              onChange={(event) => {
                setPage(1)
                setLimit(Number(event.target.value))
              }}
              className="rounded-lg border border-border px-3 py-2 text-sm"
            >
              {[10, 20, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
  </AdminLayout>
  )
}

export default withAdminAuth(AdminProductsPage)
