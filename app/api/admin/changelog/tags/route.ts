import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

async function checkStaff(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const { data: session } = await supabaseAdmin.from('sessions').select('user_id').eq('token', token).single()
  if (!session) return null
  const { data: user } = await supabaseAdmin.from('users').select('id, clan_role').eq('id', session.user_id).single()
  if (!user) return null
  const staff = user.clan_role?.toLowerCase() === 'admin' || user.clan_role?.toLowerCase() === 'mod'
  return staff ? user : null
}

// Alle Tags laden (öffentlich lesbar, damit die /changelog-Seite Farben anzeigen kann)
export async function GET() {
  const { data: tags, error } = await supabaseAdmin
    .from('changelog_tags')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tags: tags || [] })
}

// Body: { name: string, color: string, requires_version?: boolean }
export async function POST(req: NextRequest) {
  const staff = await checkStaff(req)
  if (!staff) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { name, color, requires_version } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name erforderlich' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('changelog_tags')
    .insert({ name: name.trim(), color: color || '#7C3AED', requires_version: !!requires_version })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: 'Fehler beim Erstellen (Name evtl. schon vorhanden)' }, { status: 500 })
  return NextResponse.json({ success: true, tag: data })
}

// Body: { id: number }
export async function DELETE(req: NextRequest) {
  const staff = await checkStaff(req)
  if (!staff) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID erforderlich' }, { status: 400 })

  const { error } = await supabaseAdmin.from('changelog_tags').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'Fehler beim Löschen' }, { status: 500 })
  return NextResponse.json({ success: true })
}