import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

export async function GET() {
  const { data: games } = await supabaseAdmin
    .from('wm_games')
    .select('*')
    .order('kickoff', { ascending: true })

  return NextResponse.json({ games: games || [] })
}