import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { verifyPluginKey } from '@/app/lib/plugin-auth'

// Liefert alle Trust-Einträge für den Cache-Sync im Plugin (PermissionManager.loadAllAsync).
export async function GET(req: NextRequest) {
  if (!await verifyPluginKey(req)) {
    return NextResponse.json({ error: 'Ungültiger API Key' }, { status: 401 })
  }

  let trusts
  try {
    const result = await pool.query('SELECT * FROM claim_trusts')
    trusts = result.rows
  } catch (err: any) {
    return NextResponse.json({ error: `Trusts konnten nicht geladen werden: ${err.message}` }, { status: 500 })
  }

  return NextResponse.json({ trusts: trusts || [] })
}