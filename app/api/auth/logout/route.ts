import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('session_token')?.value

    if (token) {
      await supabaseAdmin.from('sessions').delete().eq('token', token)
    }

    const response = NextResponse.json({ success: true })
    response.cookies.delete('session_token')
    return response
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 })
  }
}