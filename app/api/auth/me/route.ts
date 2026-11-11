import { NextRequest, NextResponse } from 'next/server'

const backendUrl =
  process.env.BACKEND_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_API_URL

export async function GET(req: NextRequest) {
  if (!backendUrl) {
    return NextResponse.json(
      { error: 'Backend service unavailable' },
      { status: 503 }
    )
  }

  const authorization = req.headers.get('authorization')

  const headers: Record<string, string> = {}

  if (authorization) {
    headers.authorization = authorization
  }

  // Forward the browser's httpOnly customer-token cookie so the backend can
  // validate the customer session when the cookie is the source of truth.
  const cookie = req.headers.get('cookie')
  if (cookie) {
    headers.cookie = cookie
  }

  // Forward the original origin so the backend CSRF middleware can validate
  // the request. Same-origin browser requests to Next.js do not include an
  // Origin header, so we reconstruct it from the request URL.
  headers.origin = `${req.nextUrl.protocol}//${req.nextUrl.host}`

  const response = await fetch(
    `${backendUrl.replace(/\/+$/, '')}/api/auth/me`,
    {
      headers,
      cache: 'no-store',
    },
  )

  const data = await response.json()
  return NextResponse.json(data, { status: response.status })
}
