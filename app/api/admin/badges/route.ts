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
    .select('username,clan_role')
    .eq('id', session.user_id)
    .single()

  if (!user || user.clan_role !== 'admin') return null
  return user
}

// Alle Badges laden
export async function GET(req: NextRequest) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { data: badges, error } = await supabaseAdmin
    .from('clan_badges')
    .select('*')
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: 'Fehler beim Laden' }, { status: 500 })
  return NextResponse.json({ badges: badges || [] })
}

// Badge erstellen
export async function POST(req: NextRequest) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { name, icon_url, erreichbar } = await req.json()
  if (!name || !icon_url) return NextResponse.json({ error: 'Name und Icon-URL erforderlich' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('clan_badges')
    .insert({ name, icon_url, erreichbar: erreichbar ?? true })

  if (error) return NextResponse.json({ error: 'Fehler beim Erstellen' }, { status: 500 })
  return NextResponse.json({ success: true })
}

// Badge löschen
export async function DELETE(req: NextRequest) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID erforderlich' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('clan_badges')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: 'Fehler beim Löschen' }, { status: 500 })
  return NextResponse.json({ success: true })
}