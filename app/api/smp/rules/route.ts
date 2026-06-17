import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

export async function GET() {
  const { data: rules } = await supabaseAdmin
    .from('smp_rules')
    .select('*')
    .order('sort_order', { ascending: true })

  return NextResponse.json({ rules: rules || [] })
}