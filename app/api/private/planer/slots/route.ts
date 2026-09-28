import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { checkOrigin } from '@/app/lib/csrf'
import { getPrivateUser } from '@/app/lib/private-auth'
import { apiError, csrf, forbidden } from '@/app/lib/private-crud'

// Stundenplan-Zellen: welches Fach liegt an welchem Wochentag in welcher Stunde?
// GET /api/private/planer/slots — alle Zellen
// PUT /api/private/planer/slots — { weekday: 1–6, period_no: 1–20, subject_id: number | null, room?: string }
//     subject_id = null → Zelle leeren

export async function GET(req: NextRequest) {
  try {
    const user = await getPrivateUser(req)
    if (!user) return forbidden()
    const r = await pool.query(
      `SELECT id, weekday, period_no, subject_id, room FROM timetable_slots WHERE user_id = $1 ORDER BY weekday, period_no`,
      [user.id]
    )
    return NextResponse.json(r.rows, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    return apiError(err, 'GET slots')
  }
}

export async function PUT(req: NextRequest) {
  try {
    if (!checkOrigin(req)) return csrf()
    const user = await getPrivateUser(req)
    if (!user) return forbidden()
    const b = await req.json().catch(() => null)
    const weekday = Number(b?.weekday)
    const periodNo = Number(b?.period_no)
    if (!Number.isInteger(weekday) || weekday < 1 || weekday > 6) return NextResponse.json({ error: 'Ungültiger Wochentag' }, { status: 400 })
    if (!Number.isInteger(periodNo) || periodNo < 1 || periodNo > 20) return NextResponse.json({ error: 'Ungültige Stunde' }, { status: 400 })

    if (b.subject_id === null || b.subject_id === undefined || b.subject_id === '') {
      await pool.query('DELETE FROM timetable_slots WHERE user_id = $1 AND weekday = $2 AND period_no = $3', [user.id, weekday, periodNo])
      return NextResponse.json({ ok: true, cleared: true })
    }

    const subjectId = Number(b.subject_id)
    const s = await pool.query('SELECT 1 FROM timetable_subjects WHERE id = $1 AND user_id = $2', [subjectId, user.id])
    if (!s.rows[0]) return NextResponse.json({ error: 'Fach nicht gefunden' }, { status: 400 })
    const room = typeof b.room === 'string' ? b.room.trim().slice(0, 40) || null : null

    const r = await pool.query(
      `INSERT INTO timetable_slots (user_id, weekday, period_no, subject_id, room)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, weekday, period_no)
       DO UPDATE SET subject_id = EXCLUDED.subject_id, room = EXCLUDED.room, updated_at = NOW()
       RETURNING id, weekday, period_no, subject_id, room`,
      [user.id, weekday, periodNo, subjectId, room]
    )
    return NextResponse.json(r.rows[0])
  } catch (err) {
    return apiError(err, 'PUT slots')
  }
}