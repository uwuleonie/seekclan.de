import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { mcAnzeigenameSql } from '@/app/lib/smp-namen'

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

export async function GET(req: NextRequest) {
  const ownerUuid = await getMinecraftUuid(req.cookies.get('session_token')?.value)
  if (!ownerUuid) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  let trustsRes, permsRes, claimsRes, groupsRes
  try {
    [trustsRes, permsRes, claimsRes, groupsRes] = await Promise.all([
      pool.query(`SELECT t.*, ${mcAnzeigenameSql('t.trusted_uuid', 't.trusted_name')} AS trusted_anzeigename FROM claim_trusts t WHERE t.owner_uuid = $1`, [ownerUuid]),
      pool.query(`SELECT p.*, ${mcAnzeigenameSql('p.target_uuid', 'p.target_name')} AS target_anzeigename FROM claim_permissions p WHERE p.owner_uuid = $1 AND p.target_uuid IS NOT NULL`, [ownerUuid]),
      pool.query('SELECT id, name, chunk_x, chunk_z, world FROM claims WHERE owner_uuid = $1', [ownerUuid]),
      pool.query('SELECT id, name FROM claim_groups WHERE owner_uuid = $1', [ownerUuid]),
    ])
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  const claimNameFor = (claimId: number | null) => {
    if (!claimId) return null
    const c = claimsRes.rows?.find((c: any) => c.id === claimId)
    return c ? (c.name || `Chunk ${c.chunk_x},${c.chunk_z}`) : `Claim #${claimId}`
  }
  const groupNameFor = (groupId: number | null) => {
    if (!groupId) return null
    const g = groupsRes.rows?.find((g: any) => g.id === groupId)
    return g ? (g.name || `Gruppe #${groupId}`) : `Gruppe #${groupId}`
  }

  type PlayerEntry = {
    uuid: string
    name: string
    /** Anzeigename (nur Anzeige) – name bleibt der Minecraft-Name (Köpfe) */
    anzeigename: string
    trusts: { scope: 'claim' | 'global'; claimId: number | null; label: string }[]
    permissions: { scope: string; claimId: number | null; groupId: number | null; label: string; permission: string; allowed: boolean }[]
  }
  const byUuid = new Map<string, PlayerEntry>()

  const ensure = (uuid: string, name: string, anzeigename?: string | null) => {
    if (!byUuid.has(uuid)) byUuid.set(uuid, { uuid, name, anzeigename: anzeigename || name, trusts: [], permissions: [] })
    return byUuid.get(uuid)!
  }

  for (const t of trustsRes.rows || []) {
    const entry = ensure(t.trusted_uuid, t.trusted_name, t.trusted_anzeigename)
    const label = t.scope === 'global' ? 'Global (alle Claims)' : (claimNameFor(t.claim_id) || 'Unbekannter Claim')
    entry.trusts.push({ scope: t.scope, claimId: t.claim_id, label })
  }

  for (const p of permsRes.rows || []) {
    const entry = ensure(p.target_uuid, p.target_name || p.target_uuid, p.target_anzeigename)
    let label = 'Global'
    if (p.scope === 'chunk_player') label = claimNameFor(p.claim_id) || 'Unbekannter Claim'
    else if (p.scope === 'group_player') label = groupNameFor(p.group_id) || 'Unbekannte Gruppe'
    entry.permissions.push({
      scope: p.scope, claimId: p.claim_id, groupId: p.group_id,
      label, permission: p.permission, allowed: p.allowed,
    })
  }

  return NextResponse.json({ players: Array.from(byUuid.values()) })
}