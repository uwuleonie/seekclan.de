import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get('code')

    if (!code) {
      return NextResponse.redirect(new URL('/einstellungen?error=discord_cancelled', req.url))
    }

    const redirectUri = process.env.NODE_ENV === 'production'
      ? 'https://seekclan.de/api/discord/callback'
      : 'http://localhost:3000/api/discord/callback'

    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    })

    const tokenData = await tokenRes.json()

    if (!tokenData.access_token) {
      return NextResponse.redirect(new URL('/einstellungen?error=discord_token', req.url))
    }

    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })

    const discordUser = await userRes.json()

    if (!discordUser.id) {
      return NextResponse.redirect(new URL('/einstellungen?error=discord_user', req.url))
    }

    const token = req.cookies.get('session_token')?.value

    if (!token) {
      return NextResponse.redirect(new URL('/login', req.url))
    }

    const sessionResult = await pool.query(
      'SELECT user_id, expires_at FROM sessions WHERE token = $1',
      [token]
    )
    const session = sessionResult.rows[0]

    if (!session || new Date(session.expires_at) < new Date()) {
      return NextResponse.redirect(new URL('/login', req.url))
    }

    await pool.query(
      'UPDATE users SET discord_id = $1, discord_username = $2 WHERE id = $3',
      [discordUser.id, discordUser.username, session.user_id]
    )

    return NextResponse.redirect(new URL('/einstellungen?success=discord_linked', req.url))
  } catch (err) {
    console.error(err)
    return NextResponse.redirect(new URL('/einstellungen?error=discord_error', req.url))
  }
}