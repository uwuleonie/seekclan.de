import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

const VALID_CATEGORIES = [
  'bug', 'clan_application', 'complaint', 'suggestion', 'other',
  'missing_badge', 'whitelist', 'rollback_request', 'player_report', 'account_link',
]

async function getUser(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const { data: session } = await supabaseAdmin.from('sessions').select('user_id').eq('token', token).single()
  if (!session) return null
  const { data: user } = await supabaseAdmin.from('users').select('id, username, clan_role').eq('id', session.user_id).single()
  return user || null
}

const isStaff = (user: { clan_role: string | null }) =>
  user.clan_role?.toLowerCase() === 'admin' || user.clan_role?.toLowerCase() === 'mod'

// Liefert alle Tickets, die der eingeloggte Nutzer sehen darf:
// - Staff (admin/mod) sieht ALLE Tickets
// - Normale Spieler sehen nur Tickets, die sie selbst erstellt haben ODER zu denen
//   sie nachträglich als Teilnehmer hinzugefügt wurden (NIEMALS nur als target_user_id)
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  if (isStaff(user)) {
    const { data: tickets, error } = await supabaseAdmin
      .from('support_tickets')
      .select('*, creator:user_id(username), target_user:target_user_id(username), target_badge:target_badge_id(name)')
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ tickets: tickets || [], isStaff: true })
  }

  const { data: participations } = await supabaseAdmin
    .from('support_ticket_participants')
    .select('ticket_id')
    .eq('user_id', user.id)
  const participantTicketIds = (participations || []).map(p => p.ticket_id)

  const orFilter = participantTicketIds.length > 0
    ? `user_id.eq.${user.id},id.in.(${participantTicketIds.join(',')})`
    : `user_id.eq.${user.id}`

  const { data: tickets, error } = await supabaseAdmin
    .from('support_tickets')
    .select('*, target_user:target_user_id(username), target_badge:target_badge_id(name)')
    .or(orFilter)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ tickets: tickets || [], isStaff: false })
}

// Body: { category, subject, message, priority?, targetUsername?, targetBadgeId? }
export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const body = await req.json()
  const { category, subject, message, priority, targetUsername, targetBadgeId } = body

  if (!VALID_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: 'Ungültige Kategorie' }, { status: 400 })
  }
  if (!subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: 'Betreff und Nachricht erforderlich' }, { status: 400 })
  }

  let targetUserId: string | null = null
  if ((category === 'complaint' || category === 'player_report') && targetUsername) {
    const { data: target } = await supabaseAdmin.from('users').select('id').eq('username', targetUsername).single()
    if (!target) return NextResponse.json({ error: 'Zielspieler nicht gefunden' }, { status: 404 })
    targetUserId = target.id
  }

  const { data: ticket, error } = await supabaseAdmin
    .from('support_tickets')
    .insert({
      user_id: user.id,
      category,
      subject: subject.trim(),
      priority: priority && ['low', 'normal', 'high'].includes(priority) ? priority : 'normal',
      target_user_id: targetUserId,
      target_badge_id: category === 'missing_badge' ? (targetBadgeId || null) : null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabaseAdmin.from('support_messages').insert({
    ticket_id: ticket.id,
    sender_id: user.id,
    is_staff: false,
    body: message.trim(),
  })

  return NextResponse.json({ success: true, ticket })
}