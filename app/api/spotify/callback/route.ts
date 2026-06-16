import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  if (!code) return NextResponse.redirect('https://seekclande.vercel.app/?error=spotify')

  const clientId = process.env.SPOTIFY_CLIENT_ID!
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET!
  const redirectUri = 'https://seekclande.vercel.app/api/spotify/callback'

  // Token holen
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

  // User aus Cookie holen
  const sessionToken = req.cookies.get('session_token')?.value
  if (!sessionToken) return NextResponse.redirect('https://seekclande.vercel.app/login')

  const { data: session } = await supabaseAdmin
    .from('sessions').select('user_id').eq('token', sessionToken).single()
  if (!session) return NextResponse.redirect('/login')

  // Tokens in Datenbank speichern
  await supabaseAdmin.from('users').update({
    spotify_access_token: tokens.access_token,
    spotify_refresh_token: tokens.refresh_token,
    spotify_token_expires: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
  }).eq('id', session.user_id)

  return NextResponse.redirect('https://seekclande.vercel.app/einstellungen?tab=verknuepfungen&spotify=success')
}