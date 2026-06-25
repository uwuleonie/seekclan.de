import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { verifyPluginKey } from '@/app/lib/plugin-auth'

// Liefert ALLE Claims mit allen Spalten für den Cache-Sync im Plugin
// (ClaimManager.loadAllAsync). Im Gegensatz zu /api/smp/map (öffentliche,
// abgespeckte Lese-Route für die Karte) ist diese Route nur für das Plugin
// gedacht und braucht den vollen Datensatz, den parseClaim() im Plugin erwartet.
export async function GET(req: NextRequest) {
  if (!await verifyPluginKey(req)) {
    return NextResponse.json({ error: 'Ungültiger API Key' }, { status: 401 })
  }

  let claims
  try {
    const result = await pool.query('SELECT * FROM claims')
    claims = result.rows
  } catch (err: any) {
    return NextResponse.json({ error: `Claims konnten nicht geladen werden: ${err.message}` }, { status: 500 })
  }

  return NextResponse.json({ claims: claims || [] })
}