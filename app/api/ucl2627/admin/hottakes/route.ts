// Admin: Hottakes des UCL-Tippspiels verwalten (Adminpanel → Tab „Hottakes“)
// GET   ?comp=ucl|uwcl (optional) → { hottakes: [...] } – ohne comp: alle Hottakes aus UCL und UWCL, mit Benutzername
// PATCH { id, status?, hardness?, fulfilled? } → Status (pending/accepted/rejected), Härte (1–3) oder Erfüllung setzen
// Nur für Owner und Administratoren.
//
// Robust gegen ältere Datenbanken: welche Spalten es gibt, wird einmal nachgeschaut (fehlende werden als leer geliefert),
// und users.id wird als Text verglichen – so klappt der Abgleich auch, wenn ucl_hottakes.user_id als text statt uuid angelegt ist.

import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { ALL_SLUGS, getSlugFromParam } from '@/app/lib/ucl-season'

async function checkAdmin(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const s = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  if (!s.rows[0]) return null
  const u = await pool.query('SELECT id, clan_role FROM users WHERE id = $1', [s.rows[0].user_id])
  const user = u.rows[0]
  if (!user || (user.clan_role !== 'owner' && user.clan_role !== 'administrator')) return null
  return user
}

/** Spalten von ucl_hottakes (einmal pro Server-Start nachgeschaut) */
let spaltenCache: Set<string> | null = null
async function spalten(): Promise<Set<string>> {
  if (!spaltenCache) {
    const r = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'ucl_hottakes'")
    spaltenCache = new Set(r.rows.map((x: { column_name: string }) => x.column_name))
  }
  return spaltenCache
}
async function pointsAwardedColumn() { return (await spalten()).has('points_awarded') }

export async function GET(req: NextRequest) {
  try {
    if (!(await checkAdmin(req))) return NextResponse.json({ error: 'Keine Berechtigung – nur Owner und Administratoren' }, { status: 403 })
    const comp = req.nextUrl.searchParams.get('comp')
    const slugs = comp ? [getSlugFromParam(comp)] : ALL_SLUGS
    const sp = await spalten()
    const feld = (name: string, leer: string) => (sp.has(name) ? `h.${name}` : `${leer} AS ${name}`)
    const res = await pool.query(
      `SELECT h.id, h.content, ${feld('valid_until', 'NULL::timestamptz')}, ${feld('status', "'pending'::text")},
              ${feld('hardness', 'NULL::int')}, ${feld('fulfilled', 'NULL::boolean')}, ${feld('created_at', 'NULL::timestamptz')},
              ${sp.has('points_awarded') ? 'COALESCE(h.points_awarded, false)' : 'false'} AS points_awarded,
              u.username, ${feld('gast_name', 'NULL::text')},
              CASE WHEN s.slug LIKE 'uwcl%' THEN 'uwcl' ELSE 'ucl' END AS comp
       FROM ucl_hottakes h
       JOIN ucl_seasons s ON s.id = h.season_id
       LEFT JOIN users u ON u.id::text = h.user_id::text
       WHERE s.slug = ANY($1)
       ORDER BY CASE ${sp.has('status') ? 'h.status' : "'pending'"} WHEN 'pending' THEN 0 WHEN 'accepted' THEN 1 ELSE 2 END,
                ${sp.has('valid_until') ? 'h.valid_until ASC,' : ''} h.id DESC`,
      [slugs]
    )
    return NextResponse.json({ hottakes: res.rows }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: unknown) {
    console.error('ucl2627/admin/hottakes GET', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Fehler' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    if (!(await checkAdmin(req))) return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
    const body = await req.json()
    const id = Number(body.id)
    if (!Number.isInteger(id)) return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 })

    const sets: string[] = []
    const vals: unknown[] = []
    if (body.status !== undefined) {
      if (!['pending', 'accepted', 'rejected'].includes(body.status)) return NextResponse.json({ error: 'Ungültiger Status' }, { status: 400 })
      vals.push(body.status); sets.push(`status = $${vals.length}`)
    }
    if (body.hardness !== undefined) {
      if (body.hardness !== null && ![1, 2, 3].includes(body.hardness)) return NextResponse.json({ error: 'Härte muss 1, 2 oder 3 sein' }, { status: 400 })
      vals.push(body.hardness); sets.push(`hardness = $${vals.length}`)
    }
    if (body.fulfilled !== undefined) {
      if (body.fulfilled !== null && typeof body.fulfilled !== 'boolean') return NextResponse.json({ error: 'Ungültiger Wert für erfüllt' }, { status: 400 })
      vals.push(body.fulfilled); sets.push(`fulfilled = $${vals.length}`)
      // Erfüllt → Punkte gelten als vergeben (die Punkte selbst werden aus Härte + Erfüllung berechnet)
      if (await pointsAwardedColumn()) sets.push(`points_awarded = ${body.fulfilled === true ? 'true' : 'false'}`)
    }
    if (!sets.length) return NextResponse.json({ error: 'Nichts zu ändern' }, { status: 400 })

    vals.push(id)
    const res = await pool.query(`UPDATE ucl_hottakes SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING id`, vals)
    if (!res.rows.length) return NextResponse.json({ error: 'Hottake nicht gefunden' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    console.error('ucl2627/admin/hottakes PATCH', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Fehler' }, { status: 500 })
  }
}