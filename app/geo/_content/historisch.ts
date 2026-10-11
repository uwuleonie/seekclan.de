// Historische Quizzes: Europa 1815 und 1914, Deutscher Bund (mit Flaggen), Italien vor der Einigung, Kaiserreich,
// Besatzungszonen, Berlin 1945–1990, Europa 1989, Jugoslawien, Sowjetunion, Kolonien 1914, neue Staaten,
// Weltwunder, ehemalige Hauptstädte, alte Städtenamen und die Hanse.
// Die Einträge liegen in public/geo/items/historisch.json (erzeugt von scripts/geo/build-historisch.mjs).

import { HIST_COUNTS } from '../_data/historisch'
import type { Bereich, GroupDef, Kind, LonLat, OverlayLine, QuizDef } from '../_lib/types'

type Opts = Partial<QuizDef> & {
  slug: string; title: string; meta: string; text: string; bereich: Bereich; layers: string[]; noun: string; ask: [string, string, string?]
  groups: Record<string, GroupDef>; kind?: Kind
}

function h(o: Opts): QuizDef {
  const { noun, ask, ...rest } = o
  const count = HIST_COUNTS[o.slug] ?? 0
  return {
    kind: 'historisch',
    section: 'Geschichte',
    items: [],
    itemsFile: 'historisch',
    count,
    itemsNoun: noun,
    askClick: ask[0],
    askName: ask[1],
    askText: ask[2],
    look: 'atlas',
    combinable: false,
    labelSize: 7,
    ...rest,
    meta: o.meta.replace('#', count.toLocaleString('de-DE')),
  }
}

const g = (name: string, color: string): GroupDef => ({ name, color })
const WELT: [LonLat, LonLat] = [[-180, -58], [180, 84]]
const BERLIN: [LonLat, LonLat] = [[13.08, 52.335], [13.77, 52.68]]
const DB_LINIE: OverlayLine = { ref: 'hist-linien:bund-1815', label: 'Grenze des Deutschen Bundes', kind: 'border' }

const G1815 = { gross: g('Großmächte', '#c9637a'), bund: g('Deutscher Bund', '#e0a84f'), italien: g('Italienische Staaten', '#5fb07a'), uebrige: g('Übrige Staaten', '#5b9bd5') }
const G1914 = { mittel: g('Mittelmächte', '#7a7a7a'), entente: g('Entente & Verbündete', '#d9774b'), neutral: g('Neutral', '#5b9bd5') }
const MAECHTE = {
  gb: g('Britisches Weltreich', '#d9534f'), fr: g('Frankreich', '#4f7fd9'), de: g('Deutsches Reich', '#7a7a7a'), pt: g('Portugal', '#3fa36b'),
  es: g('Spanien', '#e6b422'), it: g('Italien', '#8fc45a'), be: g('Belgien', '#b8860b'), nl: g('Niederlande', '#f08a24'), us: g('USA', '#6a5acd'),
  jp: g('Japan', '#e377c2'), ru: g('Russland', '#8c564b'), dk: g('Dänemark', '#c76b98'), os: g('Osmanisches Reich', '#a0522d'), frei: g('Unabhängig', '#c9b47a'),
}
const SEKTOREN = { us: g('Amerikanischer Sektor', '#5b8fd1'), uk: g('Britischer Sektor', '#c9637a'), fr: g('Französischer Sektor', '#5fb07a'), su: g('Sowjetischer Sektor', '#d9774b') }

