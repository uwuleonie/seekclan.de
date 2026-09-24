import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { getSessionUser, loadEditionData, resolveEdition } from '@/app/lib/ballondor-server'

// GET /api/ballondor?edition=2026[&gast_name=...]
// Liefert Ausgabe, Kategorien, Nominierte, veröffentlichte Ergebnisse und eigene Tipps
export async function GET(req: NextRequest) {
  try {
    const edition = await resolveEdition(req.nextUrl.searchParams.get('edition'))
    const editionsRes = await pool.query('SELECT slug, title, is_active FROM bdo_editions ORDER BY created_at DESC')
    if (!edition) return NextResponse.json({ edition: null, editions: editionsRes.rows, categories: [], nominees: [], results: [], myTips: [] })

    const { categories, nominees, allResults } = await loadEditionData(edition.id)
    const results = allResults.filter(r => r.published_at)

    const user = await getSessionUser(req)
    const gastName = req.nextUrl.searchParams.get('gast_name')
    let myTips: any[] = []
    if (user || gastName) {
      const r = await pool.query(
        `SELECT t.category_id, t.pick_nominee_id, t.ranking
         FROM bdo_tips t JOIN bdo_categories c ON c.id = t.category_id
         WHERE c.edition_id = $1 AND ${user ? 't.user_id = $2' : 't.gast_name = $2'}`,
        [edition.id, user ? user.id : gastName])
      myTips = r.rows
    }

    return NextResponse.json({ edition, editions: editionsRes.rows, categories, nominees, results, myTips })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}