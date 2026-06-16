import { NextRequest, NextResponse } from 'next/server'

const STEAM_OPENID_URL = 'https://steamcommunity.com/openid/login'

export async function GET(req: NextRequest) {
  const baseUrl = 'https://seekclande.vercel.app'
  const returnTo = `${baseUrl}/api/auth/steam/callback`

  const params = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': returnTo,
    'openid.realm': baseUrl,
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
  })

  return NextResponse.redirect(`${STEAM_OPENID_URL}?${params.toString()}`)
}