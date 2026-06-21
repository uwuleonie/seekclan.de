import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

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

// Liefert alle Benachrichtigungen des eingeloggten Nutzers, neueste zuerst.
export async function GET(req: NextRequest) {
  const userId = await getUserId(req.cookies.get('session_token')?.value)
  if (!userId) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ notifications: data || [] })
}

// Body: { id: number } -> markiert eine einzelne Benachrichtigung als gelesen
// Body: { markAllRead: true } -> markiert alle als gelesen
export async function PATCH(req: NextRequest) {
  const userId = await getUserId(req.cookies.get('session_token')?.value)
  if (!userId) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const body = await req.json()

  if (body.markAllRead) {
    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (body.id) {
    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ read: true })
      .eq('id', body.id)
      .eq('user_id', userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'id oder markAllRead erforderlich' }, { status: 400 })
}