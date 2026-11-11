import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

/**
 * Server-side route protection for /admin and /admin/*.
 *
 * The admin login endpoint sets an httpOnly `admin-token` cookie on the
 * response. The browser stores this cookie (the login page sends
 * credentials: 'include' so Set-Cookie is honoured), and it is sent on
 * subsequent same-origin requests. This middleware reads that cookie and
 * validates it before allowing access to /admin or any nested admin route.
 *
 * /admin/login remains publicly accessible.
 * All other /admin routes require a valid, server-verified admin session.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Admin login is public.
  if (pathname === '/admin/login') {
    return NextResponse.next()
  }

  // Protect /admin dashboard and every nested /admin/* route consistently.
  const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/')

  if (isAdminRoute) {
    const token = request.cookies.get('admin-token')?.value

    if (!token) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }

    // 1. Preferred fast cryptographic verification via jose when JWT_SECRET is available
    const jwtSecret = process.env.JWT_SECRET
    if (jwtSecret) {
      try {
        const secretKey = new TextEncoder().encode(jwtSecret)
        const { payload } = await jwtVerify(token, secretKey)

        // Verify the token carries admin identity and is not a customer token
        if (!payload.adminId || payload.accountType === 'CUSTOMER') {
          return NextResponse.redirect(new URL('/admin/login', request.url))
        }

        return NextResponse.next()
      } catch {
        // Expired, tampered, or invalid token signature
        return NextResponse.redirect(new URL('/admin/login', request.url))
      }
    }

    // 2. Fallback: verification against backend /api/auth/verify endpoint
    try {
      const rawApiUrl =
        process.env.BACKEND_INTERNAL_URL ||
        process.env.NEXT_PUBLIC_API_URL ||
        'http://127.0.0.1:5000'

      const apiUrl = rawApiUrl.trim().replace(/\/+$/, '')

      const response = await fetch(`${apiUrl}/api/auth/verify`, {
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: AbortSignal.timeout(5000),
      })

      if (!response.ok) {
        // Explicit 401/403/invalid response from backend
        return NextResponse.redirect(new URL('/admin/login', request.url))
      }
    } catch {
      // If Next.js is prefetching in the background and backend had a network hiccup,
      // do not redirect the user during prefetch.
      const isPrefetch =
        request.headers.get('Purpose') === 'prefetch' ||
        request.headers.get('Sec-Purpose') === 'prefetch' ||
        request.headers.get('Next-Router-Prefetch') === '1'

      if (!isPrefetch) {
        return NextResponse.redirect(new URL('/admin/login', request.url))
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
}
