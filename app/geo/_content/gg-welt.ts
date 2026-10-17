// GeoGuessr-Edition: weltweite Quizzes, die nur Länder mit Street-View-Abdeckung in GeoGuessr enthalten.
// Die Einträge kommen aus den normalen Welt-Quizzes und werden erst beim Öffnen mit der GG-Länderliste aus dem
// Adminpanel gefiltert (QuizDef.ggQuelle, siehe _lib/gg.ts). Neue Länder im Adminpanel → sofort in allen GG-Editionen.

import type { GroupDef, QuizDef } from '../_lib/types'
import { GG_STANDARD, LINKSVERKEHR } from '../_lib/gg'
import { COUNTRIES } from '../_data/world'
import { WELT_QUIZZES } from './welt'
import { WELT_EXTRA_QUIZZES } from './welt-extra'

export const GG_EDITION = 'GeoGuessr-Edition'
const ALLE = [...WELT_QUIZZES, ...WELT_EXTRA_QUIZZES]
const src = (slug: string) => {
  const d = ALLE.find(q => q.slug === slug)
  if (!d) throw new Error(`GG-Edition: Quelle ${slug} fehlt`)
  return d
}
/** Ungefähre Anzahl mit der Standardliste (die echte Zahl hängt an der Liste im Adminpanel) */
const MIT_GG = COUNTRIES.filter(c => GG_STANDARD.includes(c.id)).length

/** GG-Edition eines Quiz: gleiche Karte und Fragen, nur Länder mit Abdeckung */
export function ggEdition(quelle: QuizDef, o: Partial<QuizDef> & { slug: string; title: string; meta: string; text: string }): QuizDef {
  return {
    ...quelle,
    section: GG_EDITION,
    gg: 'ja',
    count: o.count ?? MIT_GG,
    ...o,
    ggQuelle: o.ggQuelle ?? { slug: quelle.slug, filter: true },
    combinable: o.combinable ?? quelle.combinable,
  }
}

const JN = (ja: string, nein: string): Record<string, GroupDef> => ({ ja: { name: ja, color: '#5fb07a' }, nein: { name: nein, color: '#6b7280' } })

export const GG_WELT_QUIZZES: QuizDef[] = [
  ggEdition(src('welt-laender'), {
    slug: 'gg-welt-laender', title: 'Alle Länder der Welt (GG Edition)', meta: `ca. ${MIT_GG} Länder mit Street View`, difficulty: 'schwer',
    text: 'Nur die Länder, in denen du in GeoGuessr landen kannst – finden, benennen oder eintippen.',
    tip: { title: 'GeoGuessr-Tipp', text: 'Kleine Gebiete wie Gibraltar, Jersey oder die Weihnachtsinsel kommen in GeoGuessr selten, aber sie kommen.' },
  }),
  ggEdition(src('welt-flaggen'), {
    slug: 'gg-welt-flaggen', title: 'Alle Flaggen der Welt (GG Edition)', meta: `ca. ${MIT_GG} Flaggen`, difficulty: 'schwer',
    text: 'Flaggen sieht man in GeoGuessr an Behörden, Schulen und Tankstellen. Hier nur die Länder mit Street View.',
  }),
  ggEdition(src('welt-hauptstaedte'), {
    slug: 'gg-welt-hauptstaedte', title: 'Hauptstädte der Welt (GG Edition)', meta: `ca. ${MIT_GG} Hauptstädte`, difficulty: 'schwer',
    text: 'Die Hauptstädte aller GeoGuessr-Länder – Schilder mit der Entfernung zur Hauptstadt helfen beim Raten.',
  }),
  ggEdition(src('welt-vorwahlen'), {
    slug: 'gg-welt-vorwahlen', title: 'Telefon-Vorwahlen (GG Edition)', meta: 'Vorwahlen der GG-Länder', difficulty: 'schwer',
    text: 'Telefonnummern stehen auf Werbeschildern, Lieferwagen und Läden – an der Vorwahl erkennst du das Land.',
  }),
  ggEdition(src('welt-domains'), {
    slug: 'gg-welt-domains', title: 'Länderdomains (GG Edition)', meta: 'Domains der GG-Länder', difficulty: 'mittel',
    text: '.co.za, .ke, .com.br: Webadressen auf Plakaten und Autos verraten das Land.',
  }),
  ggEdition(src('welt-laender'), {
    slug: 'gg-welt-linksverkehr', title: 'Linksverkehr oder Rechtsverkehr? (GG Edition)', meta: 'GG-Länder · links oder rechts',
    text: 'Einer der wichtigsten Hinweise überhaupt: Auf welcher Straßenseite wird gefahren?',
    kind: 'wissen', groups: JN('Linksverkehr', 'Rechtsverkehr'), combinable: false, difficulty: 'leicht', askText: 'Links oder rechts?',
    ggQuelle: { slug: 'welt-laender', filter: true, teile: { liste: LINKSVERKEHR } },
    intro: 'Lernmodus – grün: Linksverkehr, grau: Rechtsverkehr.',
    merkmal: { alle: 'Finde alle Länder mit Linksverkehr', janein: '{name}: Wird links gefahren?' },
    tip: { title: 'GeoGuessr-Tipp', text: 'Achte auf parkende Autos, Leitpfosten und die Seite der Mittellinie. Linksverkehr in Afrika: Südafrika, Namibia, Botswana, Lesotho, Eswatini, Kenia, Uganda.' },
  }),
  ggEdition(src('welt-laender'), {
    slug: 'gg-welt-abdeckung', title: 'Gibt es hier Street View?', meta: 'alle Länder · ja oder nein',
    text: 'In welchen Ländern kannst du in GeoGuessr überhaupt landen? Wer das weiß, schließt sofort viele Länder aus.',
    kind: 'wissen', groups: JN('mit Street View', 'ohne Street View'), combinable: false, count: COUNTRIES.length, difficulty: 'mittel', askText: 'Street View?',
    ggQuelle: { slug: 'welt-laender', filter: false, teile: {} },
    intro: 'Lernmodus – grün: Länder mit offizieller Abdeckung in GeoGuessr.',
    merkmal: { alle: 'Finde alle Länder mit Street View', janein: '{name}: Gibt es dort Street View in GeoGuessr?' },
    tip: { title: 'Gut zu wissen', text: 'In Afrika gibt es Street View vor allem im Süden und Osten (Südafrika, Kenia, Uganda, Ruanda …) und im Westen in Senegal, Ghana und Nigeria.' },
  }),
]