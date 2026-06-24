import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

async function refreshToken(userId: string, refreshToken: string) {
  const clientId = process.env.SPOTIFY_CLIENT_ID!
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET!

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  const tokens = await res.json()
  if (!tokens.access_token) return null

  await pool.query(
    'UPDATE users SET spotify_access_token = $1, spotify_token_expires = $2 WHERE id = $3',
    [tokens.access_token, new Date(Date.now() + tokens.expires_in * 1000).toISOString(), userId]
  )

  return tokens.access_token
}

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get('username')
  if (!username) return NextResponse.json({ error: 'Username erforderlich' }, { status: 400 })

  const userResult = await pool.query(
    'SELECT id, spotify_access_token, spotify_refresh_token, spotify_token_expires FROM users WHERE username ILIKE $1',
    [username]
  )
  const user = userResult.rows[0]

  if (!user?.spotify_access_token) return NextResponse.json({ connected: false })

  let accessToken = user.spotify_access_token
  if (new Date(user.spotify_token_expires) <= new Date()) {
    accessToken = await refreshToken(user.id, user.spotify_refresh_token!) || accessToken
  }

  const currentRes = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  })

  if (currentRes.status === 200) {
    const data = await currentRes.json()
    if (data?.item) {
      return NextResponse.json({
        connected: true,
        playing: true,
        track: {
          name: data.item.name,
          artist: data.item.artists.map((a: any) => a.name).join(', '),
          album: data.item.album.name,
          image: data.item.album.images[0]?.url,
          url: data.item.external_urls.spotify,
          progress: data.progress_ms,
          duration: data.item.duration_ms,
        }
      })
    }
  }

  const recentRes = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=1', {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  })

  if (recentRes.ok) {
    const data = await recentRes.json()
    const item = data.items?.[0]?.track
    if (item) {
      return NextResponse.json({
        connected: true,
        playing: false,
        track: {
          name: item.name,
          artist: item.artists.map((a: any) => a.name).join(', '),
          album: item.album.name,
          image: item.album.images[0]?.url,
          url: item.external_urls.spotify,
        }
      })
    }
  }

  return NextResponse.json({ connected: true, playing: false, track: null })
}