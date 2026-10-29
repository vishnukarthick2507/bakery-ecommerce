import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Server-side route protection for /admin/*.
 *
 * The admin login endpoint sets an httpOnly `admin-token` cookie on the
 * response. The browser stores this cookie (the login page sends
 * credentials: 'include' so Set-Cookie is honoured), and it is sent on
 * subsequent same-origin requests. This middleware reads that cookie and
 * verifies it against the existing backend /api/auth/verify endpoint
 * (which validates the JWT signature and confirms the admin exists in MongoDB).
 *
 * /admin/login remains publicly accessible.
 * All other /admin/* routes require a valid, server-verified admin session.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Admin login is public.
  if (pathname === '/admin/login') {
    return NextResponse.next()
  }

  // Protect every other /admin/* route.
  if (pathname.startsWith('/admin/')) {
    const token = request.cookies.get('admin-token')?.value

    if (!token) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }

    try {
      const apiUrl =
        process.env.BACKEND_INTERNAL_URL ||
        process.env.NEXT_PUBLIC_API_URL ||
        'http://localhost:5000'

      const response = await fetch(`${apiUrl}/api/auth/verify`, {
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        // Invalid / expired / tampered token: not an authenticated admin.
        return NextResponse.redirect(new URL('/admin/login', request.url))
      }
    } catch {
      // Network or parse failure: fail closed, do not grant access.
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
