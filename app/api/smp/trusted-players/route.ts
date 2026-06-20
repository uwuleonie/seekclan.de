import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

async function getMinecraftUuid(token: string | undefined) {
  if (!token) return null
  const { data: session } = await supabaseAdmin
    .from('sessions')
    .select('user_id, expires_at')
    .eq('token', token)
    .single()
  if (!session || new Date(session.expires_at) < new Date()) return null

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('minecraft_uuid')
    .eq('id', session.user_id)
    .single()
  return user?.minecraft_uuid as string | null
}

// Liefert eine zusammengeführte Übersicht aller Spieler, die irgendwo beim
// eingeloggten Owner auftauchen — per vollem Trust (claim_trusts) oder per
// individuellen Permissions (claim_permissions), inkl. wo genau (Chunk/Gruppe/global).
export async function GET(req: NextRequest) {
  const ownerUuid = await getMinecraftUuid(req.cookies.get('session_token')?.value)
  if (!ownerUuid) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const [trustsRes, permsRes, claimsRes, groupsRes] = await Promise.all([
    supabaseAdmin.from('claim_trusts').select('*').eq('owner_uuid', ownerUuid),
    supabaseAdmin.from('claim_permissions').select('*').eq('owner_uuid', ownerUuid).not('target_uuid', 'is', null),
    supabaseAdmin.from('claims').select('id, name, chunk_x, chunk_z, world').eq('owner_uuid', ownerUuid),
    supabaseAdmin.from('claim_groups').select('id, name').eq('owner_uuid', ownerUuid),
  ])

  if (trustsRes.error) return NextResponse.json({ error: trustsRes.error.message }, { status: 500 })
  if (permsRes.error) return NextResponse.json({ error: permsRes.error.message }, { status: 500 })
  if (claimsRes.error) return NextResponse.json({ error: claimsRes.error.message }, { status: 500 })
  if (groupsRes.error) return NextResponse.json({ error: groupsRes.error.message }, { status: 500 })

  const claimNameFor = (claimId: number | null) => {
    if (!claimId) return null
    const c = claimsRes.data?.find(c => c.id === claimId)
    return c ? (c.name || `Chunk ${c.chunk_x},${c.chunk_z}`) : `Claim #${claimId}`
  }
  const groupNameFor = (groupId: number | null) => {
    if (!groupId) return null
    const g = groupsRes.data?.find(g => g.id === groupId)
    return g ? (g.name || `Gruppe #${groupId}`) : `Gruppe #${groupId}`
  }

  // Pro Spieler (uuid) alles zusammenführen
  type PlayerEntry = {
    uuid: string
    name: string
    trusts: { scope: 'claim' | 'global'; claimId: number | null; label: string }[]
    permissions: { scope: string; claimId: number | null; groupId: number | null; label: string; permission: string; allowed: boolean }[]
  }
  const byUuid = new Map<string, PlayerEntry>()

  const ensure = (uuid: string, name: string) => {
    if (!byUuid.has(uuid)) byUuid.set(uuid, { uuid, name, trusts: [], permissions: [] })
    return byUuid.get(uuid)!
  }

  for (const t of trustsRes.data || []) {
    const entry = ensure(t.trusted_uuid, t.trusted_name)
    const label = t.scope === 'global' ? 'Global (alle Claims)' : (claimNameFor(t.claim_id) || 'Unbekannter Claim')
    entry.trusts.push({ scope: t.scope, claimId: t.claim_id, label })
  }

  for (const p of permsRes.data || []) {
    const entry = ensure(p.target_uuid, p.target_name || p.target_uuid)
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