import { NextRequest, NextResponse } from 'next/server'

const backendUrl =
  process.env.BACKEND_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'https://bakery-ecommerce-txuz.onrender.com'

export async function GET(req: NextRequest) {
  const authorization = req.headers.get('authorization')

  if (!authorization) {
    return NextResponse.json(
      { message: 'Authentication required' },
      { status: 401 },
    )
  }

  const response = await fetch(
    `${backendUrl.replace(/\/+$/, '')}/api/auth/me`,
    {
      headers: {
        authorization,
      },
      cache: 'no-store',
    },
  )

  const data = await response.json()
  return NextResponse.json(data, { status: response.status })
}
