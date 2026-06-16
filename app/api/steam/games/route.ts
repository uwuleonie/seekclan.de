import { NextRequest, NextResponse } from 'next/server'

const STEAM_API_KEY = process.env.STEAM_API_KEY

export async function GET(req: NextRequest) {
  const steamId = req.nextUrl.searchParams.get('steamId')
  const appIds = req.nextUrl.searchParams.get('appIds') // kommagetrennt

  if (!steamId || !appIds) {
    return NextResponse.json({ games: [] })
  }

  try {
    // Spielzeit holen
    const res = await fetch(
      `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${STEAM_API_KEY}&steamid=${steamId}&include_appinfo=true&include_played_free_games=true`,
      { next: { revalidate: 300 } }
    )
    const data = await res.json()
    const owned = data?.response?.games || []

    const requestedIds = appIds.split(',').map(Number)
    const games = requestedIds.map((appid: number) => {
      const owned_game = owned.find((g: any) => g.appid === appid)
      return {
        appid,
        name: owned_game?.name || '',
        icon: `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/capsule_sm_120.jpg`,
        playtime_hours: owned_game
          ? Math.round(owned_game.playtime_forever / 60)
          : null, // null = nicht in Bibliothek oder privat
      }
    })

    return NextResponse.json({ games })
  } catch {
    return NextResponse.json({ games: [] })
  }
}