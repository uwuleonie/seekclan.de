import { NextRequest } from 'next/server'
import { nutzerAusAnfrage, darf } from '@/app/lib/rechte'

// Server-Helfer für seekclan.de/geo (Login prüfen, Rechte) – Rechte kommen aus dem Rang-System (app/lib/rechte.ts)

export interface GeoUser {
  id: string
  username: string
  /** Anzeigename (Spitzname > Minecraft-Name > Username) – nur zur Anzeige */
  name: string
  /** Rang-Schlüssel (orga, admin, vip, clan-mod, clan, server-team, spieler) – für Quiz-Freigaben je Rang */
  role: string | null
  rechte: string[]
}

export async function getGeoUser(req: NextRequest): Promise<GeoUser | null> {
  const n = await nutzerAusAnfrage(req)
  return n ? { id: n.id, username: n.username, name: n.name, role: n.rang.schluessel, rechte: n.rechte } : null
}

/** Admins sehen in /geo alle Quizzes (außer im Vorschau-Modus) und dürfen freischalten */
export const isGeoAdmin = (u: GeoUser | null) => darf(u, 'admin.verwalten')

/** Lesen im Admin-Panel: alle mit Zugang zum Admin-Panel */
export const canReadGeoAdmin = (u: GeoUser | null) => darf(u, 'admin.zugang')
