import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

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

    const code = Math.random().toString(36).substring(2, 6).toUpperCase() +
                 Math.random().toString(36).substring(2, 6).toUpperCase()

    await pool.query(
      'INSERT INTO minecraft_link_codes (minecraft_username, minecraft_uuid, code) VALUES ($1, $2, $3)',
      [minecraft_username, minecraft_uuid, code]
    )

    return NextResponse.json({ success: true, code })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 })
  }
}