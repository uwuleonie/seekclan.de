import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get('code')

    if (!code) {
      return NextResponse.redirect(new URL('/einstellungen?error=discord_cancelled', req.url))
    }

    const redirectUri = process.env.NODE_ENV === 'production'
      ? 'https://seekclan.de/api/discord/callback'
      : 'http://localhost:3000/api/discord/callback'

    // Code gegen Token tauschen
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

    // Discord User abrufen
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })

    const discordUser = await userRes.json()

    if (!discordUser.id) {
      return NextResponse.redirect(new URL('/einstellungen?error=discord_user', req.url))
    }

    // Session prüfen
    const token = req.cookies.get('session_token')?.value

    if (!token) {
      return NextResponse.redirect(new URL('/login', req.url))
    }

    const { data: session } = await supabaseAdmin
      .from('sessions')
      .select('user_id, expires_at')
      .eq('token', token)
      .single()

    if (!session || new Date(session.expires_at) < new Date()) {
      return NextResponse.redirect(new URL('/login', req.url))
    }

    // Discord mit Account verknüpfen
    await supabaseAdmin
      .from('users')
      .update({
        discord_id: discordUser.id,
        discord_username: discordUser.username,
      })
      .eq('id', session.user_id)

    return NextResponse.redirect(new URL('/einstellungen?success=discord_linked', req.url))
  } catch (err) {
    console.error(err)
    return NextResponse.redirect(new URL('/einstellungen?error=discord_error', req.url))
  }
}