import { NextRequest } from 'next/server'
import { pool } from '@/app/lib/db'
import {
  BdoCategory, BdoEdition, BdoNominee, BdoResult, BdoTip, BdoCategoryScore, scoreTip,
} from '@/app/lib/ballondor'

export async function getSessionUser(req: NextRequest): Promise<{ id: string; username: string; clan_role: string | null } | null> {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const s = await pool.query('SELECT user_id, expires_at FROM sessions WHERE token = $1', [token])
  const session = s.rows[0]
  if (!session || new Date(session.expires_at) < new Date()) return null
  const u = await pool.query('SELECT id, username, clan_role FROM users WHERE id = $1', [session.user_id])
  return u.rows[0] ?? null
}

export async function requireAdmin(req: NextRequest) {
  const u = await getSessionUser(req)
  if (!u || (u.clan_role !== 'owner' && u.clan_role !== 'administrator')) return null
  return u
}

// Edition per Slug laden, sonst die aktive, sonst die neueste
export async function resolveEdition(slug: string | null): Promise<BdoEdition | null> {
  if (slug) {
    const r = await pool.query('SELECT * FROM bdo_editions WHERE slug = $1', [slug])
    if (r.rows[0]) return r.rows[0]
  }
  const r = await pool.query('SELECT * FROM bdo_editions ORDER BY is_active DESC, created_at DESC LIMIT 1')
  return r.rows[0] ?? null
}

export async function loadEditionData(editionId: number) {
  const [cats, noms, links, results] = await Promise.all([
    pool.query('SELECT * FROM bdo_categories WHERE edition_id = $1 ORDER BY sort, id', [editionId]),
    pool.query('SELECT * FROM bdo_nominees WHERE edition_id = $1 ORDER BY name', [editionId]),
    pool.query(
      `SELECT cn.category_id, cn.nominee_id FROM bdo_category_nominees cn
       JOIN bdo_categories c ON c.id = cn.category_id WHERE c.edition_id = $1`, [editionId]),
    pool.query(
      `SELECT r.* FROM bdo_results r JOIN bdo_categories c ON c.id = r.category_id WHERE c.edition_id = $1`, [editionId]),
  ])
  const byCat = new Map<number, number[]>()
  for (const l of links.rows) {
    if (!byCat.has(l.category_id)) byCat.set(l.category_id, [])
    byCat.get(l.category_id)!.push(l.nominee_id)
  }
  const categories: BdoCategory[] = cats.rows.map((c: any) => ({ ...c, scoring: c.scoring ?? {}, nominee_ids: byCat.get(c.id) ?? [] }))
  const nominees: BdoNominee[] = noms.rows.map((n: any) => ({
    ...n,
    birthdate: n.birthdate ? new Date(n.birthdate).toISOString().slice(0, 10) : null,
    stats: Array.isArray(n.stats) ? n.stats : [],
  }))
  const allResults: BdoResult[] = results.rows
  return { categories, nominees, allResults }
}

// Punkte aller Tipper einer Ausgabe (Schlüssel = Username bzw. Gastname,
// genau wie im UCL-Tippspiel)
export async function computePoints(editionId: number) {
  const { categories, allResults } = await loadEditionData(editionId)
  const published = new Map(allResults.filter(r => r.published_at).map(r => [r.category_id, r]))
  const tips = await pool.query(
    `SELECT t.category_id, t.pick_nominee_id, t.ranking, u.username, t.gast_name
     FROM bdo_tips t JOIN bdo_categories c ON c.id = t.category_id
     LEFT JOIN users u ON u.id = t.user_id
     WHERE c.edition_id = $1`, [editionId])

  const byKey = new Map<string, { key: string; points: number; details: BdoCategoryScore[]; tipCount: number }>()
  for (const t of tips.rows) {
    const key = t.gast_name || t.username
    if (!key) continue
    if (!byKey.has(key)) byKey.set(key, { key, points: 0, details: [], tipCount: 0 })
    const entry = byKey.get(key)!
    entry.tipCount++
    const cat = categories.find(c => c.id === t.category_id)
    if (!cat) continue
    const tip: BdoTip = { category_id: t.category_id, pick_nominee_id: t.pick_nominee_id, ranking: t.ranking }
    const s = scoreTip(cat, tip, published.get(cat.id))
    entry.points += s.points
    entry.details.push(s)
  }
  return [...byKey.values()]
}