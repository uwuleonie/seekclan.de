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

    // Nur Owner
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('username')
      .eq('id', session.user_id)
      .single()

    if (!user || user.username !== 'uwuleonie') {
      return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
    }

    const { display_name, role, join_date, discord_tag } = await req.json()

    if (!display_name || !role || !join_date) {
      return NextResponse.json({ error: 'Name, Rolle und Datum erforderlich' }, { status: 400 })
    }

    const { error } = await supabaseAdmin.from('clan_members').insert({
      display_name,
      role,
      join_date,
      discord_tag: discord_tag || null,
    })

    if (error) return NextResponse.json({ error: 'Fehler beim Hinzufügen' }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 })
  }
}