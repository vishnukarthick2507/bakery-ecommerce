'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { withAdminAuth } from '@/components/admin/admin-auth'
import AdminLayout from '@/components/admin/admin-layout'

type Stats = {
  PENDING: number
  PROCESSING: number
  SENT: number
  DELIVERED: number
  READ: number
  FAILED: number
  RETRYING: number
  DEAD_LETTER: number
  SKIPPED: number
  RECEIVED?: number
}

type ProviderDeliveryStatus = 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | null

type OutboxMessage = {
  id: string
  idempotencyKey: string
  channel: 'WHATSAPP' | 'EMAIL'
  status: string // outbox processing status
  providerDeliveryStatus?: ProviderDeliveryStatus
  providerSentAt?: string | null
  providerDeliveredAt?: string | null
  providerReadAt?: string | null
  providerFailedAt?: string | null
  providerErrorCode?: string | null
  providerErrorMessage?: string | null
  recipient: string
  eventType: string
  templateName?: string | null
  orderNumber?: string | null
  referenceNumber?: string | null
  attemptCount: number
  maxAttempts: number
  nextRetryAt?: string | null
  lastError?: string | null
  metaMessageId?: string | null
  createdAt: string
  updatedAt?: string
}

type Pagination = { page: number; limit: number; total: number; totalPages: number }

type ConsentCategoryState = {
  status: 'GRANTED' | 'DENIED' | 'WITHDRAWN'
  hasConsent: boolean
  source?: string | null
  consentTimestamp?: string | null
  optOutTimestamp?: string | null
  withdrawalReason?: string | null
}

type ConsentRow = {
  id: string
  phone: string
  // Backward-compatible transactional top-level fields
  status: 'GRANTED' | 'DENIED' | 'WITHDRAWN'
  hasConsent: boolean
  source?: string | null
  consentTimestamp?: string | null
  optOutTimestamp?: string | null
  withdrawalReason?: string | null
  updatedAt?: string
  transactional?: ConsentCategoryState
  marketing?: ConsentCategoryState
}

type Preference = {
  eventType: string
  enabled: boolean
  updatedAt?: string | null
  updatedBy?: string | null
}

type RelatedWhatsAppMessage = {
  id: string
  direction: string
  phone: string
  messageId: string
  templateName?: string | null
  status: string
  errorCode?: string | null
  errorMessage?: string | null
  orderNumber?: string | null
  referenceNumber?: string | null
  createdAt: string
}

type MessageDetail = {
  message: OutboxMessage & { workerId?: string | null; leaseExpiresAt?: string | null }
  retryHistory: { attemptCount: number; maxAttempts: number; nextRetryAt?: string | null; lastError?: string | null; status: string }
  correlation?: { basis?: 'EXACT_META_MESSAGE_ID' | 'NONE'; metaMessageId?: string | null; note?: string }
  relatedWhatsAppMessages: RelatedWhatsAppMessage[]
}

const STAT_ORDER: Array<keyof Stats> = [
  'PENDING', 'PROCESSING', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'RETRYING', 'DEAD_LETTER', 'SKIPPED'
]

function waLink(phone: string, text: string) {
  const digits = phone.replace(/[^\d]/g, '')
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString('en-IN')
}

function canRetry(status: string) {
  return status === 'DEAD_LETTER' || status === 'RETRYING'
}

function providerDeliveryLabel(status?: string | null) {
  return status && ['SENT', 'DELIVERED', 'READ', 'FAILED'].includes(status) ? status : 'UNKNOWN'
}

function providerDeliveryDescription(status: string) {
  switch (status) {
    case 'SENT':
      return 'Meta accepted the message (not confirmed delivered).'
    case 'DELIVERED':
      return 'Meta reported delivery to the recipient’s device.'
    case 'READ':
      return 'Meta reported the recipient read the message.'
    case 'FAILED':
      return 'Meta reported a delivery failure.'
    default:
      return 'No provider delivery status available.'
  }
}

function AdminWhatsAppPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [messages, setMessages] = useState<OutboxMessage[]>([])
  const [messagesLoading, setMessagesLoading] = useState(true)
  const [messagesError, setMessagesError] = useState('')
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('') // outbox processing status
  const [providerDeliveryFilter, setProviderDeliveryFilter] = useState('') // provider delivery status
  const [channelFilter, setChannelFilter] = useState('')
  const [eventFilter, setEventFilter] = useState('')
  const [page, setPage] = useState(1)

  const [consents, setConsents] = useState<ConsentRow[]>([])
  const [consentsLoading, setConsentsLoading] = useState(true)
  const [consentSearch, setConsentSearch] = useState('')
  const [consentStatus, setConsentStatus] = useState('')
  const [consentCategory, setConsentCategory] = useState<'TRANSACTIONAL' | 'MARKETING'>('TRANSACTIONAL')
  const [consentPage, setConsentPage] = useState(1)
  const [consentPagination, setConsentPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })

  const [preferences, setPreferences] = useState<Preference[]>([])
  const [prefsLoading, setPrefsLoading] = useState(true)
  const [prefsError, setPrefsError] = useState('')
  const [savingPref, setSavingPref] = useState<string | null>(null)

  const [selected, setSelected] = useState<MessageDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState('')

  async function fetchStats() {
    try {
      setStatsLoading(true)
      const res = await fetch('/api/admin/whatsapp/stats', { credentials: 'include', cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Unable to fetch stats')
      setStats(data.stats)
    } catch {
      setStats(null)
    } finally {
      setStatsLoading(false)
    }
  }

  async function fetchMessages(targetPage = page) {
    try {
      setMessagesLoading(true)
      setMessagesError('')
      const params = new URLSearchParams()
      params.set('page', String(targetPage))
      params.set('limit', '20')
      if (search.trim()) params.set('search', search.trim())
      if (statusFilter) params.set('status', statusFilter)
      if (providerDeliveryFilter) params.set('providerDeliveryStatus', providerDeliveryFilter)
      if (channelFilter) params.set('channel', channelFilter)
      if (eventFilter.trim()) params.set('eventType', eventFilter.trim())
      const res = await fetch(`/api/admin/whatsapp/messages?${params.toString()}`, { credentials: 'include', cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Unable to fetch messages')
      setMessages(data.messages ?? [])
      setPagination(data.pagination ?? { page: targetPage, limit: 20, total: 0, totalPages: 0 })
    } catch (err) {
      setMessages([])
      setMessagesError(err instanceof Error ? err.message : 'Unable to fetch messages')
    } finally {
      setMessagesLoading(false)
    }
  }

  async function fetchConsents(targetPage = consentPage) {
    try {
      setConsentsLoading(true)
      const params = new URLSearchParams()
      params.set('page', String(targetPage))
      params.set('limit', '20')
      if (consentSearch.trim()) params.set('search', consentSearch.trim())
      if (consentStatus) params.set('status', consentStatus)
      if (consentCategory) params.set('category', consentCategory)
      const res = await fetch(`/api/admin/whatsapp/consents?${params.toString()}`, { credentials: 'include', cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Unable to fetch consents')
      setConsents(data.consents ?? [])
      setConsentPagination(data.pagination ?? { page: targetPage, limit: 20, total: 0, totalPages: 0 })
    } catch {
      setConsents([])
    } finally {
      setConsentsLoading(false)
    }
  }

  async function fetchPreferences() {
    try {
      setPrefsLoading(true)
      setPrefsError('')
      const res = await fetch('/api/admin/whatsapp/preferences', { credentials: 'include', cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Unable to fetch preferences')
      setPreferences(data.preferences ?? [])
    } catch (err) {
      setPrefsError(err instanceof Error ? err.message : 'Unable to fetch preferences')
      setPreferences([])
    } finally {
      setPrefsLoading(false)
    }
  }

  async function openDetail(id: string) {
    try {
      setDetailLoading(true)
      setDetailError('')
      const res = await fetch(`/api/admin/whatsapp/messages/${encodeURIComponent(id)}`, { credentials: 'include', cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Unable to fetch message details')
      setSelected(data)
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Unable to fetch message details')
      setSelected(null)
    } finally {
      setDetailLoading(false)
    }
  }

  async function retryMessage(id: string) {
    try {
      setRetryingId(id)
      setActionMessage('')
      const res = await fetch(`/api/admin/whatsapp/messages/${encodeURIComponent(id)}/retry`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Unable to retry message')
      setActionMessage(data.message || 'Message queued for retry')
      await Promise.all([fetchStats(), fetchMessages(page)])
      if (selected?.message.id === id) await openDetail(id)
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Unable to retry message')
    } finally {
      setRetryingId(null)
    }
  }

  async function updatePreference(eventType: string, enabled: boolean) {
    try {
      setSavingPref(eventType)
      setPrefsError('')
      const res = await fetch('/api/admin/whatsapp/preferences', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventType, enabled }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Unable to update preference')
      setPreferences((current) => current.map((p) => p.eventType === eventType ? { ...p, ...data.preference } : p))
    } catch (err) {
      setPrefsError(err instanceof Error ? err.message : 'Unable to update preference')
    } finally {
      setSavingPref(null)
    }
  }

  useEffect(() => { void fetchStats() }, [])
  useEffect(() => { setPage(1) }, [search, statusFilter, providerDeliveryFilter, channelFilter, eventFilter])
  useEffect(() => { void fetchMessages(page) }, [page])
  useEffect(() => { setConsentPage(1) }, [consentSearch, consentStatus, consentCategory])
  useEffect(() => { void fetchConsents(consentPage) }, [consentPage])
  useEffect(() => { void fetchPreferences() }, [])

  const statCards = useMemo(() => STAT_ORDER.map((k) => ({ key: k, value: stats?.[k] ?? 0 })), [stats])

  return (
    <AdminLayout>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold text-caramel uppercase tracking-wider">Bluebell Bakehouse Admin</p>
            <Link href="/admin" className="text-sm text-muted-foreground hover:underline">← Back to Dashboard</Link>
            <h1 className="mt-2 text-3xl font-bold text-primary tracking-tight">WhatsApp Centre</h1>
            <p className="mt-2 text-muted-foreground">Monitor notifications, consent, preferences, and safely retry eligible failures. Manual contact links open WhatsApp only; they never auto-send.</p>
          </div>
          <button type="button" onClick={() => { void fetchStats(); void fetchMessages(page); void fetchConsents(consentPage); void fetchPreferences() }} className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-caramel hover:bg-cream/50 transition-colors">Refresh</button>
        </div>

        <section>
          <h2 className="text-lg font-semibold text-primary mb-3">Message Statistics</h2>
          {statsLoading ? (
            <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">Loading statistics…</div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {statCards.map((s) => (
                <div key={s.key} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{s.key.replaceAll('_', ' ')}</p>
                  <p className="mt-2 text-2xl font-bold text-primary">{s.value}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-primary">Message History</h2>
              <p className="text-sm text-muted-foreground">Outbox processing status and provider delivery status are shown separately. “SENT” (provider) means Meta accepted the message, not confirmed delivery.</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => void fetchMessages(1)} className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-cream/50">Apply</button>
              <button type="button" onClick={() => { setSearch(''); setStatusFilter(''); setProviderDeliveryFilter(''); setChannelFilter(''); setEventFilter(''); setPage(1); setTimeout(() => void fetchMessages(1), 0) }} className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-cream/50">Clear</button>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="grid gap-1 text-sm"><span className="font-medium">Search</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Recipient, event, order, reference" className="h-10 rounded-lg border border-border bg-white px-3 outline-none focus:ring-2 focus:ring-caramel" /></label>
            <label className="grid gap-1 text-sm"><span className="font-medium">Outbox status</span><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 rounded-lg border border-border bg-white px-3 outline-none focus:ring-2 focus:ring-caramel"><option value="">All</option>{['PENDING','PROCESSING','SENT','RETRYING','DEAD_LETTER','SKIPPED'].map(s => <option key={s} value={s}>{s}</option>)}</select></label>
            <label className="grid gap-1 text-sm"><span className="font-medium">Provider delivery</span><select value={providerDeliveryFilter} onChange={(e) => setProviderDeliveryFilter(e.target.value)} className="h-10 rounded-lg border border-border bg-white px-3 outline-none focus:ring-2 focus:ring-caramel"><option value="">All</option>{['SENT','DELIVERED','READ','FAILED','UNKNOWN'].map(s => <option key={s} value={s}>{s === 'SENT' ? 'SENT (accepted)' : s}</option>)}</select></label>
            <label className="grid gap-1 text-sm"><span className="font-medium">Channel</span><select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)} className="h-10 rounded-lg border border-border bg-white px-3 outline-none focus:ring-2 focus:ring-caramel"><option value="">All</option><option value="WHATSAPP">WHATSAPP</option><option value="EMAIL">EMAIL</option></select></label>
            <label className="grid gap-1 text-sm"><span className="font-medium">Event Type</span><input value={eventFilter} onChange={(e) => setEventFilter(e.target.value)} placeholder="e.g. ORDER_PLACED" className="h-10 rounded-lg border border-border bg-white px-3 outline-none focus:ring-2 focus:ring-caramel" /></label>
          </div>

          {actionMessage && <div className="mt-4 rounded-lg border border-border bg-cream/40 p-3 text-sm">{actionMessage}</div>}
          {messagesError && <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{messagesError}</div>}

          {messagesLoading ? (
            <div className="mt-4 rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">Loading message history…</div>
          ) : messages.length === 0 ? (
            <div className="mt-4 rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">No messages found for the selected filters.</div>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-lg border border-border">
              <table className="min-w-full text-sm">
                <thead className="bg-cream/40 text-left">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Recipient</th>
                    <th className="px-3 py-2 font-semibold">Event</th>
                    <th className="px-3 py-2 font-semibold">Channel</th>
                    <th className="px-3 py-2 font-semibold">Order / Reference</th>
                    <th className="px-3 py-2 font-semibold">Outbox status</th>
                    <th className="px-3 py-2 font-semibold">Provider delivery</th>
                    <th className="px-3 py-2 font-semibold">Timestamp</th>
                    <th className="px-3 py-2 font-semibold">Provider Message ID</th>
                    <th className="px-3 py-2 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-white">
                  {messages.map((m) => {
                    const pStatus = providerDeliveryLabel(m.providerDeliveryStatus)
                    return (
                      <tr key={m.id}>
                        <td className="px-3 py-2 align-top"><div className="font-medium text-primary break-all">{m.recipient}</div></td>
                        <td className="px-3 py-2 align-top">{m.eventType}</td>
                        <td className="px-3 py-2 align-top">{m.channel}</td>
                        <td className="px-3 py-2 align-top"><div>{m.orderNumber ?? '—'}</div><div className="text-xs text-muted-foreground">{m.referenceNumber ?? ''}</div></td>
                        <td className="px-3 py-2 align-top">
                          <span className="inline-flex rounded-full border border-border px-2 py-0.5 text-xs font-semibold" title="Internal outbox processing status">{m.status}</span>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <span className="inline-flex rounded-full border border-border px-2 py-0.5 text-xs font-semibold" title={providerDeliveryDescription(pStatus)} aria-label={`Provider delivery status: ${pStatus}`}>{pStatus}</span>
                          <div className="mt-1 text-[11px] text-muted-foreground leading-snug">{pStatus === 'SENT' ? 'Accepted by Meta' : pStatus === 'UNKNOWN' ? 'No provider update' : 'Provider callback'}</div>
                        </td>
                        <td className="px-3 py-2 align-top whitespace-nowrap">{formatDate(m.createdAt)}</td>
                        <td className="px-3 py-2 align-top break-all text-xs text-muted-foreground">{m.metaMessageId ?? '—'}</td>
                        <td className="px-3 py-2 align-top">
                          <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => void openDetail(m.id)} className="rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-cream/50">Details</button>
                            {canRetry(m.status) && (
                              <button type="button" disabled={retryingId === m.id} onClick={() => void retryMessage(m.id)} className="rounded-lg bg-caramel px-2.5 py-1.5 text-xs font-semibold text-caramel-foreground disabled:opacity-60">{retryingId === m.id ? 'Retrying…' : 'Retry'}</button>
                            )}
                            {m.channel === 'WHATSAPP' && (
                              <a href={waLink(m.recipient, `Hi, this is Bluebell Bakehouse regarding ${m.orderNumber ?? m.referenceNumber ?? 'your request'}.`)} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-cream/50">Open WhatsApp</a>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between gap-3 text-sm">
            <p className="text-muted-foreground">Page {pagination.page} of {Math.max(1, pagination.totalPages)} · {pagination.total} total</p>
            <div className="flex gap-2">
              <button type="button" disabled={page <= 1 || messagesLoading} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-50">Previous</button>
              <button type="button" disabled={page >= Math.max(1, pagination.totalPages) || messagesLoading} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-50">Next</button>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-primary">Customer Consent Status</h2>
                <p className="text-sm text-muted-foreground">Visibility only. Consent cannot be bypassed from this screen.</p>
              </div>
              <button type="button" onClick={() => void fetchConsents(1)} className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-cream/50">Apply</button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <label className="grid gap-1 text-sm"><span className="font-medium">Search phone</span><input value={consentSearch} onChange={(e) => setConsentSearch(e.target.value)} className="h-10 rounded-lg border border-border bg-white px-3 outline-none focus:ring-2 focus:ring-caramel" /></label>
              <label className="grid gap-1 text-sm"><span className="font-medium">Category</span><select value={consentCategory} onChange={(e) => setConsentCategory(e.target.value as 'TRANSACTIONAL' | 'MARKETING')} className="h-10 rounded-lg border border-border bg-white px-3 outline-none focus:ring-2 focus:ring-caramel"><option value="TRANSACTIONAL">TRANSACTIONAL</option><option value="MARKETING">MARKETING</option></select></label>
              <label className="grid gap-1 text-sm"><span className="font-medium">Status</span><select value={consentStatus} onChange={(e) => setConsentStatus(e.target.value)} className="h-10 rounded-lg border border-border bg-white px-3 outline-none focus:ring-2 focus:ring-caramel"><option value="">All</option><option value="GRANTED">GRANTED</option><option value="DENIED">DENIED</option><option value="WITHDRAWN">WITHDRAWN</option></select></label>
            </div>
            {consentsLoading ? (
              <div className="mt-4 rounded-lg border border-border p-6 text-sm text-muted-foreground">Loading consent records…</div>
            ) : consents.length === 0 ? (
              <div className="mt-4 rounded-lg border border-border p-6 text-sm text-muted-foreground">No consent records found.</div>
            ) : (
              <div className="mt-4 space-y-3">
                {consents.map((c) => {
                  const transactional = c.transactional ?? {
                    status: c.status,
                    hasConsent: c.hasConsent,
                    source: c.source ?? null,
                    consentTimestamp: c.consentTimestamp ?? null,
                    optOutTimestamp: c.optOutTimestamp ?? null,
                    withdrawalReason: c.withdrawalReason ?? null,
                  }
                  const marketing = c.marketing ?? {
                    status: 'DENIED' as const,
                    hasConsent: false,
                    source: null,
                    consentTimestamp: null,
                    optOutTimestamp: null,
                    withdrawalReason: null,
                  }
                  return (
                    <div key={c.id} className="rounded-xl border border-border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-primary break-all">{c.phone}</p>
                        <span className="inline-flex rounded-full border border-border px-2 py-0.5 text-xs font-semibold">Filter: {consentCategory}</span>
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-lg border border-border bg-cream/20 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Transactional</p>
                            <span className="inline-flex rounded-full border border-border px-2 py-0.5 text-[11px] font-semibold">{transactional.status}</span>
                          </div>
                          <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                            <p>Has consent: {transactional.hasConsent ? 'Yes' : 'No'}</p>
                            <p>Source: {transactional.source ?? '—'}</p>
                            <p>Granted: {formatDate(transactional.consentTimestamp)}</p>
                            <p>Opt-out: {formatDate(transactional.optOutTimestamp)}</p>
                          </div>
                          {transactional.withdrawalReason && <p className="mt-2 text-xs text-muted-foreground">Reason: {transactional.withdrawalReason}</p>}
                        </div>
                        <div className="rounded-lg border border-border bg-cream/20 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Marketing</p>
                            <span className="inline-flex rounded-full border border-border px-2 py-0.5 text-[11px] font-semibold">{marketing.status}</span>
                          </div>
                          <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                            <p>Has consent: {marketing.hasConsent ? 'Yes' : 'No'}</p>
                            <p>Source: {marketing.source ?? '—'}</p>
                            <p>Granted: {formatDate(marketing.consentTimestamp)}</p>
                            <p>Opt-out: {formatDate(marketing.optOutTimestamp)}</p>
                          </div>
                          {marketing.withdrawalReason && <p className="mt-2 text-xs text-muted-foreground">Reason: {marketing.withdrawalReason}</p>}
                        </div>
                      </div>
                      <div className="mt-3">
                        <a href={waLink(c.phone, 'Hi, this is Bluebell Bakehouse. How can we help you?')} target="_blank" rel="noopener noreferrer" className="inline-flex rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-cream/50">Manual WhatsApp link</a>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <div className="mt-4 flex items-center justify-between gap-3 text-sm">
              <p className="text-muted-foreground">Page {consentPagination.page} of {Math.max(1, consentPagination.totalPages)}</p>
              <div className="flex gap-2">
                <button type="button" disabled={consentPage <= 1 || consentsLoading} onClick={() => setConsentPage((p) => Math.max(1, p - 1))} className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-50">Previous</button>
                <button type="button" disabled={consentPage >= Math.max(1, consentPagination.totalPages) || consentsLoading} onClick={() => setConsentPage((p) => p + 1)} className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-50">Next</button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-primary">Event-specific Notification Preferences</h2>
            <p className="mt-1 text-sm text-muted-foreground">Enable or disable WhatsApp notifications per event type. Consent is still required per customer and cannot be bypassed.</p>
            {prefsError && <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{prefsError}</div>}
            {prefsLoading ? (
              <div className="mt-4 rounded-lg border border-border p-6 text-sm text-muted-foreground">Loading preferences…</div>
            ) : (
              <div className="mt-4 space-y-3">
                {preferences.map((p) => (
                  <div key={p.eventType} className="flex items-center justify-between gap-3 rounded-xl border border-border p-4">
                    <div>
                      <p className="font-medium text-primary">{p.eventType}</p>
                      <p className="text-xs text-muted-foreground">Updated: {formatDate(p.updatedAt ?? null)}{p.updatedBy ? ` · by ${p.updatedBy}` : ''}</p>
                    </div>
                    <label className="inline-flex items-center gap-2 text-sm">
                      <span>{p.enabled ? 'Enabled' : 'Disabled'}</span>
                      <input type="checkbox" checked={p.enabled} disabled={savingPref === p.eventType} onChange={(e) => void updatePreference(p.eventType, e.target.checked)} className="h-4 w-4" />
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {(detailLoading || detailError || selected) && (
          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-primary">Message Detail</h2>
              <button type="button" onClick={() => { setSelected(null); setDetailError('') }} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-cream/50">Close</button>
            </div>
            {detailLoading && <p className="mt-3 text-sm text-muted-foreground">Loading details…</p>}
            {detailError && <p className="mt-3 text-sm text-destructive">{detailError}</p>}
            {selected && (() => {
              const pStatus = providerDeliveryLabel(selected.message.providerDeliveryStatus)
              return (
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="space-y-3 text-sm">
                    <div className="rounded-xl border border-border p-4 space-y-2">
                      <h3 className="font-semibold text-primary">Outbox (internal processing)</h3>
                      <p><span className="font-semibold">Recipient:</span> {selected.message.recipient}</p>
                      <p><span className="font-semibold">Event:</span> {selected.message.eventType}</p>
                      <p><span className="font-semibold">Channel:</span> {selected.message.channel}</p>
                      <p><span className="font-semibold">Outbox status:</span> <span className="inline-flex rounded-full border border-border px-2 py-0.5 text-xs font-semibold">{selected.message.status}</span></p>
                      <p><span className="font-semibold">Order:</span> {selected.message.orderNumber ?? '—'}</p>
                      <p><span className="font-semibold">Custom cake ref:</span> {selected.message.referenceNumber ?? '—'}</p>
                      <p><span className="font-semibold">Template:</span> {selected.message.templateName ?? '—'}</p>
                      <p><span className="font-semibold">Outbox created:</span> {formatDate(selected.message.createdAt)}</p>
                      <p><span className="font-semibold">Outbox updated:</span> {formatDate(selected.message.updatedAt)}</p>
                      {canRetry(selected.message.status) && (
                        <button type="button" disabled={retryingId === selected.message.id} onClick={() => void retryMessage(selected.message.id)} className="mt-2 rounded-lg bg-caramel px-3 py-2 text-sm font-semibold text-caramel-foreground disabled:opacity-60">{retryingId === selected.message.id ? 'Retrying…' : 'Retry (eligible, idempotent)'}</button>
                      )}
                    </div>
                    <div className="rounded-xl border border-border p-4">
                      <h3 className="font-semibold text-primary">Retry / Error Info (safe)</h3>
                      <p className="mt-2">Attempts: {selected.retryHistory.attemptCount} / {selected.retryHistory.maxAttempts}</p>
                      <p>Next retry: {formatDate(selected.retryHistory.nextRetryAt)}</p>
                      <p className="break-words">Last error: {selected.retryHistory.lastError ?? '—'}</p>
                    </div>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="rounded-xl border border-border p-4 space-y-2">
                      <h3 className="font-semibold text-primary">Provider Delivery (exact outbox correlation)</h3>
                      <p><span className="font-semibold">Provider message ID:</span> <span className="break-all">{selected.message.metaMessageId ?? '—'}</span></p>
                      <p><span className="font-semibold">Provider delivery status:</span> <span className="inline-flex rounded-full border border-border px-2 py-0.5 text-xs font-semibold">{pStatus}</span></p>
                      <p className="text-xs text-muted-foreground">{providerDeliveryDescription(pStatus)}</p>
                      <div className="mt-2 grid gap-1">
                        <p><span className="font-semibold">Provider sent (accepted):</span> {formatDate(selected.message.providerSentAt)}</p>
                        <p><span className="font-semibold">Provider delivered:</span> {formatDate(selected.message.providerDeliveredAt)}</p>
                        <p><span className="font-semibold">Provider read:</span> {formatDate(selected.message.providerReadAt)}</p>
                        <p><span className="font-semibold">Provider failed:</span> {formatDate(selected.message.providerFailedAt)}</p>
                      </div>
                      <div className="mt-2">
                        <p className="font-semibold">Provider failure details (sanitized)</p>
                        <p>Code: {selected.message.providerErrorCode ?? '—'}</p>
                        <p className="break-words">Message: {selected.message.providerErrorMessage ?? '—'}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">Provider event timestamps are shown only when supplied by callbacks. “Provider sent (accepted)” is not confirmed delivery.</p>
                    </div>
                    <div className="rounded-xl border border-border p-4">
                      <h3 className="font-semibold text-primary">Correlated WhatsApp Message Records (exact ID only)</h3>
                      <p className="mt-1 text-xs text-muted-foreground">{selected.correlation?.note ?? (selected.message.metaMessageId ? 'Related records matched by exact provider message ID only.' : 'No provider message ID available; unrelated same-phone WhatsApp records are not shown as correlated.')}</p>
                      {selected.relatedWhatsAppMessages.length === 0 ? (
                        <p className="mt-2 text-muted-foreground">No exactly correlated WhatsApp message records found.</p>
                      ) : (
                        <ul className="mt-2 space-y-2">
                          {selected.relatedWhatsAppMessages.map((rm) => (
                            <li key={rm.id} className="rounded-lg border border-border p-2">
                              <p><span className="font-medium">{rm.direction}</span> · {rm.status} · {formatDate(rm.createdAt)}</p>
                              <p className="text-xs text-muted-foreground break-all">Meta ID: {rm.messageId}</p>
                              {rm.errorMessage && <p className="text-xs text-destructive break-words">Error: {rm.errorMessage}</p>}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              )
            })()}
          </section>
        )}
      </div>
    </AdminLayout>
  )
}

export default withAdminAuth(AdminWhatsAppPage)
