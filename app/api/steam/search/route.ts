import { NextRequest, NextResponse } from 'next/server'

// Steam Store Such-API (kein Key nötig)
export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q')
  if (!query || query.length < 2) {
    return NextResponse.json({ games: [] })
  }

  try {
    const res = await fetch(
      `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(query)}&l=german&cc=DE`,
      { next: { revalidate: 60 } }
    )
    const data = await res.json()

    const games = (data?.items || [])
      .filter((item: any) => item.type === 'app')
      .slice(0, 10)
      .map((item: any) => ({
        appid: item.id,
        name: item.name,
        icon: `https://cdn.cloudflare.steamstatic.com/steam/apps/${item.id}/capsule_sm_120.jpg`,
      }))

    return NextResponse.json({ games })
  } catch {
    return NextResponse.json({ games: [] })
  }
}