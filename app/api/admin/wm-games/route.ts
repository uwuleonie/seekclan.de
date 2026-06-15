import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

async function checkAdmin(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null

  const { data: session } = await supabaseAdmin
    .from('sessions')
    .select('user_id')
    .eq('token', token)
    .single()

  if (!session) return null

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('username, clan_role')
    .eq('id', session.user_id)
    .single()

  if (!user || user.clan_role !== 'admin') return null
  return user
}

// Alle Spiele laden
export async function GET(req: NextRequest) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { data: games } = await supabaseAdmin
    .from('wm_games')
    .select('*')
    .order('kickoff', { ascending: true })

  return NextResponse.json({ games: games || [] })
}

// Spiel anlegen
export async function POST(req: NextRequest) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const body = await req.json()
  const { team1, team2, kickoff, gruppe } = body
  const runde = body.runde || 'Gruppenphase'
  if (!team1 || !team2 || !kickoff) return NextResponse.json({ error: 'Team1, Team2 und Anpfiff erforderlich' }, { status: 400 })

  const { error, data } = await supabaseAdmin
    .from('wm_games')
    .insert({ team1, team2, kickoff, gruppe: gruppe || null, runde })
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (error) return NextResponse.json({ error: 'Fehler beim Erstellen' }, { status: 500 })
  return NextResponse.json({ success: true })
}

// Ergebnis eintragen / Spiel bearbeiten
export async function PATCH(req: NextRequest) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { id, result_team1, result_team2, team1, team2, kickoff, gruppe, runde } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID erforderlich' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('wm_games')
    .update({ result_team1, result_team2, team1, team2, kickoff, gruppe, runde })
    .eq('id', id)

  if (error) return NextResponse.json({ error: 'Fehler beim Aktualisieren' }, { status: 500 })
  return NextResponse.json({ success: true })
}

// Spiel löschen
export async function DELETE(req: NextRequest) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID erforderlich' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('wm_games')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: 'Fehler beim Löschen' }, { status: 500 })
  return NextResponse.json({ success: true })
}