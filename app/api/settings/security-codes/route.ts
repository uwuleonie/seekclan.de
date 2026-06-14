import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('session_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
    }

    const { data: session } = await supabaseAdmin
      .from('sessions')
      .select('user_id, expires_at')
      .eq('token', token)
      .single()

    if (!session || new Date(session.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Session abgelaufen' }, { status: 401 })
    }

    const { data: codes } = await supabaseAdmin
      .from('security_codes')
      .select('is_used')
      .eq('user_id', session.user_id)

    const used_count = codes?.filter(c => c.is_used).length || 0

    return NextResponse.json({ used_count, total: codes?.length || 0 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 })
  }
}