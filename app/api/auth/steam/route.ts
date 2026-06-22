import { NextRequest, NextResponse } from 'next/server'

const BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://seekclan.de'
  : 'http://localhost:3000'

export async function GET(req: NextRequest) {
  const returnTo = `${BASE_URL}/api/auth/steam/callback`

  const params = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': returnTo,
    'openid.realm': BASE_URL,
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
  })

  return NextResponse.redirect(`https://steamcommunity.com/openid/login?${params.toString()}`)
}