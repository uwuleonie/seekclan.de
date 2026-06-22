import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

// Leitet die Minecraft-UUID sicher aus der Server-Session ab, statt sie vom Client
// entgegenzunehmen — verhindert, dass jemand fremde Punkte bearbeiten/löschen kann,
// indem er einfach eine andere uuid im Request mitschickt.
async function getMinecraftUuid(token: string | undefined) {
  if (!token) return null
  const { data: session } = await supabaseAdmin
    .from('sessions')
    .select('user_id, expires_at')
    .eq('token', token)
    .single()
  if (!session || new Date(session.expires_at) < new Date()) return null

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('minecraft_uuid')
    .eq('id', session.user_id)
    .single()
  return user?.minecraft_uuid as string | null
}

// GET: Lädt alle öffentlichen Punkte + die eigenen privaten Punkte des eingeloggten Spielers.
// Die eigene UUID kommt aus der Session, nicht aus der Query — sonst könnte man durch
// Raten/Kennen einer fremden UUID deren private Speicherpunkte (Koordinaten) einsehen.
export async function GET(req: NextRequest) {
  const ownUuid = await getMinecraftUuid(req.cookies.get('session_token')?.value)

  const { data, error } = await supabaseAdmin
    .from('smp_saved_positions')
    .select('*')
    .or(ownUuid ? `is_public.eq.true,uuid.eq.${ownUuid}` : 'is_public.eq.true')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ positions: data || [] })
}

// PATCH: Bearbeitet einen eigenen Punkt (Name, Sichtbarkeit, Koordinaten)
export async function PATCH(req: NextRequest) {
  const uuid = await getMinecraftUuid(req.cookies.get('session_token')?.value)
  if (!uuid) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const body = await req.json()
  const { id, name, x, y, z, is_public } = body

  if (!id) return NextResponse.json({ error: 'id erforderlich' }, { status: 400 })

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
  const uuid = await getMinecraftUuid(req.cookies.get('session_token')?.value)
  if (!uuid) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id erforderlich' }, { status: 400 })

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