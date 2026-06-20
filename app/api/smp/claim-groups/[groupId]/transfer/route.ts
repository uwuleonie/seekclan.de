import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'
import { isGroupLockedByTransfer } from '@/app/lib/claim-transfer-lock'

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

// Body: { receiverUuid: string, receiverName: string }
// Erstellt eine neue Übertragungsanfrage für eine Gruppe.
export async function POST(req: NextRequest, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params
  const account = await getMinecraftAccount(req.cookies.get('session_token')?.value)
  if (!account?.uuid) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { data: group } = await supabaseAdmin
    .from('claim_groups')
    .select('id, owner_uuid')
    .eq('id', groupId)
    .single()
  if (!group || group.owner_uuid !== account.uuid) {
    return NextResponse.json({ error: 'Gruppe nicht gefunden oder gehört dir nicht' }, { status: 404 })
  }

  if (await isGroupLockedByTransfer(groupId)) {
    return NextResponse.json({ error: 'Für diese Gruppe läuft bereits eine Übertragung' }, { status: 409 })
  }

  const body = await req.json()
  const { receiverUuid, receiverName } = body
  if (!receiverUuid || !receiverName) {
    return NextResponse.json({ error: 'Empfänger erforderlich' }, { status: 400 })
  }
  if (receiverUuid === account.uuid) {
    return NextResponse.json({ error: 'Du kannst nicht an dich selbst übertragen' }, { status: 400 })
  }

  const { count } = await supabaseAdmin
    .from('claims')
    .select('id', { count: 'exact', head: true })
    .eq('group_id', groupId)

  const { data: transfer, error } = await supabaseAdmin
    .from('claim_transfers')
    .insert({
      group_id: Number(groupId),
      sender_uuid: account.uuid,
      sender_name: account.username,
      receiver_uuid: receiverUuid,
      receiver_name: receiverName,
      chunk_count: count || 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, transfer })
}

// Sender zieht eine offene Anfrage selbst zurück.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params
  const account = await getMinecraftAccount(req.cookies.get('session_token')?.value)
  if (!account?.uuid) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { error } = await supabaseAdmin
    .from('claim_transfers')
    .update({ status: 'cancelled' })
    .eq('group_id', groupId)
    .eq('sender_uuid', account.uuid)
    .eq('status', 'pending')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}