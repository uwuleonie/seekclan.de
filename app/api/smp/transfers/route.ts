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

// Liefert alle offenen, eingehenden Übertragungsanfragen für den eingeloggten Spieler.
// Markiert nebenbei abgelaufene Anfragen (server-weit) als 'expired'.
export async function GET(req: NextRequest) {
  const myUuid = await getMinecraftUuid(req.cookies.get('session_token')?.value)
  if (!myUuid) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  await supabaseAdmin
    .from('claim_transfers')
    .update({ status: 'expired' })
    .eq('status', 'pending')
    .lt('expires_at', new Date().toISOString())

  const { data, error } = await supabaseAdmin
    .from('claim_transfers')
    .select('*, claim_groups(name)')
    .eq('receiver_uuid', myUuid)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const transfers = (data || []).map((t: any) => ({
    id: t.id,
    groupId: t.group_id,
    groupName: t.claim_groups?.name || `Gruppe #${t.group_id}`,
    senderName: t.sender_name,
    chunkCount: t.chunk_count,
    createdAt: t.created_at,
    expiresAt: t.expires_at,
  }))

  return NextResponse.json({ transfers })
}