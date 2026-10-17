import { NextResponse } from 'next/server'
import { clanUndTeam } from '@/app/lib/clan'

// GET /api/clan/members – öffentlich: alle mit Clan-Rang (Rang-System, app/lib/clan.ts), mit Clan-Akte und Abzeichen.
// Felder display_name/role/join_date bleiben für ältere Seiten (Abzeichen) erhalten.
export async function GET() {
  try {
    const leute = (await clanUndTeam()).filter(p => p.rang.clan)
    // Beitrittsdaten vor 2015 sind Tippfehler (z. B. Jahr 1) – gelten als „unbekannt“
    const gueltig = (d: string | null) => !!d && new Date(d).getFullYear() >= 2015
    return NextResponse.json({
      members: leute.map(p => ({
        id: p.akteId ?? p.key, display_name: p.name, mc_name: p.mcName, username: p.username, role: p.rang.anzeige, rang: p.rang,
        join_date: (gueltig(p.beitritt) ? p.beitritt : null) ?? p.rangSeit ?? new Date().toISOString(), seit_bekannt: gueltig(p.beitritt), discord_tag: p.discord_tag, stufe_override: p.stufe_override, badges: p.badges,
      })),
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('clan/members', err)
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 })
  }
}
