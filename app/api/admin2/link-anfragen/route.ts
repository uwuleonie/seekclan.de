import { NextRequest, NextResponse } from 'next/server'
import { mitRecht } from '@/app/lib/rechte'
import { anfrageAblehnen, anfrageAnnehmen, anfragenListe } from '@/app/lib/link-anfragen'
import { VerknuepfungsFehler } from '@/app/lib/minecraft-konto'

// /api/admin2/link-anfragen – Clan-Freischaltungen (Konto ↔ Clan-Akte) bearbeiten
//   GET                                 {offen, zuletzt}   (Recht: Admin-Panel ansehen)
//   PATCH {id, aktion: 'annehmen'}      Konto mit dem Minecraft-Account der Clan-Akte verbinden   (Recht: Clan verwalten)
//   PATCH {id, aktion: 'ablehnen', grund}

export async function GET(req: NextRequest) {
  const user = await mitRecht(req, 'admin.zugang')
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  try {
    return NextResponse.json(await anfragenListe())
  } catch (err) {
    console.error(err)
    return NextResponse.json({ offen: [], zuletzt: [], fehlt: true })
  }
}

export async function PATCH(req: NextRequest) {
  const user = await mitRecht(req, 'clan.verwalten')
  if (!user) return NextResponse.json({ error: 'Kein Zugriff – dafür brauchst du das Recht „Clan verwalten“' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const id = Number(b.id)
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Anfrage fehlt' }, { status: 400 })
  try {
    if (b.aktion === 'annehmen') {
      const a = await anfrageAnnehmen(id, user.username)
      return NextResponse.json({ success: true, anfrage: a })
    }
    if (b.aktion === 'ablehnen') {
      await anfrageAblehnen(id, user.username, String(b.grund ?? ''))
      return NextResponse.json({ success: true })
    }
    return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 })
  } catch (err) {
    if (err instanceof VerknuepfungsFehler) return NextResponse.json({ error: err.message }, { status: 409 })
    console.error(err)
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 })
  }
}
