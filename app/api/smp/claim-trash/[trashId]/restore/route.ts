import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

async function getMinecraftUuid(token: string | undefined) {
  if (!token) return null
  const sessionResult = await pool.query(
    'SELECT user_id, expires_at FROM sessions WHERE token = $1',
    [token]
  )
  const session = sessionResult.rows[0]
  if (!session || new Date(session.expires_at) < new Date()) return null

  const userResult = await pool.query(
    'SELECT minecraft_uuid FROM users WHERE id = $1',
    [session.user_id]
  )
  return userResult.rows[0]?.minecraft_uuid as string | null
}

// Baut ein mehrzeiliges INSERT mit dynamischen Spalten aus einer Liste von Objekten,
// die alle dieselben Schlüssel haben (kommt hier immer aus unseren eigenen jsonb-
// Snapshots, nicht direkt vom Nutzer-Input). Gibt die eingefügten Zeilen zurück.
async function bulkInsert(table: string, rows: Record<string, any>[]): Promise<any[]> {
  if (rows.length === 0) return []
  const columns = Object.keys(rows[0])
  const values: any[] = []
  const valueRows = rows.map((row, rowIndex) => {
    const placeholders = columns.map((col, colIndex) => {
      values.push(row[col])
      return `$${rowIndex * columns.length + colIndex + 1}`
    })
    return `(${placeholders.join(', ')})`
  })

  const result = await pool.query(
    `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${valueRows.join(', ')} RETURNING *`,
    values
  )
  return result.rows
}

// Stellt einen Papierkorb-Eintrag wieder her: legt die Gruppe, Claims, Permissions
// und Trusts wieder genauso an, wie sie vor dem Löschen waren.
export async function POST(req: NextRequest, { params }: { params: Promise<{ trashId: string }> }) {
  const { trashId } = await params
  const ownerUuid = await getMinecraftUuid(req.cookies.get('session_token')?.value)
  if (!ownerUuid) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const entryResult = await pool.query(
    'SELECT * FROM claim_trash WHERE id = $1',
    [trashId]
  )
  const entry = entryResult.rows[0]
  if (!entry || entry.owner_uuid !== ownerUuid) {
    return NextResponse.json({ error: 'Eintrag nicht gefunden oder gehört dir nicht' }, { status: 404 })
  }
  if (new Date(entry.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Dieser Eintrag ist bereits abgelaufen' }, { status: 410 })
  }

  const claimsSnapshot: any[] = entry.claims_snapshot || []
  const permissionsSnapshot: any[] = entry.permissions_snapshot || []
  const trustsSnapshot: any[] = entry.trusts_snapshot || []
  if (claimsSnapshot.length === 0) {
    return NextResponse.json({ error: 'Nichts zum Wiederherstellen' }, { status: 400 })
  }

  const oldGroupId = claimsSnapshot[0].group_id

  let newGroup
  try {
    const result = await pool.query(
      `INSERT INTO claim_groups (owner_uuid, owner_name, name, is_auto) VALUES ($1, $2, $3, false) RETURNING *`,
      [ownerUuid, claimsSnapshot[0].owner_name, entry.group_name]
    )
    newGroup = result.rows[0]
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  const claimsToInsert = claimsSnapshot.map(c => {
    const { id, ...rest } = c
    return { ...rest, group_id: newGroup.id }
  })
  let restoredClaims
  try {
    restoredClaims = await bulkInsert('claims', claimsToInsert)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  const idMap = new Map<number, number>()
  claimsSnapshot.forEach((old, i) => idMap.set(old.id, restoredClaims[i].id))

  if (permissionsSnapshot.length > 0) {
    const permsToInsert = permissionsSnapshot.map(p => {
      const { id, ...rest } = p
      return {
        ...rest,
        claim_id: rest.claim_id ? (idMap.get(rest.claim_id) ?? null) : null,
        group_id: rest.group_id === oldGroupId ? newGroup.id : rest.group_id,
      }
    })
    try {
      await bulkInsert('claim_permissions', permsToInsert)
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 })
    }
  }

  if (trustsSnapshot.length > 0) {
    const trustsToInsert = trustsSnapshot.map(t => {
      const { id, ...rest } = t
      return { ...rest, claim_id: rest.claim_id ? (idMap.get(rest.claim_id) ?? null) : null }
    })
    try {
      await bulkInsert('claim_trusts', trustsToInsert)
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 })
    }
  }

  await pool.query('DELETE FROM claim_trash WHERE id = $1', [trashId])

  return NextResponse.json({ success: true, group: newGroup })
}