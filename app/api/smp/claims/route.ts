import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

export async function GET(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { data: session } = await supabaseAdmin
    .from('sessions')
    .select('user_id, expires_at')
    .eq('token', token)
    .single()

  if (!session || new Date(session.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Session abgelaufen' }, { status: 401 })
  }

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('minecraft_uuid, minecraft_username')
    .eq('id', session.user_id)
    .single()

  if (!user?.minecraft_uuid) {
    return NextResponse.json({ claims: [], trusts: [], settings: null, linked: false })
  }

  const { data: claims } = await supabaseAdmin
    .from('claims')
    .select('*')
    .eq('owner_uuid', user.minecraft_uuid)
    .order('claimed_at', { ascending: false })

  const { data: trusts } = await supabaseAdmin
    .from('claim_trusts')
    .select('*')
    .eq('owner_uuid', user.minecraft_uuid)

  const { data: settings } = await supabaseAdmin
    .from('claim_settings')
    .select('*')
    .eq('uuid', user.minecraft_uuid)
    .single()

  const { data: trustedByMe } = await supabaseAdmin
    .from('claim_trusts')
    .select('*')
    .eq('trusted_uuid', user.minecraft_uuid)

  return NextResponse.json({
    claims: claims || [],
    trusts: trusts || [],
    settings: settings || null,
    trustedBy: trustedByMe || [],
    linked: true,
    minecraft_username: user.minecraft_username,
  })
}