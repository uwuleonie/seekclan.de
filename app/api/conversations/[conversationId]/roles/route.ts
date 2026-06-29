import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { hasGroupPermission } from '@/app/lib/group-permissions'

async function getUser(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  const session = sessionResult.rows[0]
  if (!session) return null
  const userResult = await pool.query('SELECT id, username FROM users WHERE id = $1', [session.user_id])
  return userResult.rows[0] || null
}

async function isMember(conversationId: string, userId: string) {
  const result = await pool.query(
    'SELECT user_id FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
    [conversationId, userId]
  )
  return result.rows.length > 0
}

// Bekannte, gültige Rechte-Keys (siehe Konzept Abschnitt 2.1 + SQL Block 4).
// Unbekannte Keys im body.permissions werden beim Erstellen/Bearbeiten
// ignoriert, damit niemand sich über die API ein beliebiges JSON-Feld
// erschleichen kann, das später zufällig wie ein Recht ausgewertet wird.
const VALID_PERMISSIONS = [
  'invite_members',
  'manage_roles',
  'pin_messages',
  'request_delete',
  'edit_group_info',
  'kick_members',
] as const

function sanitizePermissions(input: unknown): Record<string, boolean> {
  const result: Record<string, boolean> = {}
  if (typeof input !== 'object' || input === null) return result
  for (const key of VALID_PERMISSIONS) {
    if ((input as Record<string, unknown>)[key] === true) {
      result[key] = true
    }
  }
  return result
}

// GET: Listet alle Rollen einer Gruppe inkl. ihrer Mitglieder.
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ conversationId: string }> }
) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { conversationId } = await context.params
  if (!(await isMember(conversationId, user.id))) {
    return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  }

  const rolesResult = await pool.query(
    `SELECT
       cr.id, cr.name, cr.color, cr.permissions, cr.is_owner_role,
       COALESCE(
         json_agg(
           json_build_object('user_id', crm.user_id, 'username', u.username)
         ) FILTER (WHERE crm.user_id IS NOT NULL),
         '[]'
       ) AS members
     FROM conversation_roles cr
     LEFT JOIN conversation_role_members crm ON crm.role_id = cr.id
     LEFT JOIN users u ON u.id = crm.user_id
     WHERE cr.conversation_id = $1
     GROUP BY cr.id, cr.name, cr.color, cr.permissions, cr.is_owner_role
     ORDER BY cr.is_owner_role DESC, cr.created_at ASC`,
    [conversationId]
  )

  return NextResponse.json({ roles: rolesResult.rows })
}

// POST: Erstellt eine neue Rolle. Body: { name, color?, permissions? }
// Nur möglich mit manage_roles-Recht.
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ conversationId: string }> }
) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { conversationId } = await context.params
  if (!(await hasGroupPermission(conversationId, user.id, 'manage_roles'))) {
    return NextResponse.json({ error: 'Du darfst keine Rollen erstellen' }, { status: 403 })
  }

  const { name, color, permissions } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Rollenname erforderlich' }, { status: 400 })

  const result = await pool.query(
    `INSERT INTO conversation_roles (conversation_id, name, color, permissions, is_owner_role)
     VALUES ($1, $2, $3, $4::jsonb, false) RETURNING id, name, color, permissions`,
    [conversationId, name.trim(), color || null, JSON.stringify(sanitizePermissions(permissions))]
  )

  return NextResponse.json({ role: result.rows[0] })
}

// PATCH: Weist einem Mitglied eine Rolle zu. Body: { user_id, role_id }
// Setzt eine vorherige Rolle des Mitglieds in dieser Gruppe automatisch zurück
// (ein Mitglied hat immer höchstens EINE Rolle pro Gruppe, siehe SQL Block 4).
// Die Owner-Rolle selbst kann hierüber NICHT zugewiesen/entzogen werden -
// das verhindert, dass sich jemand versehentlich (oder absichtlich über einen
// Bug) selbst zum Owner macht.
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ conversationId: string }> }
) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { conversationId } = await context.params
  if (!(await hasGroupPermission(conversationId, user.id, 'manage_roles'))) {
    return NextResponse.json({ error: 'Du darfst keine Rollen zuweisen' }, { status: 403 })
  }

  const { user_id: targetUserId, role_id: roleId } = await req.json()
  if (!targetUserId || !roleId) {
    return NextResponse.json({ error: 'user_id und role_id erforderlich' }, { status: 400 })
  }

  const roleResult = await pool.query(
    'SELECT id, is_owner_role FROM conversation_roles WHERE id = $1 AND conversation_id = $2',
    [roleId, conversationId]
  )
  const role = roleResult.rows[0]
  if (!role) return NextResponse.json({ error: 'Rolle nicht gefunden' }, { status: 404 })
  if (role.is_owner_role) {
    return NextResponse.json({ error: 'Die Owner-Rolle kann nicht manuell zugewiesen werden' }, { status: 400 })
  }

  const isTargetMemberResult = await pool.query(
    'SELECT user_id FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
    [conversationId, targetUserId]
  )
  if (isTargetMemberResult.rows.length === 0) {
    return NextResponse.json({ error: 'Dieser Nutzer ist kein Mitglied dieser Gruppe' }, { status: 400 })
  }

  // Alte Rolle des Ziel-Mitglieds in DIESER Gruppe entfernen, bevor die neue
  // zugewiesen wird (kein Versuch, die Owner-Rolle dabei zu entfernen, falls
  // das Ziel zufällig der Owner wäre - das wird hier implizit verhindert,
  // weil wir explizit nur Nicht-Owner-Rollen zuweisen lassen, s.o.).
  await pool.query(
    `DELETE FROM conversation_role_members
     WHERE user_id = $1 AND role_id IN (
       SELECT id FROM conversation_roles WHERE conversation_id = $2 AND is_owner_role = false
     )`,
    [targetUserId, conversationId]
  )

  await pool.query(
    'INSERT INTO conversation_role_members (role_id, user_id) VALUES ($1, $2)',
    [roleId, targetUserId]
  )

  return NextResponse.json({ success: true })
}