'use client'

export function withAdminAuth<P extends object>(
  Component: React.ComponentType<P>,
) {
  // Server-side Next.js middleware protects /admin/* routes and redirects
  // unauthenticated requests to /admin/login. This wrapper preserves the
  // existing HOC pattern without inspecting localStorage.
  return function AdminAuthWrapper(props: P) {
    return <Component {...props} />
  }
}
