import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get('path')
  if (!path) return NextResponse.json({ error: 'path fehlt' }, { status: 400 })

  try {
    const res = await fetch(`http://148.251.181.111:4335/${path}`, {
      next: { revalidate: 10 }
    })
    if (!res.ok) return new NextResponse(null, { status: res.status })

    const contentType = res.headers.get('content-type') || 'image/jpeg'
    const buffer = await res.arrayBuffer()

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=10',
      }
    })
  } catch {
    return new NextResponse(null, { status: 502 })
  }
}