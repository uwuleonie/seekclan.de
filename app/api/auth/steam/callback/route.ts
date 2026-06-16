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

    const claimedId = searchParams.get('openid.claimed_id') || ''
    const steamIdMatch = claimedId.match(/\/(\d+)$/)
    if (!steamIdMatch) {
      return NextResponse.redirect(`${BASE_URL}/profil-bearbeiten?error=steam_invalid`)
    }
    const steamId = steamIdMatch[1]

    // Nur Steam ID speichern — Profil wird clientseitig geladen
    await supabaseAdmin.from('users').update({
      steam_id: steamId,
      steam_username: null,
      steam_avatar: null,
    }).eq('id', session.user_id)

    return NextResponse.redirect(`${BASE_URL}/profil-bearbeiten?success=steam_connected&fetch_profile=1`)
  } catch (err) {
    console.error('Steam callback error:', err)
    return NextResponse.redirect(`${BASE_URL}/profil-bearbeiten?error=steam_error`)
  }
}