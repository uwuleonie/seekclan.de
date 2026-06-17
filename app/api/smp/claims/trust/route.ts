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
  return user?.minecraft_uuid || null
}

// Trust hinzufügen/aktualisieren
export async function POST(req: NextRequest) {
  const ownerUuid = await getMinecraftUuid(req.cookies.get('session_token')?.value)
  if (!ownerUuid) return NextResponse.json({ error: 'Nicht eingeloggt oder kein Minecraft-Account verknüpft' }, { status: 401 })

  const body = await req.json()
  const { trusted_uuid, trusted_name, claim_id, permissions } = body

  if (!trusted_uuid || !trusted_name) {
    return NextResponse.json({ error: 'Spieler fehlt' }, { status: 400 })
  }

  // claim_id muss entweder null (global) sein oder einem Claim gehören, der dem User gehört
  if (claim_id !== null && claim_id !== undefined) {
    const { data: claim } = await supabaseAdmin
      .from('claims')
      .select('id, owner_uuid')
      .eq('id', claim_id)
      .single()
    if (!claim || claim.owner_uuid !== ownerUuid) {
      return NextResponse.json({ error: 'Claim gehört dir nicht' }, { status: 403 })
    }
  }

  const perms = permissions || {}
  const row: Record<string, any> = {
    owner_uuid: ownerUuid,
    trusted_uuid,
    trusted_name,
    claim_id: claim_id ?? null,
    perm_build: !!perms.build,
    perm_break: !!perms.break,
    perm_containers: !!perms.containers,
    perm_doors: !!perms.doors,
    perm_mobs: !!perms.mobs,
    perm_redstone: !!perms.redstone,
  }

  // Bestehenden Trust für diese Kombination löschen, dann neu einfügen (kein Unique-Constraint in der DB)
  let deleteQuery = supabaseAdmin
    .from('claim_trusts')
    .delete()
    .eq('owner_uuid', ownerUuid)
    .eq('trusted_uuid', trusted_uuid)

  if (claim_id === null || claim_id === undefined) {
    deleteQuery = deleteQuery.is('claim_id', null)
  } else {
    deleteQuery = deleteQuery.eq('claim_id', claim_id)
  }
  await deleteQuery

  const { error } = await supabaseAdmin.from('claim_trusts').insert(row)
  if (error) return NextResponse.json({ error: 'Speichern fehlgeschlagen' }, { status: 500 })

  return NextResponse.json({ success: true })
}

// Trust entfernen
export async function DELETE(req: NextRequest) {
  const ownerUuid = await getMinecraftUuid(req.cookies.get('session_token')?.value)
  if (!ownerUuid) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const body = await req.json()
  const { trusted_uuid, claim_id } = body
  if (!trusted_uuid) return NextResponse.json({ error: 'Spieler fehlt' }, { status: 400 })

  let query = supabaseAdmin
    .from('claim_trusts')
    .delete()
    .eq('owner_uuid', ownerUuid)
    .eq('trusted_uuid', trusted_uuid)

  if (claim_id === null || claim_id === undefined) {
    query = query.is('claim_id', null)
  } else {
    query = query.eq('claim_id', claim_id)
  }

  const { error } = await query
  if (error) return NextResponse.json({ error: 'Löschen fehlgeschlagen' }, { status: 500 })

  return NextResponse.json({ success: true })
}