import { NextRequest } from 'next/server'
import { pool } from '@/app/lib/db'

export interface PrivateUser {
  id: string // users.id ist eine UUID
  username: string
  clan_role: string
}

/**
 * Zugang zum privaten Bereich (/private): nur administrator + owner,
 * gleiche Regel wie in app/private/_components/PrivateShell.tsx.
 * Quick-Share-Dateien sind zusätzlich pro Account getrennt (user_id) —
 * jeder sieht nur seine eigenen Dateien.
 */
export async function getPrivateUser(req: NextRequest): Promise<PrivateUser | null> {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null

  const result = await pool.query(
    `SELECT u.id, u.username, u.clan_role
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > NOW()`,
    [token]
  )

  const user = result.rows[0]
  if (!user || !['administrator', 'owner'].includes(user.clan_role)) return null
  return { id: String(user.id), username: user.username, clan_role: user.clan_role }
}