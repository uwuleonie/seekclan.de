import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { neuerLinkCode, seitenAdresse } from '@/app/lib/link-code'

// /api/minecraft/generate-code – vom Plugin (SeekLink auf dem Velocity-Proxy) bei /link aufgerufen.
//   POST {minecraft_username, minecraft_uuid}  Header x-plugin-key
//   → {success, code, url}  url = Klick-Link für den Chat (seekclan.de/link/<code>)

export async function POST(req: NextRequest) {
  try {
    const apiKey = req.headers.get('x-plugin-key')

    const configResult = await pool.query(
      `SELECT value FROM plugin_config WHERE key = 'api_key'`
    )
    const config = configResult.rows[0]

    if (!config || apiKey !== config.value) {
      return NextResponse.json({ error: 'Ungültiger API Key' }, { status: 401 })
    }

    const { minecraft_username, minecraft_uuid } = await req.json()

    if (!minecraft_username || !minecraft_uuid) {
      return NextResponse.json({ error: 'Username und UUID erforderlich' }, { status: 400 })
    }

    await pool.query('DELETE FROM minecraft_link_codes WHERE minecraft_uuid = $1', [minecraft_uuid])

    // Neuer Code; falls er zufällig schon vergeben ist, nochmal würfeln
    let code = neuerLinkCode()
    for (let i = 0; i < 5; i++) {
      const belegt = (await pool.query('SELECT 1 FROM minecraft_link_codes WHERE code = $1', [code])).rowCount
      if (!belegt) break
      code = neuerLinkCode()
    }

    await pool.query(
      'INSERT INTO minecraft_link_codes (minecraft_username, minecraft_uuid, code) VALUES ($1, $2, $3)',
      [minecraft_username, minecraft_uuid, code]
    )

    return NextResponse.json({ success: true, code, url: `${seitenAdresse()}/link/${code}` })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 })
  }
}
