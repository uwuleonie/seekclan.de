import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

// Leitet die User-ID sicher aus der Server-Session ab, statt sie vom Client
// entgegenzunehmen — verhindert, dass jemand Tipps im Namen eines anderen
// eingeloggten Nutzers abgeben/überschreiben kann, indem er dessen user_id mitschickt.
async function getUserId(token: string | undefined) {
  if (!token) return null
  const { data: session } = await supabaseAdmin
    .from('sessions')
    .select('user_id, expires_at')
    .eq('token', token)
    .single()
  if (!session || new Date(session.expires_at) < new Date()) return null
  return session.user_id as string
}

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
  const { game_id, tip_team1, tip_team2, gast_name } = await req.json()

  if (!game_id || tip_team1 === undefined || tip_team2 === undefined) {
    return NextResponse.json({ error: 'Fehlende Felder' }, { status: 400 })
  }

  // Eingeloggte Nutzer: user_id kommt aus der Session, niemals vom Client.
  // Nicht eingeloggte Nutzer: nur als Gast mit gast_name möglich.
  const sessionUserId = await getUserId(req.cookies.get('session_token')?.value)

  if (!sessionUserId && !gast_name) {
    return NextResponse.json({ error: 'Gastname erforderlich, wenn nicht eingeloggt' }, { status: 400 })
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
      sessionUserId
        ? { game_id, user_id: sessionUserId, tip_team1, tip_team2 }
        : { game_id, gast_name, tip_team1, tip_team2 },
      { onConflict: sessionUserId ? 'game_id,user_id' : 'game_id,gast_name' }
    )

  if (error) return NextResponse.json({ error: 'Fehler beim Speichern' }, { status: 500 })
  return NextResponse.json({ success: true })
}