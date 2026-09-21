import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

async function checkAccess(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  const session = sessionResult.rows[0]
  if (!session) return null
  const userResult = await pool.query(
    'SELECT id, username, clan_role FROM users WHERE id = $1',
    [session.user_id]
  )
  const user = userResult.rows[0]
  if (!user || !['administrator', 'owner', 'teammitglied'].includes(user.clan_role)) return null
  return user
}

// Item-Definitionen für das Frontend (fest, aus dem Enum)
const EGG_DEFINITIONS = [
  { item_id: 'dragon_egg_1', week: 1, name: 'UCL-Drachenbein (Woche 1)', effect: 'Speed I (120s, CD: 140s)' },
  { item_id: 'dragon_egg_2', week: 2, name: 'UCL-Drachenbein (Woche 2)', effect: 'Speed II (120s, CD: 140s)' },
  { item_id: 'dragon_egg_3', week: 3, name: 'UCL-Drachenbein (Woche 3)', effect: 'Fire Resistance (300s, CD: 320s)' },
  { item_id: 'dragon_egg_4', week: 4, name: 'UCL-Drachenbein (Woche 4)', effect: 'Regeneration I (60s, CD: 75s)' },
  { item_id: 'dragon_egg_5', week: 5, name: 'UCL-Drachenbein (Woche 5)', effect: 'Regeneration II (60s, CD: 75s)' },
  { item_id: 'dragon_egg_6', week: 6, name: 'UCL-Drachenbein (Woche 6)', effect: 'Auto-Totem (CD: 36h nach Tod)' },
  { item_id: 'dragon_egg_7', week: 7, name: 'UCL-Drachenbein (Woche 7)', effect: 'Saturation (20s, CD: 30s)' },
  { item_id: 'dragon_egg_8', week: 8, name: 'UCL-Drachenbein (Woche 8)', effect: 'Elytra-Boost (CD: 30s)' },
]

// GET /api/admin2/admin-items
// Gibt alle vergebenen Items + Item-Definitionen + Cooldowns zurück
export async function GET(req: NextRequest) {
  const user = await checkAccess(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  // Alle vergebenen Items
  const itemsResult = await pool.query(
    `SELECT pai.id, pai.uuid, pai.player_name, pai.item_id,
            pai.granted_at, pai.granted_by,
            -- Cooldown falls aktiv
            aic.cooldown_until,
            -- Totem-Tod-Log (nur Woche 6)
            (SELECT died_at FROM admin_item_totem_deaths WHERE uuid = pai.uuid ORDER BY died_at DESC LIMIT 1)
              AS last_totem_death
     FROM player_admin_items pai
     LEFT JOIN admin_item_cooldowns aic
       ON aic.uuid = pai.uuid AND aic.item_id = pai.item_id
     ORDER BY pai.granted_at DESC`
  )

  return NextResponse.json({
    definitions: EGG_DEFINITIONS,
    items: itemsResult.rows,
  })
}

// POST /api/admin2/admin-items
// Admin vergibt ein Item über das Web-Panel (speichert in DB, Plugin holt es beim nächsten Einloggen)
export async function POST(req: NextRequest) {
  const user = await checkAccess(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { uuid, player_name, item_id } = await req.json()
  if (!uuid || !player_name || !item_id) {
    return NextResponse.json({ error: 'uuid, player_name und item_id erforderlich' }, { status: 400 })
  }

  // Prüfen ob Item bereits vergeben
  const exists = await pool.query(
    'SELECT 1 FROM player_admin_items WHERE uuid = $1 AND item_id = $2',
    [uuid, item_id]
  )
  if (exists.rows.length > 0) {
    return NextResponse.json({ error: 'Dieses Item wurde diesem Spieler bereits vergeben.' }, { status: 409 })
  }

  await pool.query(
    `INSERT INTO player_admin_items (uuid, player_name, item_id, granted_by)
     VALUES ($1, $2, $3, $4)`,
    [uuid, player_name, item_id, user.username]
  )

  return NextResponse.json({ ok: true })
}

// DELETE /api/admin2/admin-items
// Admin entzieht ein Item (z.B. Fehler bei Vergabe)
export async function DELETE(req: NextRequest) {
  const user = await checkAccess(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id fehlt' }, { status: 400 })

  await pool.query('DELETE FROM player_admin_items WHERE id = $1', [id])

  return NextResponse.json({ ok: true })
}

// PATCH /api/admin2/admin-items
// Cooldown eines Spielers zurücksetzen
export async function PATCH(req: NextRequest) {
  const user = await checkAccess(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { uuid, item_id } = await req.json()
  if (!uuid || !item_id) return NextResponse.json({ error: 'uuid und item_id erforderlich' }, { status: 400 })

  await pool.query(
    'DELETE FROM admin_item_cooldowns WHERE uuid = $1 AND item_id = $2',
    [uuid, item_id]
  )

  return NextResponse.json({ ok: true })
}