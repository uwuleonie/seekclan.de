import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

export async function GET() {
  const { data: badges } = await supabaseAdmin
    .from('clan_badges')
    .select(`
      *,
      badge_categories (
        id,
        name,
        color
      )
    `)
    .order('name', { ascending: true })

  const { data: categories } = await supabaseAdmin
    .from('badge_categories')
    .select('*')
    .order('created_at', { ascending: true })

  return NextResponse.json({ badges: badges || [], categories: categories || [] })
}