import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { verifyPluginKey } from '@/app/lib/plugin-auth'

// Dynamisches PATCH-Update für claims-Spalten, die das Plugin direkt setzen
// darf. Hart codierte Whitelist statt direkt interpolierter Nutzer-Eingaben
// (Sicherheitsmuster, das auch auf der restlichen Website konsequent so
// gehandhabt wird - siehe "Wichtige Architektur-Patterns" in der Projektübergabe).
const ALLOWED_FIELDS = ['group_id', 'keep_loaded', 'fire_spread_protection', 'tnt_explosion_protection', 'name'];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ claimId: string }> }) {
  if (!await verifyPluginKey(req)) {
    return NextResponse.json({ error: 'Ungültiger API Key' }, { status: 401 })
  }

  const { claimId } = await params
  const body = await req.json()

  const fieldsToUpdate = Object.keys(body).filter(key => ALLOWED_FIELDS.includes(key))
  if (fieldsToUpdate.length === 0) {
    return NextResponse.json(
      { error: `Keine gültigen Felder zum Aktualisieren. Erlaubt: ${ALLOWED_FIELDS.join(', ')}` },
      { status: 400 }
    )
  }

  const setClauses = fieldsToUpdate.map((field, i) => `${field} = $${i + 2}`).join(', ')
  const values = fieldsToUpdate.map(field => body[field])

  let claim
  try {
    const result = await pool.query(
      `UPDATE claims SET ${setClauses} WHERE id = $1 RETURNING *`,
      [claimId, ...values]
    )
    claim = result.rows[0]
  } catch (err: any) {
    return NextResponse.json({ error: `Claim konnte nicht aktualisiert werden: ${err.message}` }, { status: 500 })
  }

  if (!claim) {
    return NextResponse.json({ error: 'Claim nicht gefunden' }, { status: 404 })
  }

  return NextResponse.json({ claim })
}