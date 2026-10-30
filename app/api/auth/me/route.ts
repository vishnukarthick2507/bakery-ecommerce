import { NextRequest, NextResponse } from 'next/server'

const backendUrl =
  process.env.BACKEND_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'https://bakery-ecommerce-txuz.onrender.com'

export async function GET(req: NextRequest) {
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
