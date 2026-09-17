import { NextRequest } from 'next/server'
import { pool } from '@/app/lib/db'

export interface LeonieUser {
  id: number
  username: string
  clan_role: string
}

/**
 * Prüft die Session und gibt den User NUR zurück, wenn es uwuleonie ist.
 * In allen anderen Fällen: null.
 */
export async function getLeonieUser(req: NextRequest): Promise<LeonieUser | null> {
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
  if (!user || user.username !== 'uwuleonie') return null
  return user
}