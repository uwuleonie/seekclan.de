import { NextRequest } from 'next/server'
import { pool } from './db'

/**
 * Prüft den x-plugin-key Header gegen den in der DB gespeicherten API-Key
 * (Tabelle plugin_config, key='api_key') - exakt derselbe Mechanismus wie
 * bei /api/minecraft/generate-code, hier zentralisiert für alle neuen
 * /api/internal/* Routen, die ausschließlich vom Minecraft-Plugin
 * (nicht von eingeloggten Website-Nutzern) aufgerufen werden.
 *
 * Gibt true zurück, wenn der Key gültig ist, sonst false.
 */
export async function verifyPluginKey(req: NextRequest): Promise<boolean> {
  const apiKey = req.headers.get('x-plugin-key')
  if (!apiKey) return false

  const configResult = await pool.query(
    `SELECT value FROM plugin_config WHERE key = 'api_key'`
  )
  const config = configResult.rows[0]

  return Boolean(config) && apiKey === config.value
}