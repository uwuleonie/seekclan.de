import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

// Freischaltungen (z.B. "bauserver" ab 24.10. 18:00) — genutzt von SeekNPC und SeekWorlds

async function checkRead(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  const session = sessionResult.rows[0]
  if (!session) return null
  const userResult = await pool.query('SELECT id, clan_role FROM users WHERE id = $1', [session.user_id])
  const user = userResult.rows[0]
  if (!user || !['administrator', 'owner', 'teammitglied'].includes(user.clan_role)) return null
  return user
}

async function checkWrite(req: NextRequest) {
  const user = await checkRead(req)
  if (!user || (user.clan_role !== 'administrator' && user.clan_role !== 'owner')) return null
  return user
}

const KEY_PATTERN = /^[a-z0-9_-]{2,50}$/

// GET /api/admin2/feature-unlocks
export async function GET(req: NextRequest) {
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  try {
    const result = await pool.query(
      `SELECT f.id, f.key, f.label, f.unlock_at, f.created_at, f.updated_at,
              (SELECT COUNT(*)::int FROM lobby_npcs n WHERE n.unlock_id = f.id) AS npc_count
       FROM feature_unlocks f ORDER BY f.unlock_at ASC`
    )
    return NextResponse.json({ unlocks: result.rows })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/admin2/feature-unlocks
// Body JSON: { key, label, unlock_at (ISO-Zeitpunkt) }
export async function POST(req: NextRequest) {
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const key = String(body.key ?? '').trim().toLowerCase()
  const label = String(body.label ?? '').trim()
  const unlockAt = String(body.unlock_at ?? '')

  if (!KEY_PATTERN.test(key)) {
    return NextResponse.json({ error: 'Key: 2–50 Zeichen, nur a-z, 0-9, _ und -' }, { status: 400 })
  }
  if (!label) return NextResponse.json({ error: 'Name erforderlich' }, { status: 400 })
  if (!unlockAt || isNaN(Date.parse(unlockAt))) {
    return NextResponse.json({ error: 'Ungültiger Zeitpunkt' }, { status: 400 })
  }

  try {
    const result = await pool.query(
      `INSERT INTO feature_unlocks (key, label, unlock_at) VALUES ($1, $2, $3) RETURNING id`,
      [key, label, new Date(unlockAt).toISOString()]
    )
    return NextResponse.json({ id: result.rows[0].id })
  } catch (err: any) {
    if (err.code === '23505') return NextResponse.json({ error: `Der Key "${key}" existiert schon` }, { status: 400 })
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}