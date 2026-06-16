import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('session_token')?.value
    if (!token) return NextResponse.json({ user: null })

    const { data: session } = await supabaseAdmin
      .from('sessions')
      .select('user_id')
      .eq('token', token)
      .single()

    if (!session) return NextResponse.json({ user: null })

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, username, minecraft_username, clan_role, discord_username, spotify_access_token, biography')
      .eq('id', session.user_id)
      .single()

    if (!user) return NextResponse.json({ user: null })

    return NextResponse.json({ user })
  } catch {
    return NextResponse.json({ user: null })
  }
}