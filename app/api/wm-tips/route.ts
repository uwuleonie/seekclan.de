import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

// Alle Tipps laden (für Leaderboard)
export async function GET() {
  const { data: tips } = await supabaseAdmin
    .from('wm_tips')
    .select(`
      *,
      users (
        username
      )
    `)

  const formatted = (tips || []).map((t: any) => ({
    ...t,
    gast_name: t.gast_name || t.users?.username || t.user_id,
    users: undefined,
  }))

  return NextResponse.json({ tips: formatted })
}

// Tipp abgeben
export async function POST(req: NextRequest) {
  const { game_id, tip_team1, tip_team2, user_id, gast_name } = await req.json()

  if (!game_id || tip_team1 === undefined || tip_team2 === undefined) {
    return NextResponse.json({ error: 'Fehlende Felder' }, { status: 400 })
  }
  if (!user_id && !gast_name) {
    return NextResponse.json({ error: 'User oder Gastname erforderlich' }, { status: 400 })
  }

  // Prüfen ob Anpfiff schon war
  const { data: game } = await supabaseAdmin
    .from('wm_games')
    .select('kickoff')
    .eq('id', game_id)
    .single()

  if (!game) return NextResponse.json({ error: 'Spiel nicht gefunden' }, { status: 404 })
  if (new Date(game.kickoff) <= new Date()) {
    return NextResponse.json({ error: 'Anpfiff bereits vorbei' }, { status: 400 })
  }

  // Upsert — überschreibt bestehenden Tipp
  const { error } = await supabaseAdmin
    .from('wm_tips')
    .upsert(
      user_id
        ? { game_id, user_id, tip_team1, tip_team2 }
        : { game_id, gast_name, tip_team1, tip_team2 },
      { onConflict: user_id ? 'game_id,user_id' : 'game_id,gast_name' }
    )

  if (error) return NextResponse.json({ error: 'Fehler beim Speichern' }, { status: 500 })
  return NextResponse.json({ success: true })
}