'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function withAdminAuth<P extends object>(
  Component: React.ComponentType<P>,
) {
  return function AdminAuthWrapper(props: P) {
    const router = useRouter()

    useEffect(() => {
      const token = localStorage.getItem('admin-token')

      if (!token) {
        router.push('/admin/login')
      }
    }, [router])

    return <Component {...props} />
  }
}
