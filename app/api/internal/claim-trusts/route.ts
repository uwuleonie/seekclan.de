import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { verifyPluginKey } from '@/app/lib/plugin-auth'

// Erstellt einen Trust-Eintrag (claim-spezifisch oder global, scope/claim_id
// nach dem echten claim_trusts-Schema). Ersetzt den alten
// SupabaseClient.insertReturning("claim_trusts", ...) Aufruf aus TrustCommand.
export async function POST(req: NextRequest) {
  if (!await verifyPluginKey(req)) {
    return NextResponse.json({ error: 'Ungültiger API Key' }, { status: 401 })
  }

  const body = await req.json()
  const { owner_uuid, owner_name, trusted_uuid, trusted_name, scope, claim_id } = body

  if (!owner_uuid || !owner_name || !trusted_uuid || !trusted_name || !scope) {
    return NextResponse.json(
      { error: 'owner_uuid, owner_name, trusted_uuid, trusted_name und scope sind erforderlich' },
      { status: 400 }
    )
  }

  if (scope !== 'global' && scope !== 'claim') {
    return NextResponse.json({ error: 'scope muss "global" oder "claim" sein' }, { status: 400 })
  }

  if (scope === 'claim' && !claim_id) {
    return NextResponse.json({ error: 'claim_id ist erforderlich bei scope "claim"' }, { status: 400 })
  }

  // WICHTIG: Bei claim-spezifischem Trust serverseitig verifizieren, dass owner_uuid
  // WIRKLICH der aktuelle Besitzer des Claims laut DB ist - nicht blind dem vertrauen,
  // was das Plugin schickt (das könnte aus einem veralteten Cache stammen, z.B. nach
  // einer Claim-Übertragung auf der Website, bevor der Plugin-Cache nachgezogen ist).
  if (scope === 'claim') {
    let claim
    try {
      const claimResult = await pool.query('SELECT owner_uuid FROM claims WHERE id = $1', [claim_id])
      claim = claimResult.rows[0]
    } catch (err: any) {
      return NextResponse.json({ error: `Datenbankfehler: ${err.message}` }, { status: 500 })
    }

    if (!claim) {
      return NextResponse.json({ error: 'Claim nicht gefunden' }, { status: 404 })
    }
    if (claim.owner_uuid !== owner_uuid) {
      return NextResponse.json(
        { error: 'Dieser Claim gehört dir nicht (mehr) - eventuell wurde er gerade übertragen. Logge dich neu ein oder lade die Seite neu.' },
        { status: 403 }
      )
    }
  }

  let existing;
  try {
    const existingResult = await pool.query(
      scope === 'global'
        ? `SELECT id FROM claim_trusts WHERE owner_uuid = $1 AND trusted_uuid = $2 AND scope = 'global'`
        : `SELECT id FROM claim_trusts WHERE owner_uuid = $1 AND trusted_uuid = $2 AND scope = 'claim' AND claim_id = $3`,
      scope === 'global' ? [owner_uuid, trusted_uuid] : [owner_uuid, trusted_uuid, claim_id]
    )
    existing = existingResult.rows[0]
  } catch (err: any) {
    return NextResponse.json({ error: `Datenbankfehler bei der Prüfung: ${err.message}` }, { status: 500 })
  }

  if (existing) {
    return NextResponse.json(
      { error: `${trusted_name} wurde bereits hinzugefügt.` },
      { status: 409 }
    )
  }

  let trust
  try {
    const result = await pool.query(
      `INSERT INTO claim_trusts (owner_uuid, owner_name, trusted_uuid, trusted_name, scope, claim_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [owner_uuid, owner_name, trusted_uuid, trusted_name, scope, claim_id || null]
    )
    trust = result.rows[0]
  } catch (err: any) {
    return NextResponse.json({ error: `Trust konnte nicht erstellt werden: ${err.message}` }, { status: 500 })
  }

  return NextResponse.json({ trust })
}

// Entfernt einen Trust-Eintrag. Ersetzt den alten
// SupabaseClient.delete("claim_trusts", filter) Aufruf aus UntrustCommand.
export async function DELETE(req: NextRequest) {
  if (!await verifyPluginKey(req)) {
    return NextResponse.json({ error: 'Ungültiger API Key' }, { status: 401 })
  }

  const body = await req.json()
  const { owner_uuid, trusted_uuid, claim_id } = body

  if (!owner_uuid || !trusted_uuid) {
    return NextResponse.json({ error: 'owner_uuid und trusted_uuid sind erforderlich' }, { status: 400 })
  }

  try {
    if (claim_id) {
      await pool.query(
        `DELETE FROM claim_trusts WHERE owner_uuid = $1 AND trusted_uuid = $2 AND scope = 'claim' AND claim_id = $3`,
        [owner_uuid, trusted_uuid, claim_id]
      )
    } else {
      await pool.query(
        `DELETE FROM claim_trusts WHERE owner_uuid = $1 AND trusted_uuid = $2 AND scope = 'global'`,
        [owner_uuid, trusted_uuid]
      )
    }
  } catch (err: any) {
    return NextResponse.json({ error: `Trust konnte nicht entfernt werden: ${err.message}` }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}