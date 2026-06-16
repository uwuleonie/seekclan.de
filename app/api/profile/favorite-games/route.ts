import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

export async function POST(req: NextRequest) {
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

  const body = await req.json()
  const games = body.games

  if (!Array.isArray(games) || games.length > 5) {
    return NextResponse.json({ error: 'Max. 5 Spiele erlaubt' }, { status: 400 })
  }

  // Nur appid + name + icon speichern
  const cleaned = games.map((g: any) => ({
    appid: Number(g.appid),
    name: String(g.name).slice(0, 100),
    icon: String(g.icon),
  }))

  const { error } = await supabaseAdmin
    .from('users')
    .update({ favorite_games: cleaned })
    .eq('id', session.user_id)

  if (error) return NextResponse.json({ error: 'Speichern fehlgeschlagen' }, { status: 500 })

  return NextResponse.json({ success: true })
}