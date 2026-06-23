import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

async function getUser(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const { data: session } = await supabaseAdmin.from('sessions').select('user_id').eq('token', token).single()
  if (!session) return null
  const { data: user } = await supabaseAdmin.from('users').select('id, username').eq('id', session.user_id).single()
  return user || null
}

// GET: Liste der von mir blockierten Nutzer
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { data: blocked } = await supabaseAdmin
    .from('blocked_users')
    .select('blocked_id, created_at, users:blocked_id ( username, display_name )')
    .eq('blocker_id', user.id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ blocked: blocked || [] })
}

// POST: Nutzer blockieren. Body: { user_id }
export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { user_id } = await req.json()
  if (!user_id) return NextResponse.json({ error: 'user_id erforderlich' }, { status: 400 })
  if (user_id === user.id) return NextResponse.json({ error: 'Nicht möglich mit dir selbst' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('blocked_users')
    .insert({ blocker_id: user.id, blocked_id: user_id })

  if (error) return NextResponse.json({ error: 'Bereits blockiert' }, { status: 400 })

  return NextResponse.json({ success: true })
}

// DELETE: Nutzer entblockieren. Query-Param: ?user_id=
export async function DELETE(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const userId = req.nextUrl.searchParams.get('user_id')
  if (!userId) return NextResponse.json({ error: 'user_id erforderlich' }, { status: 400 })

  await supabaseAdmin
    .from('blocked_users')
    .delete()
    .eq('blocker_id', user.id)
    .eq('blocked_id', userId)

  return NextResponse.json({ success: true })
}