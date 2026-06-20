import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

async function getMinecraftAccount(token: string | undefined) {
  if (!token) return null
  const { data: session } = await supabaseAdmin
    .from('sessions')
    .select('user_id, expires_at')
    .eq('token', token)
    .single()
  if (!session || new Date(session.expires_at) < new Date()) return null

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('minecraft_uuid, minecraft_username')
    .eq('id', session.user_id)
    .single()
  return user ? { uuid: user.minecraft_uuid as string | null, username: user.minecraft_username as string | null } : null
}

// Body: { action: 'accept' | 'decline', keepPermissions?: boolean }
export async function POST(req: NextRequest, { params }: { params: Promise<{ transferId: string }> }) {
  const { transferId } = await params
  const account = await getMinecraftAccount(req.cookies.get('session_token')?.value)
  if (!account?.uuid) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { data: transfer } = await supabaseAdmin
    .from('claim_transfers')
    .select('*')
    .eq('id', transferId)
    .single()
  if (!transfer || transfer.receiver_uuid !== account.uuid) {
    return NextResponse.json({ error: 'Anfrage nicht gefunden oder gehört dir nicht' }, { status: 404 })
  }
  if (transfer.status !== 'pending') {
    return NextResponse.json({ error: 'Diese Anfrage ist nicht mehr offen' }, { status: 409 })
  }
  if (new Date(transfer.expires_at) < new Date()) {
    await supabaseAdmin.from('claim_transfers').update({ status: 'expired' }).eq('id', transferId)
    return NextResponse.json({ error: 'Diese Anfrage ist abgelaufen' }, { status: 410 })
  }

  const body = await req.json()
  const { action, keepPermissions } = body

  if (action === 'decline') {
    await supabaseAdmin.from('claim_transfers').update({ status: 'declined' }).eq('id', transferId)
    return NextResponse.json({ success: true, status: 'declined' })
  }

  if (action !== 'accept') {
    return NextResponse.json({ error: 'Ungültige Aktion' }, { status: 400 })
  }

  const groupId = transfer.group_id

  const { data: claimsInGroup, error: claimsError } = await supabaseAdmin
    .from('claims')
    .select('id')
    .eq('group_id', groupId)
  if (claimsError) return NextResponse.json({ error: claimsError.message }, { status: 500 })
  const claimIds = (claimsInGroup || []).map(c => c.id)

  // Besitzer der Gruppe und aller ihrer Claims wechseln
  const { error: groupUpdateError } = await supabaseAdmin
    .from('claim_groups')
    .update({ owner_uuid: account.uuid, owner_name: account.username })
    .eq('id', groupId)
  if (groupUpdateError) return NextResponse.json({ error: groupUpdateError.message }, { status: 500 })

  const { error: claimsUpdateError } = await supabaseAdmin
    .from('claims')
    .update({ owner_uuid: account.uuid, owner_name: account.username })
    .eq('group_id', groupId)
  if (claimsUpdateError) return NextResponse.json({ error: claimsUpdateError.message }, { status: 500 })

  // Permissions/Trusts je nach Wahl des Empfängers behalten oder löschen
  if (keepPermissions === false) {
    if (claimIds.length > 0) {
      await supabaseAdmin.from('claim_permissions').delete().or(`claim_id.in.(${claimIds.join(',')}),group_id.eq.${groupId}`)
      await supabaseAdmin.from('claim_trusts').delete().in('claim_id', claimIds)
    }
  } else {
    // owner_uuid auf den neuen Besitzer aktualisieren, damit die Owner-Verifizierung weiter funktioniert
    if (claimIds.length > 0) {
      await supabaseAdmin.from('claim_permissions').update({ owner_uuid: account.uuid })
        .or(`claim_id.in.(${claimIds.join(',')}),group_id.eq.${groupId}`)
      await supabaseAdmin.from('claim_trusts').update({ owner_uuid: account.uuid, owner_name: account.username })
        .in('claim_id', claimIds)
    }
  }

  await supabaseAdmin.from('claim_transfers').update({ status: 'accepted' }).eq('id', transferId)

  return NextResponse.json({ success: true, status: 'accepted' })
}