'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { withAdminAuth } from '@/components/admin/admin-auth'
import AdminLayout from '@/components/admin/admin-layout'

type ReportType = {
  id: string
  name: string
  description: string
  endpoint: string
  fileName: string
}

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportType[]>([
    {
      id: 'sales',
      name: 'Sales Report',
      description: 'Daily sales breakdown with payment method analysis.',
      endpoint: '/api/admin/analytics/reports/sales',
      fileName: 'Bluebell Bakehouse Sales Report.pdf',
    },
    {
      id: 'products',
      name: 'Product Performance Report',
      description: 'Product-level sales, COGS, and profitability analysis.',
      endpoint: '/api/admin/analytics/reports/products',
      fileName: 'Bluebell Bakehouse Product Report.pdf',
    },
    {
      id: 'customers',
      name: 'Customer Intelligence Report',
      description: 'Customer spending, order frequency, and retention analysis.',
      endpoint: '/api/admin/analytics/reports/customers',
      fileName: 'Bluebell Bakehouse Customer Report.pdf',
    },
    {
      id: 'financial',
      name: 'Financial Report',
      description: 'Revenue, costs, fees, taxes, and net contribution analysis.',
      endpoint: '/api/admin/analytics/reports/financial',
      fileName: 'Bluebell Bakehouse Financial Report.pdf',
    },
  ])

  async function downloadReport(endpoint: string, fileName: string) {
    try {
      const response = await fetch(endpoint, {
        cache: 'no-store',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Unable to download report')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Unable to download report')
    }
  }

  return (
    <AdminLayout>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-medium text-primary">
              Bluebell Bakehouse Admin
            </p>
            <Link
              href="/admin"
              className="text-sm text-muted-foreground hover:underline"
            >
              ← Back to Dashboard
            </Link>
            <h1 className="mt-3 text-3xl font-bold text-primary">
              Reports & Exports
            </h1>
            <p className="mt-2 text-muted-foreground">
              Download professional reports in PDF format.
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/"
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              View Store
            </Link>
          </div>
        </div>

        {/* Reports Grid */}
        <section className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {reports.map((report) => (
            <div
              key={report.id}
              className="rounded-xl border border-border bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-primary">
                    {report.name}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {report.description}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 border-blue-100">
                  PDF
                </span>
              </div>
              <button
                type="button"
                onClick={() => downloadReport(report.endpoint, report.fileName)}
                className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-white px-4 py-3 text-sm font-medium text-primary hover:bg-muted"
              >
                Download PDF
              </button>
            </div>
          ))}
        </section>

        {/* Info Section */}
        <section className="mt-8 rounded-xl border border-border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-primary mb-4">
            About Reports
          </h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <span className="text-sm font-medium text-primary">✓</span>
              <div>
                <p className="font-medium text-primary">Professional PDF Reports</p>
                <p className="text-sm text-muted-foreground">
                  All reports are generated as professional PDF documents with
                  your bakery branding.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-sm font-medium text-primary">✓</span>
              <div>
                <p className="font-medium text-primary">Date Filter Support</p>
                <p className="text-sm text-muted-foreground">
                  All reports respect the date range filter selected on the
                  corresponding analytics page.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-sm font-medium text-primary">✓</span>
              <div>
                <p className="font-medium text-primary">Secure Access</p>
                <p className="text-sm text-muted-foreground">
                  All reports require admin authentication and are generated
                  securely on the server.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-sm font-medium text-primary">✓</span>
              <div>
                <p className="font-medium text-primary">Real-time Data</p>
                <p className="text-sm text-muted-foreground">
                  Reports are generated from live data, ensuring accuracy at
                  the time of download.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </AdminLayout>
  )
}