export const HISTORISCH_QUIZZES: QuizDef[] = [
  /* ── Europa ── */
  h({
    slug: 'europa-1815', title: 'Europa 1815', meta: '# Staaten · nach dem Wiener Kongress', bereich: 'europa',
    text: 'Die Landkarte nach dem Wiener Kongress: Großmächte, Königreiche und der Deutsche Bund.',
    layers: ['hist-1815'], contextLayer: 'hist-1815', today: true, lines: [DB_LINIE], groups: G1815,
    frame: [[-11, 35.5], [41, 62]], noun: 'Staaten', ask: ['Wo lag der Staat?', 'Welcher Staat ist markiert?', 'Hauptstadt um 1815?'],
    intro: 'Lernmodus – tippe auf einen Staat. Die kleinen deutschen und italienischen Staaten sind im schweren Quiz dabei.',
    tip: { title: 'Wusstest du?', text: 'Norwegen und Schweden hatten 1815 denselben König, waren aber zwei eigene Königreiche. Die Union hielt bis 1905.' },
  }),
  h({
    slug: 'europa-1815-schwer', title: 'Europa 1815 (schwer)', meta: '# Staaten · mit allen Kleinstaaten', bereich: 'europa',
    text: 'Alle Staaten von 1815 – inklusive aller Mitglieder des Deutschen Bundes und aller italienischen Staaten.',
    layers: ['hist-1815'], contextLayer: 'hist-1815', today: true, lines: [DB_LINIE], groups: G1815,
    frame: [[-11, 35.5], [41, 62]], noun: 'Staaten', ask: ['Wo lag der Staat?', 'Welcher Staat ist markiert?', 'Hauptstadt um 1815?'],
    tip: { title: 'Tipp', text: 'Reinzoomen! Reuß, Schwarzburg und die sächsischen Herzogtümer liegen alle in Thüringen.' },
  }),
  h({
    slug: 'europa-1914', title: 'Europa 1914', meta: '# Staaten · vor dem Ersten Weltkrieg', bereich: 'europa',
    text: 'Deutsches Reich, Österreich-Ungarn, Russisches Reich – die Grenzen am Vorabend des Ersten Weltkriegs.',
    layers: ['hist-1914'], contextLayer: 'hist-1914', today: true, groups: G1914,
    frame: [[-11, 34.5], [44, 66]], noun: 'Staaten', ask: ['Wo lag der Staat?', 'Welcher Staat ist markiert?', 'Hauptstadt 1914?'],
    tip: { title: 'Wusstest du?', text: 'Polen gab es 1914 nicht – es war zwischen Russland, Deutschland und Österreich-Ungarn aufgeteilt.' },
  }),
  h({
    slug: 'europa-1914-schwer', title: 'Europa 1914 (schwer)', meta: '# Staaten & Gebiete', bereich: 'europa',
    text: 'Dazu Elsass-Lothringen, Bosnien-Herzegowina, Finnland, Island und Malta – Gebiete, die 1914 zu einem anderen Staat gehörten.',
    layers: ['hist-1914'], contextLayer: 'hist-1914', today: true, groups: G1914,
    frame: [[-25, 34.5], [44, 67]], noun: 'Staaten & Gebiete', ask: ['Wo lag es?', 'Was ist markiert?', 'Hauptstadt 1914?'],
  }),
  h({
    slug: 'europa-1989', title: 'Europa 1989', meta: '# Staaten · Kalter Krieg', bereich: 'europa',
    text: 'Das Jahr, in dem die Mauer fiel: NATO, Warschauer Pakt und die Neutralen – mit Eisernem Vorhang.',
    layers: ['hist-1989', 'world'], today: true, groups: { nato: g('NATO', '#4f7fd9'), wp: g('Warschauer Pakt', '#d9534f'), neutral: g('Neutral & blockfrei', '#c9b47a'), sonder: g('Sonderstatus', '#8fc45a') },
    lines: [{ ref: 'hist-linien:eiserner-vorhang', label: 'Eiserner Vorhang', kind: 'wall' }],
    frame: [[-25, 34], [50, 70]], noun: 'Staaten', ask: ['Wo lag der Staat?', 'Welcher Staat ist markiert?', 'NATO, Warschauer Pakt oder neutral?'],
    tip: { title: 'Wusstest du?', text: 'Albanien war bis 1968 im Warschauer Pakt – danach schottete es sich völlig ab, auch gegen die Sowjetunion.' },
  }),
  h({
    slug: 'jugoslawien', title: 'Jugoslawien', meta: '# Republiken & Provinzen', bereich: 'europa',
    text: 'Die sechs Teilrepubliken und zwei autonomen Provinzen der Sozialistischen Föderativen Republik Jugoslawien.',
    layers: ['hist-jugoslawien'], today: true, groups: { republik: g('Teilrepublik', '#d9774b'), provinz: g('Autonome Provinz (Serbien)', '#5b9bd5') },
    noun: 'Republiken & Provinzen', ask: ['Wo lag die Republik?', 'Was ist markiert?', 'Hauptstadt damals?'],
    tip: { title: 'Wusstest du?', text: 'Die Hauptstadt Montenegros hieß 1946–1992 Titograd – nach Staatschef Tito.' },
  }),
  h({
    slug: 'ex-sowjetstaaten', title: 'Ehemalige Sowjetrepubliken', meta: '# Staaten', bereich: 'europa',
    text: 'Die 15 Nachfolgestaaten der Sowjetunion – mit den Namen und Hauptstädten von damals.',
    layers: ['world'], groups: { russland: g('Russland', '#d9534f'), baltikum: g('Baltikum', '#5b9bd5'), osteuropa: g('Osteuropa', '#e0a84f'), kaukasus: g('Kaukasus', '#5fb07a'), zentralasien: g('Zentralasien', '#c9637a') },
    frame: [[19, 35], [180, 78]], noun: 'Staaten', ask: ['Wo liegt das Land?', 'Welches Land ist markiert?', 'Hauptstadt zu Sowjetzeiten?'],
  }),
  h({
    slug: 'hanse', title: 'Die Hanse', meta: '# Städte & Kontore', bereich: 'europa',
    text: 'Lübeck, Danzig, Visby, Brügge – die großen Hansestädte und die vier Kontore im Ausland.',
    layers: ['world'], groups: {
      kontor: g('Kontore', '#d9534f'), wendisch: g('Wendische Städte', '#e0a84f'), westfalen: g('Westfalen & Rheinland', '#5b9bd5'),
      sachsen: g('Sachsen & Mark', '#5fb07a'), preussen: g('Pommern, Preußen & Polen', '#c9637a'), livland: g('Livland & Gotland', '#3fa7a8'), niederlande: g('Niederlande', '#f08a24'),
    },
    frame: [[-1, 47.5], [32, 61.5]], noun: 'Städte', ask: ['Wo liegt die Hansestadt?', 'Welche Stadt ist markiert?'],
    tip: { title: 'Gut zu wissen', text: 'Die Hanse war ein lockerer Bund – wer genau dazugehörte, änderte sich über die Jahrhunderte. Hier stehen bekannte Mitglieder.' },
  }),

  h({
    slug: 'zeitmaschine', title: 'Zeitmaschine', meta: '10 Karten · 1715 bis heute', bereich: 'europa',
    text: 'Eine Karte von Europa – aber aus welchem Jahr? Erkenne die Epoche an den Grenzen.',
    layers: [], groups: {}, special: 'zeitmaschine', count: 10, itemsFile: undefined,
    noun: 'Karten', ask: ['', 'Aus welchem Jahr ist diese Karte?'],
  }),

  /* ── Deutschland ── */
  h({
    slug: 'deutscher-bund-1815', title: 'Deutscher Bund 1815', meta: '# Mitglieder', bereich: 'europa', country: 'DEU',
    text: 'Alle Mitglieder des Deutschen Bundes – vom Kaisertum Österreich bis zur Freien Stadt Frankfurt.',
    layers: ['hist-1815'], contextLayer: 'hist-1815', today: true, lines: [DB_LINIE], groups: { bund: g('Deutscher Bund', '#e0a84f') },
    frame: [[4.2, 45.4], [22.5, 55.2]], noun: 'Staaten', ask: ['Wo lag der Staat?', 'Welcher Staat ist markiert?', 'Hauptstadt um 1815?'],
    intro: 'Lernmodus – tippe auf einen Staat. Die Landesgrenzen in Thüringen, Anhalt und Hohenzollern sind nach heutigen Landkreisen angenähert.',
    tip: { title: 'Wusstest du?', text: 'Österreich und Preußen gehörten nur mit einem Teil ihres Gebiets zum Bund – die rote Linie zeigt seine Grenze.' },
  }),
  h({
    slug: 'deutscher-bund-flaggen', title: 'Flaggen im Deutschen Bund', meta: '# Flaggen · um 1860', bereich: 'europa', country: 'DEU', kind: 'flaggen',
    text: 'Schwarz-Gelb, Weiß-Grün, Blau-Gelb-Rot: Ordne die Flaggen der deutschen Staaten zu.',
    layers: ['hist-1860'], contextLayer: 'hist-1860', groups: { bund: g('Deutscher Bund', '#e0a84f') },
    frame: [[4.2, 45.4], [22.5, 55.2]], noun: 'Flaggen', ask: ['Wo wehte diese Flagge?', 'Welche Flagge gehört hierher?', 'Welcher Staat?'],
    intro: 'Lernmodus – tippe auf einen Staat, um seine Flagge zu sehen. Staaten mit gleicher Flagge sind zusammengefasst.',
    tip: { title: 'Gut zu wissen', text: 'Viele Kleinstaaten hatten keine amtlich festgelegte Flagge, nur „Landesfarben“. Stichjahr ist etwa 1860; unsichere Fälle stehen im Lernmodus dabei.' },
  }),
  h({
    slug: 'kaiserreich-1871', title: 'Deutsches Kaiserreich', meta: '# Bundesstaaten · 1871–1918', bereich: 'europa', country: 'DEU',
    text: '22 Monarchien, 3 Freie Städte und das Reichsland Elsass-Lothringen.',
    layers: ['hist-kaiserreich'], contextLayer: 'hist-kaiserreich', today: true,
    groups: { koenig: g('Königreich', '#c9637a'), gross: g('Großherzogtum', '#e0a84f'), herzog: g('Herzogtum', '#5fb07a'), fuerst: g('Fürstentum', '#5b9bd5'), stadt: g('Freie Stadt', '#d9774b'), reichsland: g('Reichsland', '#8c8c8c') },
    frame: [[5.5, 47], [23, 55.6]], noun: 'Bundesstaaten', ask: ['Wo lag der Bundesstaat?', 'Welcher Bundesstaat ist markiert?', 'Hauptstadt?'],
    intro: 'Lernmodus – tippe auf einen Bundesstaat. Grenzen in Thüringen nach heutigen Landkreisen angenähert.',
  }),
  h({
    slug: 'zonen-1945', title: 'Besatzungszonen 1945', meta: '# Zonen & Gebiete', bereich: 'europa', country: 'DEU',
    text: 'Amerikanisch, britisch, französisch, sowjetisch – und die Gebiete östlich von Oder und Neiße.',
    layers: ['hist-1945'], today: true, groups: { west: g('Westzonen', '#5b9bd5'), ost: g('Osten', '#d9534f'), berlin: g('Berlin', '#e0a84f') },
    frame: [[5.5, 47], [23, 55.6]], noun: 'Zonen', ask: ['Wo lag die Zone?', 'Was ist markiert?'],
  }),
  h({
    slug: 'berlin-1945', title: 'Berlin 1945–1990', meta: '# Bezirke · 4 Sektoren', bereich: 'europa', country: 'DEU',
    text: 'Die 20 Berliner Bezirke und ihre Sektoren – mit dem Verlauf der Mauer.',
    layers: ['hist-berlin'], groups: SEKTOREN, lines: [{ ref: 'hist-linien:mauer', label: 'Berliner Mauer (1961–1989)', kind: 'wall' }],
    frame: BERLIN, noun: 'Bezirke', ask: ['Wo lag der Bezirk?', 'Welcher Bezirk ist markiert?', 'Welcher Sektor?'],
    tip: { title: 'Wusstest du?', text: 'Der Ortsteil West-Staaken (Spandau) wurde 1951 der DDR zugeschlagen – deshalb macht die Mauer dort einen Knick.' },
  }),
  h({
    slug: 'berlin-sektoren', title: 'Berlin – Sektoren', meta: '# Sektoren', bereich: 'europa', country: 'DEU',
    text: 'Die vier Sektoren der geteilten Stadt.',
    layers: ['hist-berlin'], groups: SEKTOREN, lines: [{ ref: 'hist-linien:mauer', label: 'Berliner Mauer (1961–1989)', kind: 'wall' }],
    frame: BERLIN, noun: 'Sektoren', ask: ['Wo lag der Sektor?', 'Welcher Sektor ist markiert?'],
  }),

  /* ── Italien ── */
  h({
    slug: 'italien-1815', title: 'Italien vor der Einigung', meta: '# Staaten · 1815–1860', bereich: 'europa', country: 'ITA',
    text: 'Sardinien-Piemont, Kirchenstaat, Beide Sizilien und die Herzogtümer – Italien vor 1861.',
    layers: ['hist-1815'], contextLayer: 'hist-1815', today: true,
    groups: { savoyen: g('Haus Savoyen', '#5b9bd5'), habsburg: g('Habsburger', '#e0a84f'), bourbon: g('Bourbonen', '#c9637a'), papst: g('Papst', '#c9b47a'), frei: g('Republik & Fürstentum', '#5fb07a') },
    frame: [[5.8, 36.5], [18.8, 47.1]], noun: 'Staaten', ask: ['Wo lag der Staat?', 'Welcher Staat ist markiert?', 'Hauptstadt?'],
    intro: 'Lernmodus – tippe auf einen Staat. Die Grenzen sind nach heutigen Provinzen angenähert.',
    tip: { title: 'Wusstest du?', text: 'Nach Napoleons Sturz bekam seine zweite Frau Marie-Louise das Herzogtum Parma – auf Lebenszeit.' },
  }),

  /* ── Afrika ── */
  h({
    slug: 'afrika-1914', title: 'Afrika 1914', meta: '# Kolonien & Staaten', bereich: 'afrika',
    text: 'Fast ganz Afrika war 1914 aufgeteilt – nur Abessinien und Liberia waren unabhängig.',
    layers: ['hist-welt-1914'], contextLayer: 'hist-welt-1914', today: true, groups: MAECHTE,
    frame: [[-26, -36], [60, 38]], noun: 'Gebiete', ask: ['Wo lag die Kolonie?', 'Welche Kolonie ist markiert?', 'Zu welchem Reich gehörte es?'],
    tip: { title: 'Wusstest du?', text: 'Kamerun reichte 1914 bis an den Kongo – „Neukamerun“ hatte Frankreich 1911 abgetreten.' },
  }),

  /* ── Welt ── */
  h({
    slug: 'welt-kolonien-1914', title: 'Kolonien der Welt 1914', meta: '# Kolonien', bereich: 'welt',
    text: 'Von Britisch-Indien bis Deutsch-Samoa: die Kolonien und Dominions der Weltmächte 1914.',
    layers: ['hist-welt-1914'], contextLayer: 'hist-welt-1914', today: true, groups: MAECHTE,
    frame: WELT, projection: 'naturalEarth', labelSize: 6, noun: 'Kolonien', ask: ['Wo lag die Kolonie?', 'Welche Kolonie ist markiert?', 'Zu welchem Reich gehörte es?'],
    tip: { title: 'Tipp', text: 'Im Pazifik liegen viele Inseln – reinzoomen hilft.' },
  }),
  h({
    slug: 'welt-imperien-1914', title: 'Weltreiche 1914', meta: '# Kolonialmächte', bereich: 'welt',
    text: 'Britisches Weltreich, Frankreich, Deutschland & Co. – jedes Reich mit allen seinen Kolonien.',
    layers: ['hist-welt-1914'], contextLayer: 'hist-welt-1914', groups: MAECHTE,
    frame: WELT, projection: 'naturalEarth', labelSize: 6, noun: 'Reiche', ask: ['Wo lag das Reich?', 'Welches Reich ist markiert?'],
    tip: { title: 'Wusstest du?', text: 'Das Britische Weltreich umfasste 1914 rund ein Viertel der Landfläche der Erde.' },
  }),
  h({
    slug: 'antike-117', title: 'Antike Welt 117 n. Chr.', meta: '# Reiche & Völker', bereich: 'welt',
    text: 'Das Römische Reich auf dem Höhepunkt unter Trajan – und seine Nachbarn von Germanien bis Han-China.',
    layers: ['hist-antike'], contextLayer: 'hist-antike', today: true,
    groups: { rom: g('Rom & Verbündete', '#c9637a'), europa: g('Europa', '#5b9bd5'), asien: g('Asien', '#e0a84f'), afrika: g('Afrika & Arabien', '#5fb07a') },
    frame: [[-12, 0], [125, 58]], noun: 'Reiche', ask: ['Wo lag das Reich?', 'Welches Reich ist markiert?', 'Hauptstadt um 117?'],
    tip: { title: 'Gut zu wissen', text: 'Rom ist nach dem Ancient World Mapping Center eingezeichnet, die Nachbarn nach historical-basemaps – deren Grenzen sind sehr grob.' },
  }),
  h({
    slug: 'neue-staaten', title: 'Neue Staaten seit 1990', meta: '# Staaten', bereich: 'welt',
    text: 'Von Namibia 1990 bis Südsudan 2011 – alle Staaten, die seit 1990 neu entstanden sind.',
    layers: ['world'], groups: {
      sowjet: g('aus der Sowjetunion', '#d9534f'), jugo: g('aus Jugoslawien', '#e0a84f'), europa: g('Tschechoslowakei', '#5b9bd5'),
      afrika: g('Afrika', '#5fb07a'), asien: g('Asien', '#c9637a'), ozeanien: g('Ozeanien', '#3fa7a8'), vereinigt: g('Vereinigungen', '#8c8c8c'),
    },
    frame: WELT, projection: 'naturalEarth', labelSize: 6, noun: 'Staaten', ask: ['Wo liegt der Staat?', 'Welcher Staat ist markiert?', 'In welchem Jahr?'],
  }),
  h({
    slug: 'weltwunder', title: 'Weltwunder', meta: '# antike & neue Weltwunder', bereich: 'welt',
    text: 'Die sieben Weltwunder der Antike und die „neuen sieben Weltwunder“ von 2007.',
    layers: ['world'], groups: { antik: g('Antike Weltwunder', '#e0a84f'), neu: g('Neue Weltwunder (2007)', '#5b9bd5') },
    frame: WELT, projection: 'naturalEarth', noun: 'Weltwunder', ask: ['Wo stand das Weltwunder?', 'Welches Weltwunder ist markiert?', 'Antik oder neu?'],
    tip: { title: 'Tipp', text: 'Fünf der sieben antiken Weltwunder lagen rund um die Ägäis und im östlichen Mittelmeer.' },
  }),
  h({
    slug: 'ehemalige-hauptstaedte', title: 'Ehemalige Hauptstädte', meta: '# Städte', bereich: 'welt',
    text: 'Bonn, Rio, Kyoto, Kalkutta – Städte, die einmal Hauptstadt waren.',
    layers: ['world'], groups: { europa: g('Europa', '#5b9bd5'), asien: g('Asien', '#e0a84f'), afrika: g('Afrika', '#d9774b'), amerika: g('Amerika', '#c9637a'), ozeanien: g('Ozeanien', '#3fa7a8') },
    frame: WELT, projection: 'naturalEarth', noun: 'Städte', ask: ['Wo liegt die Stadt?', 'Welche Stadt ist markiert?', 'Hauptstadt von welchem Staat?'],
  }),
  h({
    slug: 'alte-staedtenamen', title: 'Alte Städtenamen', meta: '# Städte', bereich: 'welt',
    text: 'Konstantinopel, Leningrad, Bombay, Lutetia – wie heißen diese Städte heute?',
    layers: ['world'], groups: {
      antike: g('Antike', '#c9b47a'), europa: g('Europa', '#5b9bd5'), sowjet: g('Sowjetische Namen', '#d9534f'), asien: g('Asien', '#e0a84f'), kolonial: g('Koloniale Namen', '#5fb07a'),
    },
    frame: WELT, projection: 'naturalEarth', noun: 'Städte', ask: ['Wo lag die Stadt?', 'Welcher alte Name gehört hierher?', 'Wie heißt die Stadt heute?'],
  }),
]