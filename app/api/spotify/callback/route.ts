import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  if (!code) return NextResponse.redirect('https://seekclande.vercel.app/?error=spotify')

  const clientId = process.env.SPOTIFY_CLIENT_ID!
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET!
  const redirectUri = 'https://seekclande.vercel.app/api/spotify/callback'

  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  })

  const tokens = await tokenRes.json()
  if (!tokens.access_token) return NextResponse.redirect('/?error=spotify')

  const sessionToken = req.cookies.get('session_token')?.value
  if (!sessionToken) return NextResponse.redirect('https://seekclande.vercel.app/login')

  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [sessionToken])
  const session = sessionResult.rows[0]
  if (!session) return NextResponse.redirect('/login')

  await pool.query(
    `UPDATE users SET spotify_access_token = $1, spotify_refresh_token = $2, spotify_token_expires = $3 WHERE id = $4`,
    [tokens.access_token, tokens.refresh_token, new Date(Date.now() + tokens.expires_in * 1000).toISOString(), session.user_id]
  )

  return NextResponse.redirect('https://seekclande.vercel.app/einstellungen?tab=verknuepfungen&spotify=success')
}