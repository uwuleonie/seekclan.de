import { NextRequest } from 'next/server'
import { pool } from '@/app/lib/db'

// Server-Helfer für seekclan.de/geo (Login prüfen, Rollen)

export interface GeoUser { id: string; username: string; clan_role: string | null }

export async function getGeoUser(req: NextRequest): Promise<GeoUser | null> {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const s = await pool.query('SELECT user_id, expires_at FROM sessions WHERE token = $1', [token])
  const session = s.rows[0]
  if (!session || (session.expires_at && new Date(session.expires_at) < new Date())) return null
  const u = await pool.query('SELECT id, username, clan_role FROM users WHERE id = $1', [session.user_id])
  return u.rows[0] ?? null
}

/** Admins sehen in /geo alle Quizzes (außer im Vorschau-Modus) und dürfen freischalten */
export const isGeoAdmin = (u: GeoUser | null) => !!u && (u.clan_role === 'administrator' || u.clan_role === 'owner')

/** Lesen im Admin-Panel: zusätzlich Teammitglieder */
export const canReadGeoAdmin = (u: GeoUser | null) => isGeoAdmin(u) || u?.clan_role === 'teammitglied'
