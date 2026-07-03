import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import bcrypt from 'bcryptjs'

const VALID_ROLES = ['gast', 'clanmitglied', 'clanmoderator', 'teammitglied', 'vip', 'administrator', 'owner']
const TEAM_PERMISSION_ROLES = ['administrator', 'owner']

// Lesezugriff: administrator, owner UND teammitglied.
async function checkRead(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  const session = sessionResult.rows[0]
  if (!session) return null
  const userResult = await pool.query('SELECT id, username, clan_role FROM users WHERE id = $1', [session.user_id])
  const user = userResult.rows[0]
  if (!user || !['administrator', 'owner', 'teammitglied'].includes(user.clan_role)) return null
  return user
}

// Schreibzugriff: NUR administrator und owner. Seek Accounts gehört nicht zu
// den für Teammitglieder freigegebenen Bereichen (Updates/Ideen/Konzepte/
// Team-Chat) - sie dürfen hier alles sehen, aber nichts verändern.
async function checkWrite(req: NextRequest) {
  const user = await checkRead(req)
  if (!user || (user.clan_role !== 'administrator' && user.clan_role !== 'owner')) return null
  return user
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
      `SELECT id, username, display_name, clan_role, is_banned, banned_reason,
              is_deactivated, last_login_at, created_at
       FROM users WHERE id = $1`,
      [accountId]
    )
    const account = accountResult.rows[0]
    if (!account) return NextResponse.json({ error: 'Account nicht gefunden' }, { status: 404 })

    const hasTeamPerms = TEAM_PERMISSION_ROLES.includes(account.clan_role)
    account.perm_updates_ideas = hasTeamPerms
    account.perm_accounts = hasTeamPerms
    account.perm_file_upload = hasTeamPerms
    account.perm_chatlogs = hasTeamPerms

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
  const { clan_role, is_banned, banned_reason, new_password, is_deactivated } = body as {
    clan_role?: string, is_banned?: boolean, banned_reason?: string, new_password?: string, is_deactivated?: boolean
  }

  if (clan_role !== undefined && !VALID_ROLES.includes(clan_role)) {
    return NextResponse.json({ error: 'Ungültige Rolle' }, { status: 400 })
  }

  const targetResult = await pool.query('SELECT clan_role FROM users WHERE id = $1', [accountId])
  const target = targetResult.rows[0]
  if (!target) return NextResponse.json({ error: 'Account nicht gefunden' }, { status: 404 })
  if (target.clan_role === 'owner' && (clan_role !== undefined || is_banned === true || is_deactivated === true)) {
    return NextResponse.json({ error: 'Dieser Account kann nicht verändert, gesperrt oder deaktiviert werden' }, { status: 403 })
  }

  try {
    if (clan_role !== undefined) {
      await pool.query(`UPDATE users SET clan_role = $1 WHERE id = $2`, [clan_role, accountId])
    }

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

  const targetResult = await pool.query('SELECT clan_role FROM users WHERE id = $1', [accountId])
  const target = targetResult.rows[0]
  if (!target) return NextResponse.json({ error: 'Account nicht gefunden' }, { status: 404 })
  if (target.clan_role === 'owner') {
    return NextResponse.json({ error: 'Dieser Account kann nicht gelöscht werden' }, { status: 403 })
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