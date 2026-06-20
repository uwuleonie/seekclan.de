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
  return session.user_id as number
}

// Liefert, ob der eingeloggte Spieler das Claims-Tutorial schon gesehen hat.
export async function GET(req: NextRequest) {
  const userId = await getUserId(req.cookies.get('session_token')?.value)
  if (!userId) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('seen_claims_tutorial')
    .eq('id', userId)
    .single()

  return NextResponse.json({ seen: !!user?.seen_claims_tutorial })
}

// Markiert das Tutorial als gesehen.
export async function POST(req: NextRequest) {
  const userId = await getUserId(req.cookies.get('session_token')?.value)
  if (!userId) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { error } = await supabaseAdmin
    .from('users')
    .update({ seen_claims_tutorial: true })
    .eq('id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}