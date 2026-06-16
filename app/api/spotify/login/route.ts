import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const clientId = process.env.SPOTIFY_CLIENT_ID!
  const redirectUri = 'https://seekclande.vercel.app/api/spotify/callback'

  const scope = 'user-read-currently-playing user-read-recently-played'

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope,
  })

  return NextResponse.redirect(`https://accounts.spotify.com/authorize?${params}`)
}