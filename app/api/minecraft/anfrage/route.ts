import { NextRequest, NextResponse } from 'next/server'
import { nutzerAusAnfrage } from '@/app/lib/rechte'
import { checkOrigin, csrfError } from '@/app/lib/csrf'
import { checkRateLimit, getIP, rateLimitResponse } from '@/app/lib/rate-limit'
import { anfrageStellen, anfrageVon, anfrageZurueckziehen } from '@/app/lib/link-anfragen'
import { VerknuepfungsFehler } from '@/app/lib/minecraft-konto'

// /api/minecraft/anfrage – Clan-Freischaltung durchs Team (statt /link im Spiel)
//   GET               eigene neueste Anfrage → {anfrage | null}
//   POST {name, nachricht}  Anfrage stellen (name = Name in der Clan-Liste)
//   DELETE            offene Anfrage zurückziehen

export async function GET(req: NextRequest) {
  const n = await nutzerAusAnfrage(req)
  if (!n) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  try {
    return NextResponse.json({ anfrage: await anfrageVon(n.id) })
  } catch (err) {
    // Tabelle minecraft_link_anfragen fehlt noch → Seite funktioniert trotzdem
    console.error(err)
    return NextResponse.json({ anfrage: null })
  }
}

export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) return csrfError()
  const limit = await checkRateLimit(getIP(req), 'settings')
  if (!limit.allowed) return rateLimitResponse(limit)
  const n = await nutzerAusAnfrage(req)
  if (!n) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  if (n.minecraft_uuid) return NextResponse.json({ error: 'Dein Konto ist schon mit Minecraft verbunden' }, { status: 400 })
  const b = await req.json().catch(() => ({}))
  try {
    const anfrage = await anfrageStellen(n.id, String(b.name ?? ''), String(b.nachricht ?? ''))
    return NextResponse.json({ success: true, anfrage })
  } catch (err) {
    if (err instanceof VerknuepfungsFehler) return NextResponse.json({ error: err.message }, { status: 400 })
    console.error(err)
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  if (!checkOrigin(req)) return csrfError()
  const n = await nutzerAusAnfrage(req)
  if (!n) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  await anfrageZurueckziehen(n.id)
  return NextResponse.json({ success: true })
}
