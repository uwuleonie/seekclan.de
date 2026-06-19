import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

// GET: Lädt alle öffentlichen Punkte + die eigenen privaten Punkte des Spielers
export async function GET(req: NextRequest) {
  const uuid = req.nextUrl.searchParams.get('uuid')
  if (!uuid) return NextResponse.json({ error: 'uuid fehlt' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('smp_saved_positions')
    .select('*')
    .or(`is_public.eq.true,uuid.eq.${uuid}`)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ positions: data || [] })
}

// PATCH: Bearbeitet einen eigenen Punkt (Name, Sichtbarkeit, Koordinaten)
export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { id, uuid, name, x, y, z, is_public } = body

  if (!id || !uuid) return NextResponse.json({ error: 'id und uuid erforderlich' }, { status: 400 })

  // Nur eigene Punkte dürfen bearbeitet werden
  const { data: existing } = await supabaseAdmin
    .from('smp_saved_positions')
    .select('uuid')
    .eq('id', id)
    .single()

  if (!existing || existing.uuid !== uuid) {
    return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 })
  }

  const updates: Record<string, any> = {}
  if (name !== undefined) updates.name = name
  if (x !== undefined) updates.x = x
  if (y !== undefined) updates.y = y
  if (z !== undefined) updates.z = z
  if (is_public !== undefined) updates.is_public = is_public

  const { error } = await supabaseAdmin
    .from('smp_saved_positions')
    .update(updates)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// DELETE: Löscht einen eigenen Punkt
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  const uuid = req.nextUrl.searchParams.get('uuid')

  if (!id || !uuid) return NextResponse.json({ error: 'id und uuid erforderlich' }, { status: 400 })

  const { data: existing } = await supabaseAdmin
    .from('smp_saved_positions')
    .select('uuid')
    .eq('id', id)
    .single()

  if (!existing || existing.uuid !== uuid) {
    return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 })
  }

  const { error } = await supabaseAdmin
    .from('smp_saved_positions')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}