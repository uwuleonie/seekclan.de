import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

async function getStaffUser(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const { data: session } = await supabaseAdmin.from('sessions').select('user_id').eq('token', token).single()
  if (!session) return null
  const { data: user } = await supabaseAdmin.from('users').select('id, username, clan_role').eq('id', session.user_id).single()
  if (!user) return null
  const staff = user.clan_role?.toLowerCase() === 'admin' || user.clan_role?.toLowerCase() === 'mod'
  return staff ? user : null
}

// Body: { username: string } - fügt einen Spieler als Teilnehmer zum Ticket hinzu.
// Nur für Admins/Mods.
export async function POST(req: NextRequest, { params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params
  const staffUser = await getStaffUser(req)
  if (!staffUser) return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  const body = await req.json()
  const { username } = body
  if (!username) return NextResponse.json({ error: 'Username erforderlich' }, { status: 400 })

  const { data: target } = await supabaseAdmin.from('users').select('id, username').eq('username', username).single()
  if (!target) return NextResponse.json({ error: 'Spieler nicht gefunden' }, { status: 404 })

  const { error } = await supabaseAdmin
    .from('support_ticket_participants')
    .insert({ ticket_id: ticketId, user_id: target.id })
  if (error) return NextResponse.json({ error: 'Spieler ist bereits Teilnehmer oder ein Fehler ist aufgetreten' }, { status: 400 })

  const { data: ticket } = await supabaseAdmin.from('support_tickets').select('subject').eq('id', ticketId).single()
  await supabaseAdmin.from('notifications').insert({
    user_id: target.id,
    category: 'leadership',
    title: `Du wurdest zu einem Ticket hinzugefügt`,
    body: ticket?.subject || null,
    link: `/support/${ticketId}`,
  })

  return NextResponse.json({ success: true })
}