import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { session_token } = await req.json()
  if (!session_token) return NextResponse.json({ error: 'Token erforderlich' }, { status: 400 })

  const response = NextResponse.json({ success: true })
  response.cookies.set('session_token', session_token, {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
    sameSite: 'lax',
  })
  return response
}