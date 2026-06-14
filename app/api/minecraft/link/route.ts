import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('session_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
    }

    // Session prüfen
    const { data: session } = await supabaseAdmin
      .from('sessions')
      .select('user_id, expires_at')
      .eq('token', token)
      .single()

    if (!session || new Date(session.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Session abgelaufen' }, { status: 401 })
    }

    const { code } = await req.json()

    if (!code) {
      return NextResponse.json({ error: 'Code erforderlich' }, { status: 400 })
    }

    // Code in Datenbank suchen
    const { data: linkCode } = await supabaseAdmin
      .from('minecraft_link_codes')
      .select('*')
      .eq('code', code.toUpperCase())
      .single()

    if (!linkCode) {
      return NextResponse.json({ error: 'Ungültiger Code' }, { status: 404 })
    }

    // Abgelaufen?
    if (new Date(linkCode.expires_at) < new Date()) {
      await supabaseAdmin.from('minecraft_link_codes').delete().eq('id', linkCode.id)
      return NextResponse.json({ error: 'Code abgelaufen – bitte neu generieren mit /link' }, { status: 400 })
    }

    // Prüfen ob MC Account schon verknüpft ist
    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('id, username')
      .eq('minecraft_uuid', linkCode.minecraft_uuid)
      .single()

    if (existing && existing.id !== session.user_id) {
      return NextResponse.json({ error: 'Dieser Minecraft Account ist bereits mit einem anderen Account verknüpft' }, { status: 409 })
    }

    // Verknüpfung speichern
    await supabaseAdmin
      .from('users')
      .update({
        minecraft_username: linkCode.minecraft_username,
        minecraft_uuid: linkCode.minecraft_uuid,
      })
      .eq('id', session.user_id)

    // Code löschen
    await supabaseAdmin.from('minecraft_link_codes').delete().eq('id', linkCode.id)

    return NextResponse.json({ 
      success: true, 
      minecraft_username: linkCode.minecraft_username 
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 })
  }
}