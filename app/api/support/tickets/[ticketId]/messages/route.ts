import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

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

async function canAccessTicket(ticketId: string, userId: string, staff: boolean) {
  if (staff) return true
  const { data: ticket } = await supabaseAdmin.from('support_tickets').select('user_id').eq('id', ticketId).single()
  if (ticket?.user_id === userId) return true
  const { data: participant } = await supabaseAdmin
    .from('support_ticket_participants')
    .select('id')
    .eq('ticket_id', ticketId)
    .eq('user_id', userId)
    .single()
  return !!participant
}

// Liefert den Nachrichtenverlauf eines Tickets.
export async function GET(req: NextRequest, { params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const staff = isStaff(user)
  if (!(await canAccessTicket(ticketId, user.id, staff))) {
    return NextResponse.json({ error: 'Kein Zugriff auf dieses Ticket' }, { status: 403 })
  }

  const { data: messages, error } = await supabaseAdmin
    .from('support_messages')
    .select('*, sender:sender_id(username, clan_role)')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Bei Staff-Nachrichten den echten Namen entfernen, nur die Rolle bleibt sichtbar
  const sanitized = (messages || []).map(m => {
    if (!m.is_staff) return m
    const role = m.sender?.clan_role?.toLowerCase() === 'admin' ? 'Admin' : 'Mod'
    return { ...m, sender: { username: role, clan_role: null } }
  })

  return NextResponse.json({ messages: sanitized })
}

// Body: { message: string }
export async function POST(req: NextRequest, { params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const staff = isStaff(user)
  if (!(await canAccessTicket(ticketId, user.id, staff))) {
    return NextResponse.json({ error: 'Kein Zugriff auf dieses Ticket' }, { status: 403 })
  }

  const body = await req.json()
  const { message } = body
  if (!message?.trim()) return NextResponse.json({ error: 'Nachricht erforderlich' }, { status: 400 })

  const { data: newMessage, error } = await supabaseAdmin
    .from('support_messages')
    .insert({ ticket_id: ticketId, sender_id: user.id, is_staff: staff, body: message.trim() })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabaseAdmin.from('support_tickets').update({ updated_at: new Date().toISOString() }).eq('id', ticketId)

  // Bei Antwort der Leitung: den Ticket-Ersteller (und ggf. zusätzliche Teilnehmer) benachrichtigen
  if (staff) {
    const { data: ticket } = await supabaseAdmin.from('support_tickets').select('user_id, subject').eq('id', ticketId).single()
    const { data: participants } = await supabaseAdmin
      .from('support_ticket_participants')
      .select('user_id')
      .eq('ticket_id', ticketId)

    const recipientIds = new Set<string>()
    if (ticket?.user_id) recipientIds.add(ticket.user_id)
    for (const p of participants || []) recipientIds.add(p.user_id)
    recipientIds.delete(user.id) // sich selbst nicht benachrichtigen

    for (const recipientId of recipientIds) {
      await supabaseAdmin.from('notifications').insert({
        user_id: recipientId,
        category: 'leadership',
        title: `Neue Antwort zu "${ticket?.subject || 'deinem Ticket'}"`,
        body: message.trim().slice(0, 100),
        link: `/support/${ticketId}`,
      })
    }
  }

  return NextResponse.json({ success: true, message: newMessage })
}