'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { withAdminAuth } from '@/components/admin/admin-auth'
import AdminNav from '@/components/admin/admin-nav'

type Settings = {
  _id: string
  onlineOrdersEnabled: boolean
  deliveryEnabled: boolean
  pickupEnabled: boolean
  closedMessage: string
  reopenAt: string | null
  createdAt: string
  updatedAt: string
}

function formatDateTime(iso: string | null) {
  if (!iso) return 'Not set'
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function AdminSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const local = {
    onlineOrdersEnabled: settings?.onlineOrdersEnabled ?? true,
    deliveryEnabled: settings?.deliveryEnabled ?? true,
    pickupEnabled: settings?.pickupEnabled ?? true,
    closedMessage: settings?.closedMessage ?? '',
    reopenAt: settings?.reopenAt ?? '',
  }

  const [form, setForm] = useState({
    onlineOrdersEnabled: local.onlineOrdersEnabled,
    deliveryEnabled: local.deliveryEnabled,
    pickupEnabled: local.pickupEnabled,
    closedMessage: local.closedMessage,
    reopenAt: local.reopenAt,
  })

  async function fetchSettings() {
    try {
      setLoading(true)
      setError('')
      const response = await fetch('/api/settings', {
        cache: 'no-store',
      })
      if (!response.ok) {
        throw new Error('Unable to fetch settings')
      }
      const data = await response.json()
      setSettings(data.settings)
      const s = data.settings
      setForm({
        onlineOrdersEnabled: s.onlineOrdersEnabled,
        deliveryEnabled: s.deliveryEnabled,
        pickupEnabled: s.pickupEnabled,
        closedMessage: s.closedMessage,
        reopenAt: s.reopenAt ? new Date(s.reopenAt).toISOString().slice(0, 16) : '',
      })
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to load settings',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSaved(false)
    setSaving(true)

    try {
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('admin-token')}`,
        },
        body: JSON.stringify({
          onlineOrdersEnabled: form.onlineOrdersEnabled,
          deliveryEnabled: form.deliveryEnabled,
          pickupEnabled: form.pickupEnabled,
          closedMessage: form.closedMessage.trim(),
          ...(form.reopenAt ? { reopenAt: form.reopenAt } : {}),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Unable to update settings')
      }

      setSettings(data.settings)
      setSaved(true)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to update settings',
      )
    } finally {
      setSaving(false)
    }
  }

  const toggle = (field: keyof typeof form) => {
    setError('')
    setSaved(false)
    setForm((prev) => ({
      ...prev,
      [field]: !prev[field],
    }))
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-muted/20 px-4 py-8">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-xl border border-border p-10 text-center">
            <p className="text-muted-foreground">Loading settings…</p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-muted/20">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/admin"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Back to Dashboard
          </Link>
          <Link
            href="/"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted ml-2 inline-block"
          >
            View Store
          </Link>
          <h1 className="mt-3 text-3xl font-bold text-primary">
            Ordering Settings
          </h1>
          <p className="mt-2 text-muted-foreground">
            Control whether customers can place new orders and which
            fulfilment options are offered. Existing orders are never affected.
          </p>
        </div>

        <AdminNav className="mt-6" />

        {error && (
          <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {saved && (
          <div className="mb-6 rounded-xl border border-success/30 bg-success/5 p-4 text-sm text-success">
            Settings saved successfully.
          </div>
        )}

        {!settings && (
          <div className="mb-6 rounded-xl border border-border p-10 text-center text-muted-foreground">
            No settings available.
          </div>
        )}

        {settings && (
          <form onSubmit={handleSave} className="space-y-6">
            <section className="rounded-xl border border-border bg-white p-6 sm:p-8 shadow-sm">
              <h2 className="text-xl font-semibold text-primary mb-1">
                Online Ordering
              </h2>
              <p className="mt-1 text-sm text-muted-foreground mb-6">
                Allow customers to place new orders through the website.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border p-4 text-left">
                  <div className="font-semibold text-foreground">Online Orders</div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {form.onlineOrdersEnabled ? 'Enabled' : 'Disabled'}
                  </p>
                  <button
                    type="button"
                    onClick={() => toggle('onlineOrdersEnabled')}
                    disabled={saving}
                    className={cn(
                      'mt-3 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                      form.onlineOrdersEnabled
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60'
                        : 'border border-destructive/30 text-destructive hover:bg-destructive/5 disabled:opacity-60',
                    )}
                  >
                    {form.onlineOrdersEnabled ? 'Turn OFF' : 'Turn ON'}
                  </button>
                </div>

                {!form.onlineOrdersEnabled && (
                  <div className="col-span-full rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                    When OFF, customers see a closed message and cannot place
                    new orders. Existing orders can still be viewed and tracked.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-xl border border-border bg-white p-6 sm:p-8 shadow-sm">
              <h2 className="text-xl font-semibold text-primary mb-1">
                Fulfilment Options
              </h2>
              <p className="mt-1 text-sm text-muted-foreground mb-6">
                Choose which fulfilment types are offered for new orders.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border p-4 text-left">
                  <div className="font-semibold text-foreground">Delivery</div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {form.deliveryEnabled ? 'Enabled' : 'Disabled'}
                  </p>
                  <button
                    type="button"
                    onClick={() => toggle('deliveryEnabled')}
                    disabled={saving}
                    className={cn(
                      'mt-3 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                      form.deliveryEnabled
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60'
                        : 'border border-destructive/30 text-destructive hover:bg-destructive/5 disabled:opacity-60',
                    )}
                  >
                    {form.deliveryEnabled ? 'Turn OFF' : 'Turn ON'}
                  </button>
                </div>

                <div className="rounded-xl border p-4 text-left">
                  <div className="font-semibold text-foreground">Pickup</div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {form.pickupEnabled ? 'Enabled' : 'Disabled'}
                  </p>
                  <button
                    type="button"
                    onClick={() => toggle('pickupEnabled')}
                    disabled={saving}
                    className={cn(
                      'mt-3 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                      form.pickupEnabled
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60'
                        : 'border border-destructive/30 text-destructive hover:bg-destructive/5 disabled:opacity-60',
                    )}
                  >
                    {form.pickupEnabled ? 'Turn OFF' : 'Turn ON'}
                  </button>
                </div>

                {!form.deliveryEnabled && !form.pickupEnabled && (
                  <div className="col-span-full rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                    No fulfilment options are enabled. Customers will not be
                    able to select Delivery or Pickup at checkout.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-xl border border-border bg-white p-6 sm:p-8 shadow-sm">
              <h2 className="text-xl font-semibold text-primary mb-1">
                Closed Message &amp; Reopen Time
              </h2>
              <p className="mt-1 text-sm text-muted-foreground mb-6">
                Shown to customers when online ordering is disabled.
              </p>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Closed message
                  </label>
                  <textarea
                    value={form.closedMessage}
                    onChange={(e) => {
                      setError('')
                      setSaved(false)
                      setForm((prev) => ({ ...prev, closedMessage: e.target.value }))
                    }}
                    rows={3}
                    placeholder="We are currently closed for online orders. Please check back soon."
                    className="w-full rounded-lg border border-border bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">
                      Reopen at (date &amp; time)
                    </label>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Optional. When set, hints when ordering may resume.
                    </p>
                    <input
                      type="datetime-local"
                      value={form.reopenAt}
                      onChange={(e) => {
                        setError('')
                        setSaved(false)
                        setForm((prev) => ({ ...prev, reopenAt: e.target.value }))
                      }}
                      className="w-full rounded-lg border border-border bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div className="flex items-end">
                    <p className="mt-1 text-xs text-muted-foreground">
                      Current: {formatDateTime(settings.reopenAt)}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <div className="mt-8 flex items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving…' : 'Save Settings'}
              </button>
              <button
                type="button"
                onClick={fetchSettings}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-6 py-3 font-semibold text-foreground hover:bg-muted disabled:opacity-60"
              >
                Refresh
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Backend enforcement is authoritative: the create-order endpoint
              rejects orders that violate these settings, regardless of the UI.
            </p>
          </form>
        )}
      </div>
    </main>
  )
}

export default withAdminAuth(AdminSettingsPage)

function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ')
}
