import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

const VALID_PERMISSIONS = [
  'BLOCK_BREAK', 'BLOCK_PLACE', 'BUCKET_USE',
  'CONTAINER_OPEN', 'ITEM_PICKUP', 'ITEM_FRAME',
  'DOOR_USE', 'BUTTON_LEVER_USE', 'REDSTONE_USE', 'CROP_HARVEST', 'ANIMAL_INTERACT',
  'MOB_KILL', 'VEHICLE_USE', 'MOUNT_USE',
] as const

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

// Liefert alle eigenen gespeicherten Permission-Vorlagen.
export async function GET(req: NextRequest) {
  const ownerUuid = await getMinecraftUuid(req.cookies.get('session_token')?.value)
  if (!ownerUuid) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('permission_templates')
    .select('*')
    .eq('owner_uuid', ownerUuid)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ templates: data || [] })
}

// Body: { name: string, permissions: Record<string, boolean | null> }
export async function POST(req: NextRequest) {
  const ownerUuid = await getMinecraftUuid(req.cookies.get('session_token')?.value)
  if (!ownerUuid) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const body = await req.json()
  const { name, permissions } = body

  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Name erforderlich' }, { status: 400 })
  }
  if (!permissions || typeof permissions !== 'object') {
    return NextResponse.json({ error: 'Permissions erforderlich' }, { status: 400 })
  }

  // Nur valide Keys übernehmen, alles andere ignorieren
  const cleanPermissions: Record<string, boolean | null> = {}
  for (const key of VALID_PERMISSIONS) {
    cleanPermissions[key] = permissions[key] ?? null
  }

  const { data, error } = await supabaseAdmin
    .from('permission_templates')
    .insert({ owner_uuid: ownerUuid, name: name.trim(), permissions: cleanPermissions })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, template: data })
}

// Body: { id: number }
export async function DELETE(req: NextRequest) {
  const ownerUuid = await getMinecraftUuid(req.cookies.get('session_token')?.value)
  if (!ownerUuid) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const body = await req.json()
  const { id } = body
  if (!id) return NextResponse.json({ error: 'id erforderlich' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('permission_templates')
    .delete()
    .eq('id', id)
    .eq('owner_uuid', ownerUuid)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}