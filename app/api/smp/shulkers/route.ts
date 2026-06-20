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

// Liefert alle eigenen Shulker, inkl. aller darauf gesetzten Trusts
// (sowohl 'shulker'-spezifisch als auch die globalen 'all'-Trusts).
export async function GET(req: NextRequest) {
  const ownerUuid = await getMinecraftUuid(req.cookies.get('session_token')?.value)
  if (!ownerUuid) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { data: shulkers, error: shulkersError } = await supabaseAdmin
    .from('shulkers')
    .select('*')
    .eq('owner_uuid', ownerUuid)
    .order('placed_at', { ascending: false })
  if (shulkersError) return NextResponse.json({ error: shulkersError.message }, { status: 500 })

  const { data: trusts, error: trustsError } = await supabaseAdmin
    .from('shulker_trusts')
    .select('*')
    .eq('owner_uuid', ownerUuid)
  if (trustsError) return NextResponse.json({ error: trustsError.message }, { status: 500 })

  return NextResponse.json({ shulkers: shulkers || [], trusts: trusts || [] })
}