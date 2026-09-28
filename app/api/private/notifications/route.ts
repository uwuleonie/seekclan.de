import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { checkOrigin } from '@/app/lib/csrf'
import { getPrivateUser } from '@/app/lib/private-auth'
import { apiError, csrf, forbidden } from '@/app/lib/private-crud'

// Neuigkeiten-Glocke
// GET  /api/private/notifications?device=<id>  → { items: [...], unread: n }
//      Hinweise, die von DIESEM Gerät ausgelöst wurden (z.B. eigener Upload), werden ausgeblendet.
// POST /api/private/notifications  { action: 'read', ids?: number[] }  (ohne ids = alle gelesen)
//                                  { action: 'clear' }                 (alle gelesenen löschen)

export async function GET(req: NextRequest) {
  try {
    const user = await getPrivateUser(req)
    if (!user) return forbidden()
    const device = req.nextUrl.searchParams.get('device') || null
    const r = await pool.query(
      `SELECT id, kind, title, body, url, created_at, read_at
       FROM private_notifications
       WHERE user_id = $1 AND ($2::text IS NULL OR device_id IS DISTINCT FROM $2)
       ORDER BY created_at DESC
       LIMIT 60`,
      [user.id, device]
    )
    const unread = r.rows.filter(n => !n.read_at).length
    return NextResponse.json({ items: r.rows, unread }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    return apiError(err, 'GET notifications')
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!checkOrigin(req)) return csrf()
    const user = await getPrivateUser(req)
    if (!user) return forbidden()
    const b = await req.json().catch(() => ({}))

    if (b.action === 'read') {
      const ids: number[] = Array.isArray(b.ids) ? b.ids.map(Number).filter(Number.isSafeInteger) : []
      if (ids.length) {
        await pool.query(`UPDATE private_notifications SET read_at = NOW() WHERE user_id = $1 AND id = ANY($2::bigint[]) AND read_at IS NULL`, [user.id, ids])
      } else {
        await pool.query(`UPDATE private_notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL`, [user.id])
      }
      return NextResponse.json({ ok: true })
    }
    if (b.action === 'clear') {
      await pool.query(`DELETE FROM private_notifications WHERE user_id = $1 AND read_at IS NOT NULL`, [user.id])
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 })
  } catch (err) {
    return apiError(err, 'POST notifications')
  }
}