import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    // API Key prüfen
    const apiKey = req.headers.get('x-plugin-key')
    
    const { data: config } = await supabaseAdmin
      .from('plugin_config')
      .select('value')
      .eq('key', 'api_key')
      .single()

    if (!config || apiKey !== config.value) {
      return NextResponse.json({ error: 'Ungültiger API Key' }, { status: 401 })
    }

    const { minecraft_username, minecraft_uuid } = await req.json()

    if (!minecraft_username || !minecraft_uuid) {
      return NextResponse.json({ error: 'Username und UUID erforderlich' }, { status: 400 })
    }

    // Alte Codes für diesen Spieler löschen
    await supabaseAdmin
      .from('minecraft_link_codes')
      .delete()
      .eq('minecraft_uuid', minecraft_uuid)

    // Neuen 8-stelligen Code generieren
    const code = Math.random().toString(36).substring(2, 6).toUpperCase() + 
                 Math.random().toString(36).substring(2, 6).toUpperCase()

    await supabaseAdmin.from('minecraft_link_codes').insert({
      minecraft_username,
      minecraft_uuid,
      code,
    })

    return NextResponse.json({ success: true, code })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 })
  }
}