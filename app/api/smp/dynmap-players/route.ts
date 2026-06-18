import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const res = await fetch(`http://148.251.181.111:4335/up/world/world/${Date.now()}`, {
      cache: 'no-store',
    })
    if (!res.ok) {
      return NextResponse.json({ players: [] })
    }
    const data = await res.json()
    return NextResponse.json({ players: data.players || [] })
  } catch {
    return NextResponse.json({ players: [] })
  }
}