import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const clientId = process.env.DISCORD_CLIENT_ID
  const redirectUri = encodeURIComponent(
    process.env.NODE_ENV === 'production'
      ? 'https://seekclan.de/api/discord/callback'
      : 'http://localhost:3000/api/discord/callback'
  )

  const url = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify`

  return NextResponse.redirect(url)
}