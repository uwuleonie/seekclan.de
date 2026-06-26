import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

async function getMinecraftUuid(token: string | undefined) {
  if (!token) return null
  const sessionResult = await pool.query(
    'SELECT user_id, expires_at FROM sessions WHERE token = $1',
    [token]
  )
  const session = sessionResult.rows[0]
  if (!session || new Date(session.expires_at) < new Date()) return null

  const userResult = await pool.query(
    'SELECT minecraft_uuid FROM users WHERE id = $1',
    [session.user_id]
  )
  return userResult.rows[0]?.minecraft_uuid as string | null
}

// Liefert detaillierte Aktivitäts-Stats für einen einzelnen Claim oder eine
// ganze Gruppe. Body-Parameter: claim_id ODER group_id (genau einer von beiden).
// Sichtbarkeit: der Owner sieht IMMER seine eigenen Details. Fremde Details sind
// nur einsehbar, wenn der Claim/die Gruppe gerade in den Top 10 des Leaderboards
// steht (wird hier serverseitig erneut geprüft, nicht nur im Frontend versteckt).
export async function GET(req: NextRequest) {
  const claimIdParam = req.nextUrl.searchParams.get('claim_id')
  const groupIdParam = req.nextUrl.searchParams.get('group_id')

  if (!claimIdParam && !groupIdParam) {
    return NextResponse.json({ error: 'claim_id oder group_id ist erforderlich' }, { status: 400 })
  }

  const account = await getMinecraftUuid(req.cookies.get('session_token')?.value)

  try {
    let claimIds: number[]
    let ownerUuid: string
    let meta: any

    if (claimIdParam) {
      const claimResult = await pool.query('SELECT * FROM claims WHERE id = $1', [claimIdParam])
      const claim = claimResult.rows[0]
      if (!claim) return NextResponse.json({ error: 'Claim nicht gefunden' }, { status: 404 })
      claimIds = [claim.id]
      ownerUuid = claim.owner_uuid
      meta = claim
    } else {
      const groupResult = await pool.query('SELECT * FROM claim_groups WHERE id = $1', [groupIdParam])
      const group = groupResult.rows[0]
      if (!group) return NextResponse.json({ error: 'Gruppe nicht gefunden' }, { status: 404 })
      const claimsResult = await pool.query('SELECT id FROM claims WHERE group_id = $1', [groupIdParam])
      claimIds = claimsResult.rows.map(c => c.id)
      ownerUuid = group.owner_uuid
      meta = group
    }

    const isOwner = account && account === ownerUuid

    if (!isOwner) {
      const topField = claimIdParam ? 'claim_id' : 'group_id'
      const topResult = await pool.query(`
        SELECT 1 FROM (
          SELECT c.id AS claim_id, c.group_id,
            COALESCE(SUM(EXTRACT(EPOCH FROM (s.left_at - s.entered_at))), 0) AS total_seconds
          FROM claims c
          LEFT JOIN smp_chunk_sessions s ON s.claim_id = c.id AND s.left_at IS NOT NULL
          WHERE c.is_admin_claim = false
          GROUP BY c.id
          ORDER BY total_seconds DESC
          LIMIT 10
        ) top
        WHERE top.${topField} = $1
      `, [claimIdParam || groupIdParam])

      if (topResult.rows.length === 0) {
        return NextResponse.json({ error: 'Keine Berechtigung, diese Details einzusehen' }, { status: 403 })
      }
    }

    // JOIN gegen smp_player_stats, um lesbare Spielernamen statt roher UUIDs zu
    // liefern - das Frontend soll niemals UUIDs direkt anzeigen müssen.
    const totalsResult = await pool.query(
      `SELECT t.event_type, t.detail, t.player_uuid,
              COALESCE(s.player_name, t.player_uuid) AS player_name,
              SUM(t.total_count) AS total_count
       FROM smp_chunk_activity_totals t
       LEFT JOIN smp_player_stats s ON s.uuid = t.player_uuid
       WHERE t.claim_id = ANY($1)
       GROUP BY t.event_type, t.detail, t.player_uuid, s.player_name
       ORDER BY total_count DESC`,
      [claimIds]
    )

    const playtimeResult = await pool.query(
      `SELECT cs.player_uuid,
              COALESCE(s.player_name, cs.player_uuid) AS player_name,
              COALESCE(SUM(EXTRACT(EPOCH FROM (cs.left_at - cs.entered_at))), 0) AS total_seconds
       FROM smp_chunk_sessions cs
       LEFT JOIN smp_player_stats s ON s.uuid = cs.player_uuid
       WHERE cs.claim_id = ANY($1) AND cs.left_at IS NOT NULL
       GROUP BY cs.player_uuid, s.player_name
       ORDER BY total_seconds DESC`,
      [claimIds]
    )

    return NextResponse.json({
      meta,
      activity: totalsResult.rows,
      playtime: playtimeResult.rows,
    })
  } catch (err: any) {
    return NextResponse.json({ error: `Datenbankfehler: ${err.message}` }, { status: 500 })
  }
}