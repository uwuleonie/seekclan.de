import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

const STEAM_API_KEY = process.env.STEAM_API_KEY
const BASE_URL = 'https://seekclande.vercel.app'

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams

    const token = req.cookies.get('session_token')?.value
    if (!token) return NextResponse.redirect(`${BASE_URL}/login`)

    const { data: session } = await supabaseAdmin
      .from('sessions')
      .select('user_id, expires_at')
      .eq('token', token)
      .single()

    if (!session || new Date(session.expires_at) < new Date()) {
      return NextResponse.redirect(`${BASE_URL}/login`)
    }

    // OpenID Validierung
    const params = new URLSearchParams()
    searchParams.forEach((value, key) => {
      params.set(key, value)
    })
    params.set('openid.mode', 'check_authentication')

    const verifyRes = await fetch('https://steamcommunity.com/openid/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })

    const verifyText = await verifyRes.text()
    if (!verifyText.includes('is_valid:true')) {
      return NextResponse.redirect(`${BASE_URL}/profil-bearbeiten?error=steam_invalid`)
    }

    // Steam ID extrahieren
    const claimedId = searchParams.get('openid.claimed_id') || ''
    const steamIdMatch = claimedId.match(/\/(\d+)$/)
    if (!steamIdMatch) {
      return NextResponse.redirect(`${BASE_URL}/profil-bearbeiten?error=steam_invalid`)
    }
    const steamId = steamIdMatch[1]

    // Steam Profil holen
    const profileRes = await fetch(
      `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${STEAM_API_KEY}&steamids=${steamId}`
    )
    const profileData = await profileRes.json()
    const player = profileData?.response?.players?.[0]

    if (!player) {
      return NextResponse.redirect(`${BASE_URL}/profil-bearbeiten?error=steam_profile`)
    }

    await supabaseAdmin.from('users').update({
      steam_id: steamId,
      steam_username: player.personaname,
      steam_avatar: player.avatarfull,
    }).eq('id', session.user_id)

    return NextResponse.redirect(`${BASE_URL}/profil-bearbeiten?success=steam_connected`)
  } catch (err) {
    console.error('Steam callback error:', err)
    return NextResponse.redirect(`${BASE_URL}/profil-bearbeiten?error=steam_error`)
  }
}