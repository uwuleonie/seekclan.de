import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

export async function GET() {
  try {
    const { data: members, error } = await supabaseAdmin
      .from('clan_members')
      .select('id, display_name, role, join_date')
      .order('join_date', { ascending: true })

    if (error) {
      return NextResponse.json({ error: 'Fehler beim Laden' }, { status: 500 })
    }

    return NextResponse.json({ members: members || [] })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 })
  }
}