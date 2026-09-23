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

const EGG_DEFINITIONS = [
  { item_id: 'dragon_egg_1', week: 1, effect: 'Speed I (120s, CD 140s)' },
  { item_id: 'dragon_egg_2', week: 2, effect: 'Speed II (120s, CD 140s)' },
  { item_id: 'dragon_egg_3', week: 3, effect: 'Fire Resistance (300s, CD 320s)' },
  { item_id: 'dragon_egg_4', week: 4, effect: 'Regeneration I (60s, CD 75s)' },
  { item_id: 'dragon_egg_5', week: 5, effect: 'Regeneration II (60s, CD 75s)' },
  { item_id: 'dragon_egg_6', week: 6, effect: 'Auto-Totem (CD 36h nach Tod)' },
  { item_id: 'dragon_egg_7', week: 7, effect: 'Saturation (20s, CD 30s)' },
  { item_id: 'dragon_egg_8', week: 8, effect: 'Elytra-Boost (CD 30s)' },
]

// GET — alle vergebenen Eier inkl. Menü-Status, Cooldown, letzter Totem-Tod
export async function GET(req: NextRequest) {
  const user = await checkAccess(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const result = await pool.query(
    `SELECT pai.id, pai.uuid, pai.player_name, pai.item_id, pai.in_menu,
            pai.granted_at, pai.granted_by,
            aic.cooldown_until,
            (SELECT died_at FROM admin_item_totem_deaths d
              WHERE d.uuid = pai.uuid ORDER BY died_at DESC LIMIT 1) AS last_totem_death
     FROM player_admin_items pai
     LEFT JOIN admin_item_cooldowns aic
       ON aic.uuid = pai.uuid AND aic.item_id = pai.item_id
     ORDER BY pai.granted_at DESC`
  )

  return NextResponse.json({ definitions: EGG_DEFINITIONS, items: result.rows })
}

// POST — Ei vergeben, nur mit Minecraft-Name (UUID wird serverseitig bei Mojang geholt)
export async function POST(req: NextRequest) {
  const user = await checkAccess(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { player_name, item_id } = await req.json()
  if (!player_name || !item_id) {
    return NextResponse.json({ error: 'player_name und item_id erforderlich' }, { status: 400 })
  }
  if (!EGG_DEFINITIONS.some(d => d.item_id === item_id)) {
    return NextResponse.json({ error: 'Unbekanntes Ei' }, { status: 400 })
  }

  const exists = await pool.query(
    'SELECT player_name FROM player_admin_items WHERE item_id = $1',
    [item_id]
  )
  if (exists.rows.length > 0) {
    return NextResponse.json(
      { error: `Dieses Ei wurde bereits an ${exists.rows[0].player_name} vergeben.` },
      { status: 409 }
    )
  }

  const mojang = await fetch(
    `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(player_name)}`
  )
  if (!mojang.ok) {
    return NextResponse.json({ error: `Spieler "${player_name}" nicht gefunden.` }, { status: 404 })
  }
  const data = await mojang.json()
  const id: string = data.id
  const uuid = `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`

  await pool.query(
    `INSERT INTO player_admin_items (uuid, player_name, item_id, granted_by, in_menu)
     VALUES ($1, $2, $3, $4, true)`,
    [uuid, data.name, item_id, user.username]
  )

  return NextResponse.json({ ok: true, player_name: data.name })
}

// DELETE — Ei entziehen
export async function DELETE(req: NextRequest) {
  const user = await checkAccess(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id fehlt' }, { status: 400 })

  await pool.query('DELETE FROM player_admin_items WHERE id = $1', [id])
  return NextResponse.json({ ok: true })
}

// PATCH — action: 'reset_cooldown' | 'return_to_menu'
export async function PATCH(req: NextRequest) {
  const user = await checkAccess(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { action, uuid, item_id } = await req.json()
  if (!uuid || !item_id) {
    return NextResponse.json({ error: 'uuid und item_id erforderlich' }, { status: 400 })
  }

  if (action === 'reset_cooldown') {
    await pool.query(
      'DELETE FROM admin_item_cooldowns WHERE uuid = $1 AND item_id = $2',
      [uuid, item_id]
    )
  } else if (action === 'return_to_menu') {
    await pool.query(
      'UPDATE player_admin_items SET in_menu = true WHERE uuid = $1 AND item_id = $2',
      [uuid, item_id]
    )
  } else {
    return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}