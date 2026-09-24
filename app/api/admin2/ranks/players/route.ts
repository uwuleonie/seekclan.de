import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { isUuid, isValidMcName, nameToProfile, uuidToName } from '@/app/lib/mojang'

async function getUser(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const s = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  if (!s.rows[0]) return null
  const u = await pool.query('SELECT id, username, clan_role FROM users WHERE id = $1', [s.rows[0].user_id])
  return u.rows[0] || null
}

async function checkWrite(req: NextRequest) {
  const user = await getUser(req)
  if (!user || !['administrator', 'owner'].includes(user.clan_role)) return null
  return user
}

// Eintraege, bei denen statt eines Namens nur die UUID gespeichert ist, mit dem echten Namen reparieren
async function fixUuidNames(rows: { uuid: string; player_name: string }[]) {
  const broken = rows.filter(r => !r.player_name || isUuid(r.player_name)).slice(0, 20)
  await Promise.all(broken.map(async r => {
    const name = await uuidToName(r.uuid)
    if (name) {
      await pool.query('UPDATE mc_player_ranks SET player_name = $2 WHERE uuid = $1', [r.uuid, name])
      r.player_name = name
    }
  }))
}

// GET — alle Spieler mit Rang
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user || !['administrator', 'owner', 'teammitglied'].includes(user.clan_role))
    return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const result = await pool.query(
    `SELECT pr.uuid, pr.player_name, pr.assigned_by, pr.assigned_at,
            r.id as rank_id, r.name, r.display_name, r.color, r.tab_prefix, r.chat_prefix, r.priority
     FROM mc_player_ranks pr
     JOIN mc_ranks r ON pr.rank_id = r.id
     ORDER BY r.priority DESC, LOWER(pr.player_name) ASC`
  )
  await fixUuidNames(result.rows)
  return NextResponse.json({ players: result.rows })
}

// POST — Rang per Spielername vergeben (UUID wird automatisch ermittelt)
export async function POST(req: NextRequest) {
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const inputName = String(body.player_name || '').trim()
  const rankId = Number(body.rank_id)

  if (!isValidMcName(inputName)) return NextResponse.json({ error: 'Ungültiger Minecraft-Name' }, { status: 400 })
  if (!rankId) return NextResponse.json({ error: 'Rang erforderlich' }, { status: 400 })

  const rankCheck = await pool.query('SELECT id FROM mc_ranks WHERE id = $1', [rankId])
  if (!rankCheck.rows[0]) return NextResponse.json({ error: 'Rang nicht gefunden' }, { status: 404 })

  // 1. Spieler schon bekannt (war schon mal online)?
  let uuid: string | null = null
  let playerName = inputName
  const known = await pool.query(
    'SELECT uuid, player_name FROM mc_player_ranks WHERE LOWER(player_name) = LOWER($1) LIMIT 1',
    [inputName]
  )
  if (known.rows[0]) {
    uuid = known.rows[0].uuid
    playerName = known.rows[0].player_name
  } else {
    // 2. Sonst bei Mojang nachschlagen
    const profile = await nameToProfile(inputName)
    if (profile) { uuid = profile.uuid; playerName = profile.name }
  }
  if (!uuid) return NextResponse.json({ error: `Minecraft-Spieler "${inputName}" nicht gefunden` }, { status: 404 })

  await pool.query(
    `INSERT INTO mc_player_ranks (uuid, player_name, rank_id, assigned_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (uuid) DO UPDATE SET rank_id = $3, assigned_by = $4, assigned_at = now(), player_name = $2`,
    [uuid, playerName, rankId, user.username]
  )
  return NextResponse.json({ success: true, uuid, player_name: playerName })
}

// DELETE — Rang entziehen = zurueck auf Standard-Rang
export async function DELETE(req: NextRequest) {
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const { uuid } = await req.json().catch(() => ({}))
  if (!uuid) return NextResponse.json({ error: 'uuid erforderlich' }, { status: 400 })
  const def = await pool.query('SELECT id FROM mc_ranks WHERE is_default = true LIMIT 1')
  if (def.rows[0]) {
    await pool.query(
      `UPDATE mc_player_ranks SET rank_id = $2, assigned_by = $3, assigned_at = now() WHERE uuid = $1`,
      [uuid, def.rows[0].id, user.username]
    )
  } else {
    await pool.query('DELETE FROM mc_player_ranks WHERE uuid = $1', [uuid])
  }
  return NextResponse.json({ success: true })
}