import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

export async function GET() {
  const { data: events } = await supabaseAdmin
    .from('smp_events')
    .select('*')
    .gte('event_date', new Date().toISOString())
    .order('event_date', { ascending: true })

  return NextResponse.json({ events: events || [] })
}