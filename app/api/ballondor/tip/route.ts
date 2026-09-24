import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { getSessionUser } from '@/app/lib/ballondor-server'

// POST /api/ballondor/tip
// body: { category_id, pick_nominee_id }            → Gewinner-Kategorie
//       { category_id, ranking: number[] }           → Ranking-Kategorie (alle Nominierten)
//       + gast_name wenn nicht eingeloggt
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req)
    const body = await req.json()
    const categoryId = Number(body.category_id)
    const gastName: string | null = body.gast_name ? String(body.gast_name).trim() : null
    if (!categoryId) return NextResponse.json({ error: 'Kategorie fehlt' }, { status: 400 })
    if (!user && !gastName) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

    const catRes = await pool.query(
      `SELECT c.id, c.kind, e.tips_close_at FROM bdo_categories c
       JOIN bdo_editions e ON e.id = c.edition_id WHERE c.id = $1`, [categoryId])
    const cat = catRes.rows[0]
    if (!cat) return NextResponse.json({ error: 'Kategorie nicht gefunden' }, { status: 404 })
    if (cat.tips_close_at && new Date(cat.tips_close_at) <= new Date())
      return NextResponse.json({ error: 'Tippschluss ist vorbei' }, { status: 400 })

    const linkRes = await pool.query('SELECT nominee_id FROM bdo_category_nominees WHERE category_id = $1', [categoryId])
    const allowed = new Set<number>(linkRes.rows.map((r: any) => r.nominee_id))

    let pick: number | null = null
    let ranking: number[] | null = null
    if (cat.kind === 'winner') {
      pick = Number(body.pick_nominee_id)
      if (!allowed.has(pick)) return NextResponse.json({ error: 'Ungültige Auswahl' }, { status: 400 })
    } else {
      ranking = Array.isArray(body.ranking) ? body.ranking.map(Number) : []
      const r = ranking as number[]
      const uniq = new Set(r)
      if (r.length !== allowed.size || uniq.size !== r.length || r.some(id => !allowed.has(id)))
        return NextResponse.json({ error: 'Die Rangliste muss jeden Nominierten genau einmal enthalten' }, { status: 400 })
    }

    if (user) {
      await pool.query(
        `INSERT INTO bdo_tips (category_id, user_id, pick_nominee_id, ranking, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (category_id, user_id) WHERE user_id IS NOT NULL
         DO UPDATE SET pick_nominee_id = EXCLUDED.pick_nominee_id, ranking = EXCLUDED.ranking, updated_at = NOW()`,
        [categoryId, user.id, pick, ranking])
    } else {
      await pool.query(
        `INSERT INTO bdo_tips (category_id, gast_name, pick_nominee_id, ranking, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (category_id, gast_name) WHERE gast_name IS NOT NULL
         DO UPDATE SET pick_nominee_id = EXCLUDED.pick_nominee_id, ranking = EXCLUDED.ranking, updated_at = NOW()`,
        [categoryId, gastName, pick, ranking])
    }
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}