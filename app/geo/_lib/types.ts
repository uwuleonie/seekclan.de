// Gemeinsame Typen für seekclan.de/geo
//
// Ein Quiz (QuizDef) besteht aus Einträgen (GeoItem). Ein Eintrag zeigt auf Flächen aus Karten-Ebenen
// (public/geo/layers/<ebene>.json, Koordinaten in Längen-/Breitengrad) und/oder auf einen Punkt.
// Weil alles echte Koordinaten hat, lassen sich beliebige Quizzes auf EINER Karte kombinieren (Baukasten).

export type Bereich = 'welt' | 'europa' | 'asien' | 'afrika' | 'nordamerika' | 'suedamerika' | 'ozeanien' | 'sprachen'
/** Echte Kontinente (ohne Welt und ohne den Themen-Bereich Sprachen) */
export type Kontinent = Exclude<Bereich, 'welt' | 'sprachen'>

export type Kind =
  | 'laender' | 'hauptstaedte' | 'regionen' | 'staedte' | 'fluesse' | 'berge'
  | 'flaggen' | 'historisch' | 'bahn' | 'wissen' | 'sprachen' | 'vorwahlen' | 'kennzeichen'
  | 'kontinente' | 'meere' | 'seen' | 'wuesten' | 'gebiete' | 'flughaefen' | 'domains' | 'rekorde'
  | 'stadtteile' | 'strassen' | 'haefen' | 'postleitzahlen'

export type LonLat = [number, number]

export interface ItemDetail { label: string; value: string; big?: boolean }

export interface GeoItem {
  /** Weltweit eindeutig, z.B. "land:DEU", "DE-BY", "hs:FRA" – gleiche Keys werden beim Kombinieren zusammengelegt */
  key: string
  /** Antwort im Namen-/Tipp-Modus */
  label: string
  /** Was im Klick-Modus gesucht wird (Standard: label) */
  prompt?: string
  /** Kleine Zusatzzeile zur Frage */
  promptSub?: string
  group: string
  /** Flächen als "ebene:id", z.B. "world:DEU" oder "adm1-DEU:DE-BY" */
  areas?: string[]
  /** Punkt (z.B. Stadt) als [Länge, Breite] */
  point?: LonLat
  details?: ItemDetail[]
  /** Wissens-Frage ohne Karte */
  text?: { prompt: string; sub?: string; answer: string; big?: boolean }
  /** Weitere akzeptierte Schreibweisen beim Eintippen */
  aliases?: string[]
  /** Flagge (Schlüssel in /geo/flags.json, z.B. "de") – wird im Lernmodus gezeigt */
  flag?: string
  /** Flaggen-Quiz: gefragt wird mit der Flagge statt mit dem Namen */
  flagPrompt?: boolean
  /** Form des Punktes auf der Karte (Standard: Kreis) */
  pointShape?: 'tri'
  /** Aussprache: Text, Sprache, echte Aufnahme (siehe _lib/audio.ts) */
  say?: { t: string; l: string; a?: string[]; src?: string }
}

export type ProjectionKind = 'auto' | 'naturalEarth' | 'albersUsa' | 'mercator' | 'conic'

export interface GroupDef { name: string; color: string }

interface DefBase {
  slug: string
  title: string
  /** Kurze Zeile auf der Kachel, z.B. "16 Bundesländer · Hauptstädte" */
  meta: string
  bereich: Bereich
  /** Land, zu dem das Quiz gehört (ISO3 aus Natural Earth) – gruppiert die Kontinent-Seite */
  country?: string
  kind: Kind
  /** Abschnitt auf der Bereichs-Seite (z.B. "Natur") – gleiche Abschnitte stehen zusammen */
  section?: string
}

export interface QuizDef extends DefBase {
  planned?: false
  /** Text auf der Kachel */
  text: string
  askClick: string
  askName: string
  askText?: string
  itemsNoun: string
  groups: Record<string, GroupDef>
  /** Einträge – bei großen Quizzes leer, dann werden sie aus itemsFile nachgeladen */
  items: GeoItem[]
  /** Große Quizzes: Einträge liegen in public/geo/items/<itemsFile>.json (Schlüssel = slug) */
  itemsFile?: string
  /** Anzahl Einträge, wenn sie nachgeladen werden */
  count?: number
  /** Karten-Ebenen, die geladen werden müssen (die Welt-Ebene für den Hintergrund kommt automatisch dazu) */
  layers: string[]
  /** Kartenausschnitt [[West, Süd], [Ost, Nord]] – leer = automatisch aus den Flächen */
  frame?: [LonLat, LonLat]
  projection?: ProjectionKind
  /** Nachbarländer grau im Hintergrund (Standard: an) */
  context?: boolean
  labelSize?: number
  /** Text im Lernmodus, wenn nichts ausgewählt ist */
  intro?: string
  /** Tipp-Karte unter der Legende (z.B. GeoGuessr-Tipp) */
  tip?: { title: string; text: string }
  /** Lässt sich im Baukasten mit anderen Quizzes mischen (Standard: ja) */
  combinable?: boolean
  /** Kartenstil: "atlas" = alter Atlas (Pergament, Pastellfarben) – für historische Karten */
  look?: 'atlas'
  /** Hintergrund aus dieser Ebene statt der heutigen Weltkarte (z.B. die übrigen Staaten von 1815) */
  contextLayer?: string
  /** Flächen der Hintergrund-Ebene, die nicht gezeichnet werden (ids) */
  contextSkip?: string[]
  /** Schalter "Heutige Grenzen" zum Vergleich einblenden */
  today?: boolean
  /** Zusätzliche Linien auf der Karte (z.B. Berliner Mauer), nicht anklickbar */
  lines?: OverlayLine[]
  /** Eigenes Spiel statt Karten-Quiz (z.B. "zeitmaschine": Jahr einer Karte erraten) */
  special?: 'zeitmaschine' | 'schrift'
}

export interface OverlayLine {
  /** "ebene:id", z.B. "hist-linien:mauer" */
  ref: string
  label: string
  /** Aussehen: Mauer (dick, dunkel), Grenze (gestrichelt) */
  kind: 'wall' | 'border'
}

/** Geplantes Quiz – wird als "Bald verfügbar" gezeigt, ist aber noch nicht gebaut */
export interface PlannedDef extends DefBase {
  planned: true
  text?: string
}

export type CatalogEntry = QuizDef | PlannedDef

/** Freischalt-Status eines Quiz für den aktuellen Besucher */
export interface QuizStatus {
  /** Darf gespielt werden */
  open: boolean
  /** Offiziell freigeschaltet (für alle) */
  released: boolean
  /** Zeitpunkt der (geplanten) Freischaltung, falls gesetzt */
  releaseAt: string | null
  /** Noch nicht gebaut */
  planned: boolean
  /** Erst seit kurzem freigeschaltet */
  isNew: boolean
  /** Für diesen Besucher unsichtbar (Adminpanel: nur Admins / nur bestimmte Rollen) – erscheint nirgends */
  hidden: boolean
  /** Im Adminpanel auf "nur Admins"/"nur Rollen" gestellt (Admins sehen es mit Hinweis) */
  adminOnly: boolean
}