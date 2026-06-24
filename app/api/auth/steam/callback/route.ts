import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

const STEAM_API_KEY = process.env.STEAM_API_KEY
const BASE_URL = 'https://seekclande.vercel.app'

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams

    const token = req.cookies.get('session_token')?.value
    if (!token) return NextResponse.redirect(`${BASE_URL}/login`)

    const sessionResult = await pool.query(
      'SELECT user_id, expires_at FROM sessions WHERE token = $1',
      [token]
    )
    const session = sessionResult.rows[0]

    if (!session || new Date(session.expires_at) < new Date()) {
      return NextResponse.redirect(`${BASE_URL}/login`)
    }

    const claimedId = searchParams.get('openid.claimed_id') || ''
    const steamIdMatch = claimedId.match(/\/(\d+)$/)
    if (!steamIdMatch) {
      return NextResponse.redirect(`${BASE_URL}/profil-bearbeiten?error=steam_invalid`)
    }
    const steamId = steamIdMatch[1]

    // Nur Steam ID speichern — Profil wird clientseitig geladen
    await pool.query(
      'UPDATE users SET steam_id = $1, steam_username = NULL, steam_avatar = NULL WHERE id = $2',
      [steamId, session.user_id]
    )

    return NextResponse.redirect(`${BASE_URL}/profil-bearbeiten?success=steam_connected&fetch_profile=1`)
  } catch (err) {
    console.error('Steam callback error:', err)
    return NextResponse.redirect(`${BASE_URL}/profil-bearbeiten?error=steam_error`)
  }
}