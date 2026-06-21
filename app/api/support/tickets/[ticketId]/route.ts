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

// Body: { status?: 'open' | 'in_progress' | 'closed', priority?: 'low' | 'normal' | 'high' }
// Nur für Admins/Mods.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params
  const staffUser = await getStaffUser(req)
  if (!staffUser) return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  const body = await req.json()
  const update: Record<string, string> = { updated_at: new Date().toISOString() }
  if (body.status && ['open', 'in_progress', 'closed'].includes(body.status)) update.status = body.status
  if (body.priority && ['low', 'normal', 'high'].includes(body.priority)) update.priority = body.priority

  const { error } = await supabaseAdmin.from('support_tickets').update(update).eq('id', ticketId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}