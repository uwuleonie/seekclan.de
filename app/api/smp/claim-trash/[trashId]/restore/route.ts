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

// Stellt einen Papierkorb-Eintrag wieder her: legt die Gruppe, Claims, Permissions
// und Trusts wieder genauso an, wie sie vor dem Löschen waren.
export async function POST(req: NextRequest, { params }: { params: Promise<{ trashId: string }> }) {
  const { trashId } = await params
  const ownerUuid = await getMinecraftUuid(req.cookies.get('session_token')?.value)
  if (!ownerUuid) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { data: entry } = await supabaseAdmin
    .from('claim_trash')
    .select('*')
    .eq('id', trashId)
    .single()
  if (!entry || entry.owner_uuid !== ownerUuid) {
    return NextResponse.json({ error: 'Eintrag nicht gefunden oder gehört dir nicht' }, { status: 404 })
  }
  if (new Date(entry.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Dieser Eintrag ist bereits abgelaufen' }, { status: 410 })
  }

  const claimsSnapshot: any[] = entry.claims_snapshot || []
  const permissionsSnapshot: any[] = entry.permissions_snapshot || []
  const trustsSnapshot: any[] = entry.trusts_snapshot || []
  if (claimsSnapshot.length === 0) {
    return NextResponse.json({ error: 'Nichts zum Wiederherstellen' }, { status: 400 })
  }

  const oldGroupId = claimsSnapshot[0].group_id

  // Neue Gruppe anlegen (alte ID kann nicht zuverlässig wiederverwendet werden,
  // falls sie inzwischen neu vergeben wurde)
  const { data: newGroup, error: groupError } = await supabaseAdmin
    .from('claim_groups')
    .insert({ owner_uuid: ownerUuid, owner_name: claimsSnapshot[0].owner_name, name: entry.group_name, is_auto: false })
    .select()
    .single()
  if (groupError) return NextResponse.json({ error: groupError.message }, { status: 500 })

  // Claims wiederherstellen, mit neuer group_id, ohne alte id (neue wird vergeben)
  const claimsToInsert = claimsSnapshot.map(c => {
    const { id, ...rest } = c
    return { ...rest, group_id: newGroup.id }
  })
  const { data: restoredClaims, error: claimsError } = await supabaseAdmin
    .from('claims')
    .insert(claimsToInsert)
    .select()
  if (claimsError) return NextResponse.json({ error: claimsError.message }, { status: 500 })

  // Mapping alte claim_id -> neue claim_id, anhand Position (gleiche Reihenfolge wie Snapshot)
  const idMap = new Map<number, number>()
  claimsSnapshot.forEach((old, i) => idMap.set(old.id, restoredClaims[i].id))

  if (permissionsSnapshot.length > 0) {
    const permsToInsert = permissionsSnapshot.map(p => {
      const { id, ...rest } = p
      return {
        ...rest,
        claim_id: rest.claim_id ? (idMap.get(rest.claim_id) ?? null) : null,
        group_id: rest.group_id === oldGroupId ? newGroup.id : rest.group_id,
      }
    })
    await supabaseAdmin.from('claim_permissions').insert(permsToInsert)
  }

  if (trustsSnapshot.length > 0) {
    const trustsToInsert = trustsSnapshot.map(t => {
      const { id, ...rest } = t
      return { ...rest, claim_id: rest.claim_id ? (idMap.get(rest.claim_id) ?? null) : null }
    })
    await supabaseAdmin.from('claim_trusts').insert(trustsToInsert)
  }

  await supabaseAdmin.from('claim_trash').delete().eq('id', trashId)

  return NextResponse.json({ success: true, group: newGroup })
}