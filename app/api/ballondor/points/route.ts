import { NextRequest, NextResponse } from 'next/server'
import { computePoints, resolveEdition } from '@/app/lib/ballondor-server'

// GET /api/ballondor/points?edition=2026
// Punkte aller Tipper — wird auch vom UCL-Leaderboard genutzt
export async function GET(req: NextRequest) {
  try {
    const edition = await resolveEdition(req.nextUrl.searchParams.get('edition'))
    if (!edition) return NextResponse.json({ edition: null, entries: [] })
    const entries = await computePoints(edition.id)
    return NextResponse.json({ edition: edition.slug, entries })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}