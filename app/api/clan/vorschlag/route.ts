import { NextRequest, NextResponse } from 'next/server'
import { freieAkte } from '@/app/lib/link-anfragen'
import { nutzerAusAnfrage } from '@/app/lib/rechte'
import { checkRateLimit, getIP, rateLimitResponse } from '@/app/lib/rate-limit'

// /api/clan/vorschlag?name=… – Login/Registrieren: Steht der Name in der Clan-Liste und ist noch mit keinem Konto verbunden?
// → {clan: true, name} (Name wie in der Clan-Akte). Wer schon mit Minecraft verbunden ist, bekommt immer {clan: false}.

export async function GET(req: NextRequest) {
  const limit = await checkRateLimit(getIP(req), 'api')
  if (!limit.allowed) return rateLimitResponse(limit)
  const name = (req.nextUrl.searchParams.get('name') ?? '').trim()
  try {
    const n = await nutzerAusAnfrage(req)
    if (n?.minecraft_uuid) return NextResponse.json({ clan: false })
    const akte = await freieAkte(name)
    return NextResponse.json(akte ? { clan: true, name: akte.name } : { clan: false })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ clan: false })
  }
}
