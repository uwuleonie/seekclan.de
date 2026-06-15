import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('session_token')?.value
    if (!token) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

    const { data: session } = await supabaseAdmin
      .from('sessions')
      .select('user_id')
      .eq('token', token)
      .single()

    if (!session) return NextResponse.json({ error: 'Session abgelaufen' }, { status: 401 })

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('username, clan_role')
      .eq('id', session.user_id)
      .single()

    if (!user || user.clan_role !== 'admin') {
      
      return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
    }

    const { id, role, join_date, discord_tag } = await req.json()

    if (!id) return NextResponse.json({ error: 'ID erforderlich' }, { status: 400 })

    const updates: any = {}
    if (role) updates.role = role
    if (join_date) updates.join_date = join_date
    if (discord_tag !== undefined) updates.discord_tag = discord_tag

    const { error } = await supabaseAdmin
      .from('clan_members')
      .update(updates)
      .eq('id', id)

    if (error) return NextResponse.json({ error: 'Fehler beim Aktualisieren' }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 })
  }
}