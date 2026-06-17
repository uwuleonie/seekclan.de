import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

export async function GET() {
  const { data: claims } = await supabaseAdmin
    .from('claims')
    .select('id, owner_uuid, owner_name, world, chunk_x, chunk_z')

  return NextResponse.json({ claims: claims || [] })
}