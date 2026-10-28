// seekclan.de/quiz – alle Quiz-Kategorien an einer Stelle.
//
// Neue Kategorie: hier eintragen. Die Hauptseite /quiz zeigt sie dann automatisch als Kachel.
// status 'bald' = Kachel erscheint, ist aber noch nicht anklickbar.
// href zeigt auf die Startseite der Kategorie. Geo liegt (noch) unter /geo – nach dem Umzug nach /quiz/geo
// nur hier den Pfad ändern.

export type KategorieKey = 'geo' | 'fussball' | 'sprachen'

export interface QuizKategorie {
  key: KategorieKey
  titel: string
  /** Eine Zeile unter dem Titel */
  untertitel: string
  /** Text auf der Kachel */
  text: string
  href: string
  /** Akzentfarbe der Kachel (volle Farbe, kein Verlauf) */
  farbe: string
  status: 'live' | 'bald'
  /** Symbol (siehe Icon in app/quiz/_components/QuizIcon.tsx) */
  icon: 'globe' | 'ball' | 'speech'
}

export const KATEGORIEN: QuizKategorie[] = [
  {
    key: 'geo',
    titel: 'Geografie',
    untertitel: 'Atlas & GeoGuessr',
    text: 'Länder, Hauptstädte, Regionen, Flaggen und GeoGuessr-Wissen – auf der Karte finden, zuordnen oder eintippen.',
    href: '/geo',
    farbe: '#e9b35f',
    status: 'live',
    icon: 'globe',
  },
  {
    key: 'fussball',
    titel: 'Fußball',
    untertitel: 'Vereine, Spieler, Turniere',
    text: 'Fußball-Wissen zum Durchspielen.',
    href: '/quiz/fussball',
    farbe: '#5fb07a',
    status: 'bald',
    icon: 'ball',
  },
  {
    key: 'sprachen',
    titel: 'Sprachen',
    untertitel: 'Lerntool',
    text: 'Sprachen und Schriften lernen.',
    href: '/quiz/sprachen',
    farbe: '#5aa9c9',
    status: 'bald',
    icon: 'speech',
  },
]

export const KATEGORIE_BY_KEY = Object.fromEntries(KATEGORIEN.map(k => [k.key, k])) as Record<KategorieKey, QuizKategorie>