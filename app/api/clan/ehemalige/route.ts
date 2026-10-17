import { NextResponse } from 'next/server'
import { verlaeufe } from '@/app/lib/clan-historie'
import { clanUndTeam } from '@/app/lib/clan'
import { tageImClan } from '@/app/lib/clan-historie-def'
import { CLANLISTE_STAND, inClanListe } from '@/app/lib/clan-liste'

// GET /api/clan/ehemalige – öffentlich: alle, die mal im Clan waren und jetzt nicht mehr (/clan/ex-clan).
// Quelle: Clan-Historie (Mitgliedschaften) + Clan-Akten von Leuten, die keinen Clan-Rang mehr haben.
// Wer in der Clan-Liste aus dem Spiel steht und seitdem laut Historie nicht gegangen ist, zählt als Mitglied –
// auch wenn sein Rang auf der Website noch nicht stimmt (z. B. vor der Umstellung).

export async function GET() {
  try {
    const [vs, leute] = await Promise.all([verlaeufe(), clanUndTeam()])
    const drin = new Set(leute.filter(p => p.rang.clan).flatMap(p => [p.mcName, p.name]).filter(Boolean).map(n => n.toLowerCase()))
    const out = []
    for (const [k, v] of vs) {
      if (drin.has(k) || !v.verlauf.zeitraeume.length) continue
      const letzte = v.verlauf.zeitraeume[v.verlauf.zeitraeume.length - 1]
      if (inClanListe(k) && (!letzte.bis || +new Date(letzte.bis) < +new Date(CLANLISTE_STAND))) continue
      const erster = v.verlauf.zeitraeume.find(z => z.von)?.von ?? null
      out.push({
        name: v.name, zeitraeume: v.verlauf.zeitraeume, erster, ende: letzte.bis, wie: letzte.wie, durch: letzte.durch,
        mal: v.verlauf.zeitraeume.length, tage: tageImClan(v.verlauf), hoechsterRang: v.verlauf.hoechsterRang,
        // Laut Verlauf noch drin, aber nicht mehr im Clan (z. B. ausgetreten, ohne dass es im Verlauf steht)
        ohneAustritt: !letzte.bis,
      })
    }
    // Clan-Akten ehemaliger Mitglieder, die im Verlauf nicht vorkommen
    for (const p of leute) {
      if (p.rang.clan || !p.akteId || vs.has(p.mcName.toLowerCase()) || vs.has(p.name.toLowerCase()) || inClanListe(p.mcName)) continue
      out.push({
        name: p.mcName, zeitraeume: [{ von: p.beitritt, vonGenau: false, bis: null, bisGenau: false, wie: null, durch: null }], erster: p.beitritt,
        ende: null, wie: null, durch: null, mal: 1, tage: 0, hoechsterRang: null, ohneAustritt: true,
      })
    }
    out.sort((a, b) => +new Date(b.ende ?? 0) - +new Date(a.ende ?? 0) || a.name.localeCompare(b.name))
    return NextResponse.json({ ehemalige: out }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('clan/ehemalige', err)
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 })
  }
}
