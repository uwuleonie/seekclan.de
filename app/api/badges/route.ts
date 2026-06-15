import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

export async function GET() {
  const { data: badges } = await supabaseAdmin
    .from('clan_badges')
    .select('*')
    .order('name', { ascending: true })

  return NextResponse.json({ badges: badges || [] })
}