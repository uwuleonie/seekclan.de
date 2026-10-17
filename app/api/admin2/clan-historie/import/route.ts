import { NextRequest, NextResponse } from 'next/server'
import { mitRecht } from '@/app/lib/rechte'
import { importAusfuehren, importPlan } from '@/app/lib/clan-historie-import'

// /api/admin2/clan-historie/import – alter Clan-Verlauf + Abgleich mit der Clan-Liste aus dem Spiel (app/lib/clan-historie-import.ts)
//   GET                       Vorschau: was passieren würde
//   POST {ueberschreiben}     ausführen (ueberschreiben = auch abweichende, von Hand eingetragene Beitrittsdaten ersetzen)
// Rechte: Clan verwalten + Ränge vergeben

export async function GET(req: NextRequest) {
  if (!(await mitRecht(req, 'admin.zugang'))) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  try {
    return NextResponse.json(await importPlan())
  } catch (e) {
    console.error('clan-historie/import', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Fehler' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const user = await mitRecht(req, 'clan.verwalten')
  if (!user || !user.rechte.some(r => r === '*' || r === 'raenge.vergeben')) {
    return NextResponse.json({ error: 'Dafür brauchst du „Clan verwalten“ und „Ränge vergeben“' }, { status: 403 })
  }
  const b = await req.json().catch(() => ({}))
  try {
    return NextResponse.json({ success: true, ...(await importAusfuehren(user.username, !!b.ueberschreiben)) })
  } catch (e) {
    console.error('clan-historie/import', e)
    const text = e instanceof Error ? e.message : 'Fehler'
    return NextResponse.json({ error: /clan_historie/.test(text) ? 'Die Tabelle clan_historie fehlt – bitte zuerst die Datenbank-Befehle ausführen' : text }, { status: 500 })
  }
}
