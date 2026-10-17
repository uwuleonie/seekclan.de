import CLANLISTE from '@/app/api/admin2/raenge/umstellung/clanliste.json'

// Clan-Liste aus dem Spiel (Stand 16.10.2026, von Leonie geschickt) – app/api/admin2/raenge/umstellung/clanliste.json.
// Wird für die Umstellung genutzt und damit niemand aus dieser Liste als „ehemalig“ erscheint, nur weil
// sein Rang auf der Website (noch) nicht stimmt.

/** Stand der Liste – wer danach laut Clan-Historie gegangen ist, zählt nicht mehr */
export const CLANLISTE_STAND = '2026-10-17T00:00:00+02:00'

const NAMEN = new Set((CLANLISTE.spieler as [string, string | null, string][]).map(([n]) => n.toLowerCase()))

/** Steht der Name in der Clan-Liste aus dem Spiel? */
export const inClanListe = (name: string | null | undefined) => !!name && NAMEN.has(name.toLowerCase())
