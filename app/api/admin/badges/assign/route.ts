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

// Badge zuweisen
export async function POST(req: NextRequest) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { member_id, badge_id } = await req.json()
  if (!member_id || !badge_id) return NextResponse.json({ error: 'Member-ID und Badge-ID erforderlich' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('clan_member_badges')
    .insert({ member_id, badge_id })

  if (error) return NextResponse.json({ error: 'Fehler beim Zuweisen' }, { status: 500 })
  return NextResponse.json({ success: true })
}

// Badge entfernen
export async function DELETE(req: NextRequest) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { member_id, badge_id } = await req.json()
  if (!member_id || !badge_id) return NextResponse.json({ error: 'Member-ID und Badge-ID erforderlich' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('clan_member_badges')
    .delete()
    .eq('member_id', member_id)
    .eq('badge_id', badge_id)

  if (error) return NextResponse.json({ error: 'Fehler beim Entfernen' }, { status: 500 })
  return NextResponse.json({ success: true })
}