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

// Liefert alle (nicht abgelaufenen) Papierkorb-Einträge des Owners.
// Räumt nebenbei automatisch alle abgelaufenen Einträge (server-weit) auf.
export async function GET(req: NextRequest) {
  const ownerUuid = await getMinecraftUuid(req.cookies.get('session_token')?.value)
  if (!ownerUuid) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  // Automatisches Aufräumen: abgelaufene Einträge server-weit löschen
  await supabaseAdmin.from('claim_trash').delete().lt('expires_at', new Date().toISOString())

  const { data, error } = await supabaseAdmin
    .from('claim_trash')
    .select('id, group_name, claims_snapshot, deleted_at, expires_at')
    .eq('owner_uuid', ownerUuid)
    .order('deleted_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Nur die Anzahl der Chunks zurückgeben, nicht den vollen Snapshot (spart Bandbreite)
  const entries = (data || []).map(e => ({
    id: e.id,
    group_name: e.group_name,
    chunk_count: Array.isArray(e.claims_snapshot) ? e.claims_snapshot.length : 0,
    deleted_at: e.deleted_at,
    expires_at: e.expires_at,
  }))

  return NextResponse.json({ entries })
}