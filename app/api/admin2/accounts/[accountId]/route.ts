import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import bcrypt from 'bcryptjs'
import { mitRecht, nutzerAusZeile, uuidSql, type Nutzer } from '@/app/lib/rechte'
import { ALLE_RECHTE } from '@/app/lib/rechte-def'

// Website-Konten verwalten (sperren, deaktivieren, Passwort, löschen): Recht „konten.verwalten“.
// Der Rang wird nicht hier, sondern unter /admin2/raenge vergeben. Konten mit allen Rechten (Orga) kann nur die Orga ändern.

// Lesezugriff: administrator, owner UND teammitglied.
async function checkRead(req: NextRequest) {
  return mitRecht(req, 'admin.zugang')
}

// Schreibzugriff: NUR administrator und owner. Seek Accounts gehört nicht zu
// den für Teammitglieder freigegebenen Bereichen (Updates/Ideen/Konzepte/
// Team-Chat) - sie dürfen hier alles sehen, aber nichts verändern.
async function checkWrite(req: NextRequest) {
  return mitRecht(req, 'konten.verwalten')
}

const existiert = async (id: string) => (await pool.query('SELECT 1 FROM users WHERE id = $1', [id])).rows.length > 0

/** Konten mit allen Rechten („*“) darf nur ändern, wer selbst alle Rechte hat */
async function geschuetzt(id: string, admin: Nutzer): Promise<boolean> {
  if (admin.rechte.includes(ALLE_RECHTE)) return false
  const row = (await pool.query(
    `SELECT u.id, u.username, u.minecraft_uuid, u.minecraft_username, u.clan_role, u.rang_id, pr.rank_id FROM users u
       LEFT JOIN mc_player_ranks pr ON u.minecraft_uuid IS NOT NULL AND ${uuidSql('pr.uuid')} = ${uuidSql('u.minecraft_uuid')}
      WHERE u.id = $1`, [id])).rows[0]
  return !!row && (await nutzerAusZeile(row)).rechte.includes(ALLE_RECHTE)
}

// GET /api/admin2/accounts/[accountId]
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ accountId: string }> }
) {
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { accountId } = await context.params

  try {
    const accountResult = await pool.query(
      `SELECT u.id, u.username, u.display_name, u.anzeigename, u.minecraft_username, u.minecraft_uuid, u.clan_role, u.rang_id, pr.rank_id,
              u.is_banned, u.banned_reason, u.is_deactivated, u.last_login_at, u.created_at
       FROM users u
       LEFT JOIN mc_player_ranks pr ON u.minecraft_uuid IS NOT NULL AND ${uuidSql('pr.uuid')} = ${uuidSql('u.minecraft_uuid')}
       WHERE u.id = $1`,
      [accountId]
    )
    const row = accountResult.rows[0]
    if (!row) return NextResponse.json({ error: 'Account nicht gefunden' }, { status: 404 })
    // Rang und Rechte genau so, wie die Website sie prüft
    const n = await nutzerAusZeile(row)
    const { clan_role: _alt, rang_id: _r, rank_id: _p, ...rest } = row
    const account = { ...rest, name: n.name, rang: n.rang, rechte: n.rechte }

    const loginsResult = await pool.query(
      `SELECT logged_in_at, ip_address FROM login_history WHERE user_id = $1 ORDER BY logged_in_at DESC LIMIT 4`,
      [accountId]
    )
    const logins = loginsResult.rows

    return NextResponse.json({ account, logins })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PATCH /api/admin2/accounts/[accountId]
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ accountId: string }> }
) {
  const admin = await checkWrite(req)
  if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { accountId } = await context.params
  const body = await req.json().catch(() => ({}))
  const { is_banned, banned_reason, new_password, is_deactivated } = body as {
    is_banned?: boolean, banned_reason?: string, new_password?: string, is_deactivated?: boolean
  }

  if (!(await existiert(accountId))) return NextResponse.json({ error: 'Account nicht gefunden' }, { status: 404 })
  if (await geschuetzt(accountId, admin)) {
    return NextResponse.json({ error: 'Dieses Konto hat alle Rechte – nur die Orga kann es ändern' }, { status: 403 })
  }

  try {

    if (is_banned !== undefined) {
      await pool.query(
        `UPDATE users SET is_banned = $1, banned_reason = $2, banned_at = CASE WHEN $1 THEN now() ELSE NULL END WHERE id = $3`,
        [is_banned, is_banned ? (banned_reason?.trim() || null) : null, accountId]
      )
    }

    if (is_deactivated !== undefined) {
      await pool.query('UPDATE users SET is_deactivated = $1 WHERE id = $2', [is_deactivated, accountId])
      await pool.query('DELETE FROM sessions WHERE user_id = $1', [accountId])
    }

    if (new_password !== undefined) {
      if (new_password.length < 8) {
        return NextResponse.json({ error: 'Passwort muss mindestens 8 Zeichen lang sein' }, { status: 400 })
      }
      const hash = await bcrypt.hash(new_password, 12)
      await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, accountId])
      await pool.query('DELETE FROM sessions WHERE user_id = $1', [accountId])
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE /api/admin2/accounts/[accountId]
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ accountId: string }> }
) {
  const admin = await checkWrite(req)
  if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { accountId } = await context.params

  if (!(await existiert(accountId))) return NextResponse.json({ error: 'Account nicht gefunden' }, { status: 404 })
  if (await geschuetzt(accountId, admin)) {
    return NextResponse.json({ error: 'Dieses Konto hat alle Rechte – nur die Orga kann es löschen' }, { status: 403 })
  }
  if (accountId === admin.id) {
    return NextResponse.json({ error: 'Du kannst deinen eigenen Account hier nicht löschen' }, { status: 403 })
  }

  try {
    await pool.query('DELETE FROM users WHERE id = $1', [accountId])
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}