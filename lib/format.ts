const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

const number = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 0,
})

/**
 * Safely format a currency value. Returns a fallback string (default '₹0')
 * for null, undefined, NaN or non-numeric values instead of throwing.
 * Genuine API errors are not swallowed here — callers still check
 * response.ok before parsing. This only guards the formatting layer.
 */
export function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '₹0'
  }
  return currency.format(value)
}

/**
 * Safely format a plain number. Returns '0' for null, undefined, NaN
 * or non-numeric values instead of throwing.
 */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '0'
  }
  return number.format(value)
}

/**
 * Format a currency value with a custom fallback for missing data.
 * Use this when '₹0' would be misleading (e.g. cost data not captured).
 */
export function formatPriceOr(
  value: number | null | undefined,
  fallback: string,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return fallback
  }
  return currency.format(value)
}

/**
 * Format a number with a custom fallback for missing data.
 */
export function formatNumberOr(
  value: number | null | undefined,
  fallback: string,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return fallback
  }
  return number.format(value)
}

export function discountPercent(price: number, mrp: number) {
  if (mrp <= price) return 0
  return Math.round(((mrp - price) / mrp) * 100)
}

export function formatDate(iso: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...opts,
  })
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function toISODate(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
