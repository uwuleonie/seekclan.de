// Europa-Quizzes: Regionen und Städte aller Länder Europas, Russland in vier Stufen, Flughäfen, Häfen, Bahnhöfe,
// Postleitzahlen, Stadtteile großer Städte, Autobahnen und Bahnstrecken.
// Die Einträge liegen in public/geo/items/{europa,stadtteile,verkehr}.json (erzeugt von scripts/geo/build-europa.mjs).

import { EUROPA_COUNTS, EUROPA_FILES, STADTTEIL_GROUPS } from '../_data/europa'
import type { GroupDef, Kind, LonLat, ProjectionKind, QuizDef } from '../_lib/types'
import { C, CYCLE } from './palette'

const g = (name: string, color: string): GroupDef => ({ name, color })
const POP = { mio: g('über 1 Million', C.rose), gross: g('250.000 bis 1 Million', C.ochre), mittel: g('100.000 bis 250.000', C.blue), klein: g('unter 100.000', C.green) }
const ALLE = (name: string, color: string = C.ochre) => ({ alle: g(name, color) })
const cycle = (names: Record<string, string>) => Object.fromEntries(Object.entries(names).map(([k, n], i) => [k, g(n, CYCLE[i % CYCLE.length])]))

interface Opts {
  slug: string; title: string; meta: string; text: string; country?: string; kind: Kind; noun: string
  ask: [string, string, string?]; groups: Record<string, GroupDef>; layers?: string[]; section?: string
  frame?: [LonLat, LonLat]; projection?: ProjectionKind; labelSize?: number; tip?: { title: string; text: string }; intro?: string
}

function q(o: Opts): QuizDef {
  const count = EUROPA_COUNTS[o.slug] ?? 0
  return {
    slug: o.slug, title: o.title, bereich: 'europa', country: o.country, kind: o.kind, section: o.section,
    meta: o.meta.replace('#', count.toLocaleString('de-DE')), text: o.text,
    items: [], itemsFile: EUROPA_FILES[o.slug] ?? 'europa', count,
    itemsNoun: o.noun, askClick: o.ask[0], askName: o.ask[1], askText: o.ask[2],
    groups: o.groups, layers: o.layers ?? [], frame: o.frame, projection: o.projection, labelSize: o.labelSize ?? 8, tip: o.tip, intro: o.intro,
    // Feinere Küsten und Grenzen für Europa (Natural Earth 1:10m) – Russland braucht die ganze Welt-Ebene
    ...(o.country === 'RUS' ? {} : { contextLayer: 'world-eu' }),
  }
}

const EUROPA_FRAME: [LonLat, LonLat] = [[-25, 34], [45, 71.5]]
const RU_FRAME: [LonLat, LonLat] = [[19, 41], [180, 78]]

/* ───────────── Regionen ───────────── */

type RegionRow = [slug: string, title: string, country: string, noun: string, one: string, capWord: string, text: string, groups?: Record<string, GroupDef>, extra?: Partial<Opts>]

const REGIONEN: RegionRow[] = [
  ['ch-kantone', 'Schweiz – Kantone', 'CHE', 'Kantone', 'der Kanton', 'Kürzel', 'Alle 26 Kantone der Schweiz – mit Hauptort und Autokennzeichen-Kürzel.', undefined,
    { tip: { title: 'Tipp', text: 'Die Kürzel stehen auf jedem Schweizer Autokennzeichen – z.B. ZH 123 456 für Zürich.' } }],
  ['pl-woiwodschaften', 'Polen – Woiwodschaften', 'POL', 'Woiwodschaften', 'die Woiwodschaft', 'Hauptstadt', 'Die 16 Woiwodschaften Polens – von Westpommern bis Karpatenvorland.'],
  ['cz-regionen', 'Tschechien – Regionen', 'CZE', 'Regionen', 'die Region', 'Hauptstadt', 'Die 14 Regionen (Kraje) Tschechiens – mit deutschen Namen wie Pilsen, Karlsbad und Brünn.'],
  ['sk-regionen', 'Slowakei – Regionen', 'SVK', 'Regionen', 'die Region', 'Hauptstadt', 'Die acht Regionen (Kraje) der Slowakei – jede heißt wie ihre Hauptstadt.'],
  ['hu-komitate', 'Ungarn – Komitate', 'HUN', 'Komitate', 'das Komitat', 'Hauptstadt', 'Die 19 Komitate Ungarns und die Hauptstadt Budapest.'],
  ['ro-kreise', 'Rumänien – Kreise', 'ROU', 'Kreise', 'der Kreis', 'Kreishauptstadt', 'Die 41 Kreise (Județe) Rumäniens und Bukarest – mit Kronstadt, Hermannstadt & Co.'],
  ['bg-oblasti', 'Bulgarien – Oblasti', 'BGR', 'Oblasti', 'der Oblast', 'Hauptstadt', 'Die 28 Oblasti Bulgariens – jeder heißt wie seine Hauptstadt.'],
  ['gr-regionen', 'Griechenland – Regionen', 'GRC', 'Regionen', 'die Region', 'Hauptstadt', 'Die 13 Regionen Griechenlands und die Mönchsrepublik Athos.'],
  ['hr-gespanschaften', 'Kroatien – Gespanschaften', 'HRV', 'Gespanschaften', 'die Gespanschaft', 'Hauptstadt', 'Die 20 Gespanschaften Kroatiens und die Stadt Zagreb.'],
  ['rs-bezirke', 'Serbien – Bezirke', 'SRB', 'Bezirke', 'der Bezirk', 'Verwaltungssitz', 'Die 24 Bezirke (Okruzi) Serbiens und die Stadt Belgrad.'],
  ['se-provinzen', 'Schweden – Provinzen (Län)', 'SWE', 'Provinzen', 'die Provinz', 'Residenzstadt', 'Die 21 Län (Provinzen) Schwedens – von Skåne bis Norrbotten.'],
  ['fi-landschaften', 'Finnland – Landschaften', 'FIN', 'Landschaften', 'die Landschaft', 'Hauptort', 'Die Landschaften (Maakunnat) des finnischen Festlands.'],
  ['dk-regionen', 'Dänemark – Regionen', 'DNK', 'Regionen', 'die Region', 'Verwaltungssitz', 'Die fünf Regionen Dänemarks.'],
  ['be-provinzen', 'Belgien – Provinzen', 'BEL', 'Provinzen', 'die Provinz', 'Hauptstadt', 'Die zehn Provinzen Belgiens und Brüssel – farbig nach Flandern und Wallonien.',
    { fl: g('Flandern', C.ochre), wa: g('Wallonien', C.rose), bru: g('Brüssel', C.blue) }],
  ['pt-distrikte', 'Portugal – Distrikte', 'PRT', 'Distrikte', 'der Distrikt', 'Hauptstadt', 'Die 18 Distrikte auf dem Festland und die Azoren und Madeira.'],
  ['ie-counties', 'Irland – Grafschaften', 'IRL', 'Grafschaften', 'die Grafschaft', 'Verwaltungssitz', 'Die 26 Grafschaften der Republik Irland – farbig nach den alten Provinzen.',
    { le: g('Leinster', C.green), mu: g('Munster', C.ochre), co: g('Connacht', C.blue), ul: g('Ulster (Republik)', C.rose) }],
  ['is-regionen', 'Island – Regionen', 'ISL', 'Regionen', 'die Region', 'Größter Ort', 'Die acht Regionen Islands.'],
  ['ee-kreise', 'Estland – Kreise', 'EST', 'Kreise', 'der Kreis', 'Hauptort', 'Die 15 Kreise (Maakonnad) Estlands – mit den alten deutschen Namen der Städte.'],
  ['lt-bezirke', 'Litauen – Bezirke', 'LTU', 'Bezirke', 'der Bezirk', 'Hauptstadt', 'Die zehn Bezirke (Apskritys) Litauens.'],
  ['al-qarqe', 'Albanien – Qarqe', 'ALB', 'Qarqe', 'der Qark', 'Hauptstadt', 'Die zwölf Qarqe (Kreise) Albaniens.'],
  ['by-woblasze', 'Belarus – Woblasze', 'BLR', 'Woblasze', 'die Woblasz', 'Hauptstadt', 'Die sechs Woblasze (Gebiete) von Belarus und die Hauptstadt Minsk.'],
  ['ua-oblaste', 'Ukraine – Oblaste', 'UKR', 'Oblaste', 'die Oblast', 'Hauptstadt', 'Die 24 Oblaste der Ukraine, Kyjiw und die Krim mit Sewastopol.', undefined,
    { tip: { title: 'Gut zu wissen', text: 'Die Krim und Teile im Osten und Süden sind von Russland besetzt. Völkerrechtlich gehören sie zur Ukraine – so zeigt es auch diese Karte.' } }],
  ['ru-subjekte', 'Russland – Föderationssubjekte', 'RUS', 'Subjekte', 'das Subjekt', 'Hauptstadt', 'Republiken, Regionen, Gebiete und autonome Kreise Russlands – nach Föderationskreisen gefärbt.',
    cycle({ zentral: 'Zentralrussland', nordwest: 'Nordwestrussland', sued: 'Südrussland', kaukasus: 'Nordkaukasus', wolga: 'Wolga', ural: 'Ural', sibirien: 'Sibirien', fernost: 'Ferner Osten' }),
    { frame: RU_FRAME, labelSize: 6, tip: { title: 'Gut zu wissen', text: 'Russland zählt 89 Subjekte – darunter die besetzte Krim, Sewastopol und vier Gebiete der Ukraine. Hier sind die 83 völkerrechtlich anerkannten.' } }],
]

/* ───────────── Städte ───────────── */

type CityRow = [slug: string, title: string, country: string, text: string, extra?: Partial<Opts>]

const STAEDTE: CityRow[] = [
  ['at-staedte', 'Österreich – Städte', 'AUT', 'Wien, Graz, Linz, Salzburg – alle Städte Österreichs ab 20.000 Einwohnern.'],
  ['ch-staedte', 'Schweiz – Städte', 'CHE', 'Zürich, Genf, Basel, Bern – alle Städte der Schweiz ab 20.000 Einwohnern.'],
  ['fr-grossstaedte', 'Frankreich – Großstädte', 'FRA', 'Paris, Marseille, Lyon und alle Städte Frankreichs ab 100.000 Einwohnern.'],
  ['pl-staedte', 'Polen – Großstädte', 'POL', 'Warschau, Krakau, Breslau – alle Städte Polens ab 100.000 Einwohnern.', { tip: { title: 'Tipp', text: 'Deutsche Namen wie Danzig, Stettin oder Posen werden beim Eintippen auch akzeptiert – und umgekehrt.' } }],
  ['cz-staedte', 'Tschechien – Städte', 'CZE', 'Prag, Brünn, Ostrau, Pilsen – die Städte Tschechiens ab 35.000 Einwohnern.'],
  ['sk-staedte', 'Slowakei – Städte', 'SVK', 'Bratislava, Košice, Prešov – die Städte der Slowakei.'],
  ['hu-staedte', 'Ungarn – Städte', 'HUN', 'Budapest, Debrecen, Szeged – die Städte Ungarns ab 40.000 Einwohnern.'],
  ['ro-staedte', 'Rumänien – Städte', 'ROU', 'Bukarest, Klausenburg, Temeswar – die Städte Rumäniens ab 80.000 Einwohnern.'],
  ['bg-staedte', 'Bulgarien – Städte', 'BGR', 'Sofia, Plowdiw, Warna – die Städte Bulgariens.'],
  ['gr-staedte', 'Griechenland – Städte', 'GRC', 'Athen, Thessaloniki, Patras – die Städte Griechenlands (viele Vororte Athens zählen einzeln).'],
  ['hr-staedte', 'Kroatien – Städte', 'HRV', 'Zagreb, Split, Rijeka, Osijek – die Städte Kroatiens.'],
  ['si-staedte', 'Slowenien – Städte', 'SVN', 'Ljubljana, Maribor, Celje – die Städte Sloweniens.'],
  ['rs-staedte', 'Serbien – Städte', 'SRB', 'Belgrad, Novi Sad, Niš – die Städte Serbiens.'],
  ['ba-staedte', 'Bosnien und Herzegowina – Städte', 'BIH', 'Sarajevo, Banja Luka, Mostar – die Städte von Bosnien und Herzegowina.'],
  ['me-staedte', 'Montenegro – Städte', 'MNE', 'Podgorica, Nikšić, Budva – die Städte Montenegros.'],
  ['mk-staedte', 'Nordmazedonien – Städte', 'MKD', 'Skopje, Bitola, Ohrid – die Städte Nordmazedoniens.'],
  ['al-staedte', 'Albanien – Städte', 'ALB', 'Tirana, Durrës, Vlora – die Städte Albaniens.'],
  ['xk-staedte', 'Kosovo – Städte', 'KOS', 'Pristina, Prizren, Peja – die Städte des Kosovo.'],
  ['md-staedte', 'Moldau – Städte', 'MDA', 'Chișinău, Bălți, Tiraspol – die Städte der Republik Moldau.'],
  ['ua-staedte', 'Ukraine – Großstädte', 'UKR', 'Kyjiw, Charkiw, Odessa, Lwiw – die Großstädte der Ukraine ab 150.000 Einwohnern (Stand vor 2022).'],
  ['by-staedte', 'Belarus – Städte', 'BLR', 'Minsk, Homel, Mahiljou – die Städte von Belarus ab 50.000 Einwohnern.'],
  ['se-staedte', 'Schweden – Städte', 'SWE', 'Stockholm, Göteborg, Malmö – die Städte Schwedens ab 40.000 Einwohnern.'],
  ['fi-staedte', 'Finnland – Städte', 'FIN', 'Helsinki, Tampere, Turku, Oulu – die Städte Finnlands.'],
  ['dk-staedte', 'Dänemark – Städte', 'DNK', 'Kopenhagen, Aarhus, Odense – die Städte Dänemarks ab 20.000 Einwohnern.'],
  ['is-staedte', 'Island – Orte', 'ISL', 'Reykjavík, Akureyri und alle Orte Islands ab 2.000 Einwohnern.'],
  ['pt-staedte', 'Portugal – Städte', 'PRT', 'Lissabon, Porto, Braga – die Städte Portugals ab 40.000 Einwohnern.'],
  ['be-staedte', 'Belgien – Städte', 'BEL', 'Brüssel, Antwerpen, Gent, Lüttich – die Städte Belgiens ab 50.000 Einwohnern.'],
  ['cy-staedte', 'Zypern – Städte', 'CYP', 'Nikosia, Limassol, Larnaka – die Städte Zyperns.'],
]

const RU_STUFEN: [string, string, string][] = [
  ['ru-staedte-einfach', 'Einfach', 'Die Millionenstädte Russlands – von Moskau bis Krasnojarsk.'],
  ['ru-staedte-mittel', 'Mittel', 'Alle Städte Russlands ab 500.000 Einwohnern.'],
  ['ru-staedte-schwer', 'Schwer', 'Alle Städte Russlands ab 250.000 Einwohnern.'],
  ['ru-staedte-sehr-schwer', 'Sehr schwer', 'Alle Großstädte Russlands ab 100.000 Einwohnern.'],
]

/* ───────────── Flughäfen ───────────── */

const AP_GROUPS = { gross: g('Großer Flughafen', C.rose), mittel: g('Mittlerer Flughafen', C.blue) }
const AP_ASK: [string, string, string] = ['Wo liegt der Flughafen?', 'Welcher Flughafen ist markiert?', 'Welcher IATA-Code?']
const FLUGHAEFEN: [string, string, string | undefined, string, Partial<Opts>?][] = [
  ['de-flughaefen', 'Deutschland – Flughäfen', 'DEU', 'Alle Verkehrsflughäfen Deutschlands mit Linienflügen – mit IATA-Code (FRA, MUC, BER …).'],
  ['uk-flughaefen', 'Vereinigtes Königreich – Flughäfen', 'GBR', 'Heathrow, Gatwick, Manchester – die Flughäfen Großbritanniens und Nordirlands mit Linienflügen.'],
  ['fr-flughaefen', 'Frankreich – Flughäfen', 'FRA', 'Paris-Charles de Gaulle, Orly, Nizza – die Flughäfen Frankreichs mit Linienflügen.'],
  ['it-flughaefen', 'Italien – Flughäfen', 'ITA', 'Fiumicino, Malpensa, Venedig – die Flughäfen Italiens mit Linienflügen.'],
  ['es-flughaefen', 'Spanien – Flughäfen', 'ESP', 'Madrid, Barcelona, Palma – die Flughäfen Spaniens samt Balearen und Kanaren.'],
  ['gr-flughaefen', 'Griechenland – Flughäfen', 'GRC', 'Athen, Thessaloniki und die Inselflughäfen von Korfu bis Rhodos.'],
  ['ru-flughaefen', 'Russland – Flughäfen', 'RUS', 'Die großen Flughäfen Russlands – von Kaliningrad bis Kamtschatka.', { frame: RU_FRAME }],
  ['europa-flughaefen', 'Europa – Große Flughäfen', undefined, 'Die großen Flughäfen Europas mit IATA-Code – von Keflavík bis Kyjiw.', { frame: EUROPA_FRAME, section: 'Verkehr' }],
]

/* ───────────── Stadtteile ───────────── */

const sg = (slug: string) => (STADTTEIL_GROUPS[slug] ? cycle(STADTTEIL_GROUPS[slug]) : undefined)
const STADTTEILE: [string, string, string, string, string, Record<string, GroupDef> | undefined, Partial<Opts>?][] = [
  ['berlin-bezirke', 'Berlin – Bezirke', 'DEU', 'Bezirke', 'Die zwölf Bezirke Berlins – von Mitte bis Spandau.', undefined],
  ['berlin-ortsteile', 'Berlin – Ortsteile', 'DEU', 'Ortsteile', 'Alle 97 Ortsteile Berlins – nach Bezirken gefärbt.', sg('berlin-ortsteile')],
  ['hamburg-bezirke', 'Hamburg – Bezirke', 'DEU', 'Bezirke', 'Die sieben Bezirke Hamburgs.', undefined],
  ['hamburg-stadtteile', 'Hamburg – Stadtteile', 'DEU', 'Stadtteile', 'Die Stadtteile Hamburgs – nach Bezirken gefärbt.', sg('hamburg-stadtteile')],
  ['muenchen-bezirke', 'München – Stadtbezirke', 'DEU', 'Stadtbezirke', 'Die 25 Stadtbezirke Münchens.', undefined],
  ['koeln-bezirke', 'Köln – Stadtbezirke', 'DEU', 'Stadtbezirke', 'Die neun Stadtbezirke Kölns.', undefined],
  ['koeln-stadtteile', 'Köln – Stadtteile', 'DEU', 'Stadtteile', 'Alle 86 Stadtteile Kölns – nach Stadtbezirken gefärbt.', sg('koeln-stadtteile')],
  ['frankfurt-stadtteile', 'Frankfurt am Main – Stadtteile', 'DEU', 'Stadtteile', 'Alle 46 Stadtteile Frankfurts – von Altstadt bis Bergen-Enkheim.', undefined],
  ['wien-bezirke', 'Wien – Bezirke', 'AUT', 'Bezirke', 'Die 23 Wiener Gemeindebezirke – mit ihren Nummern.', undefined,
    { tip: { title: 'Tipp', text: 'Die Bezirksnummer steckt in der Postleitzahl: 1010 ist der 1. Bezirk, 1230 der 23.' } }],
  ['london-boroughs', 'London – Boroughs', 'GBR', 'Boroughs', 'Die 32 Londoner Boroughs und die City of London.', { inner: g('Inner London', C.rose), outer: g('Outer London', C.blue) }],
  ['paris-arrondissements', 'Paris – Arrondissements', 'FRA', 'Arrondissements', 'Die 20 Arrondissements von Paris – im Schneckenhaus vom Louvre bis Ménilmontant.', undefined,
    { tip: { title: 'Tipp', text: 'Die Arrondissements sind spiralförmig im Uhrzeigersinn nummeriert – wie ein Schneckenhaus.' } }],
  ['lyon-arrondissements', 'Lyon – Arrondissements', 'FRA', 'Arrondissements', 'Die neun Arrondissements von Lyon.', undefined],
  ['marseille-arrondissements', 'Marseille – Arrondissements', 'FRA', 'Arrondissements', 'Die 16 Arrondissements von Marseille.', undefined],
  ['madrid-distritos', 'Madrid – Distritos', 'ESP', 'Distritos', 'Die 21 Bezirke (Distritos) von Madrid.', undefined],
  ['barcelona-districtes', 'Barcelona – Districtes', 'ESP', 'Districtes', 'Die zehn Bezirke von Barcelona.', undefined],
  ['barcelona-barris', 'Barcelona – Barris', 'ESP', 'Barris', 'Alle 73 Viertel (Barris) Barcelonas – nach Bezirken gefärbt.', sg('barcelona-barris')],
]

/* ───────────── Straßen & Bahn ───────────── */

const STRASSEN: QuizDef[] = [
  q({
    slug: 'de-autobahnen', title: 'Deutschland – Autobahnen', meta: '# Autobahnen', country: 'DEU', kind: 'strassen', section: 'Verkehr',
    text: 'Alle Autobahnen Deutschlands – von der A 1 bis zur A 995. Wo verläuft welche Nummer?', noun: 'Autobahnen',
    ask: ['Wo verläuft die Autobahn?', 'Welche Autobahn ist markiert?', 'Welche Nummer hat die Strecke?'],
    groups: { fern: g('A 1 – A 9 (Fernautobahnen)', C.rose), region: g('A 10 – A 99 (Regional)', C.ochre), kurz: g('dreistellig (Zubringer)', C.slate) },
    layers: ['eu-de-autobahnen'], frame: [[5.6, 47.2], [15.3, 55.1]],
    tip: { title: 'So funktionieren die Nummern', text: 'Ungerade Nummern führen meist von Nord nach Süd, gerade von West nach Ost. Einstellige sind die großen Fernstrecken. Bei zweistelligen verrät die erste Ziffer die Gegend: 1 = Nordosten, 2 = Norden, 3 = Niedersachsen, 4/5 = NRW, 6 = Rheinland-Pfalz/Hessen/Saarland, 7 = Thüringen/Franken, 8 = Baden-Württemberg, 9 = Bayern.' },
  }),
  q({
    slug: 'de-bundesstrassen', title: 'Deutschland – Bundesstraßen', meta: '# Bundesstraßen · B 1 bis B 99', country: 'DEU', kind: 'strassen', section: 'Verkehr',
    text: 'Die Bundesstraßen mit ein- und zweistelliger Nummer – die alten Fernstraßen quer durchs Land.', noun: 'Bundesstraßen',
    ask: ['Wo verläuft die Bundesstraße?', 'Welche Bundesstraße ist markiert?'],
    groups: { eins: g('B 1 – B 9', C.rose), zwei: g('B 10 – B 49', C.ochre), fuenf: g('B 50 – B 99', C.blue) },
    layers: ['eu-de-bundesstrassen'], frame: [[5.6, 47.2], [15.3, 55.1]],
    tip: { title: 'Gut zu wissen', text: 'Die niedrigen Nummern stammen noch von den Reichsstraßen der 1930er-Jahre. Die B 1 führt von Aachen über Berlin bis an die polnische Grenze.' },
  }),
  q({
    slug: 'europa-europastrassen', title: 'Europa – Europastraßen', meta: '# Routen · E 1 bis E 99', kind: 'strassen', section: 'Verkehr',
    text: 'Die großen Europastraßen von E 1 bis E 99 – die grünen Schilder, die quer über den Kontinent führen.', noun: 'Europastraßen',
    ask: ['Wo verläuft die Europastraße?', 'Welche Europastraße ist markiert?'], frame: EUROPA_FRAME, layers: ['eu-europa-europastrassen'],
    groups: { 'nord-sued': g('Nord-Süd-Hauptroute (…5)', C.rose), 'west-ost': g('West-Ost-Hauptroute (…0)', C.blue), 'nord-sued-z': g('Nord-Süd (ungerade)', C.ochre), 'west-ost-z': g('West-Ost (gerade)', C.teal) },
    tip: { title: 'So funktionieren die Nummern', text: 'Ungerade Nummern führen von Nord nach Süd und werden nach Osten größer, gerade Nummern von West nach Ost und werden nach Süden größer. Die Hauptrouten enden auf 5 (Nord-Süd) oder 0 (West-Ost).' },
  }),
  q({
    slug: 'fr-autoroutes', title: 'Frankreich – Autoroutes', meta: '# Autobahnen', country: 'FRA', kind: 'strassen', section: 'Verkehr',
    text: 'Die Autobahnen Frankreichs – die „Autoroute du Soleil“, die A1 nach Lille und alle anderen.', noun: 'Autobahnen',
    ask: ['Wo verläuft die Autoroute?', 'Welche Autoroute ist markiert?', 'Welche Nummer hat die Strecke?'],
    groups: { paris: g('A1 – A19 (meist ab Paris)', C.rose), region: g('A20 und höher', C.blue) }, layers: ['eu-fr-autoroutes'],
    tip: { title: 'So funktionieren die Nummern', text: 'Die niedrigen Nummern (A1 bis A16) strahlen grob im Uhrzeigersinn von Paris aus: A1 nach Norden, A4 nach Osten, A6 nach Süden, A10 nach Südwesten, A13 nach Westen.' },
  }),
  q({
    slug: 'es-autovias', title: 'Spanien – Autovías & Autopistas', meta: '# Autobahnen', country: 'ESP', kind: 'strassen', section: 'Verkehr',
    text: 'Die Autobahnen Spaniens – die sechs Strahlen ab Madrid, die Mittelmeer-Autobahn und alle anderen.', noun: 'Autobahnen',
    ask: ['Wo verläuft die Autobahn?', 'Welche Autobahn ist markiert?', 'Welche Nummer hat die Strecke?'],
    groups: { radial: g('A-1 bis A-6 (ab Madrid)', C.rose), andere: g('Andere Autovías', C.ochre), maut: g('Autopistas (AP, mautpflichtig)', C.blue) }, layers: ['eu-es-autovias'],
    tip: { title: 'So funktionieren die Nummern', text: 'A-1 bis A-6 führen sternförmig von Madrid weg – im Uhrzeigersinn ab Norden: A-1 Burgos, A-2 Barcelona, A-3 Valencia, A-4 Sevilla, A-5 Badajoz, A-6 La Coruña. „AP“ heißt Autopista, die war oder ist mautpflichtig.' },
  }),
]

const BAHN: [string, string, string, string][] = [
  ['nl-bahn', 'Niederlande – Bahnstrecken', 'NLD', 'Die wichtigsten Bahnstrecken der Niederlande – inklusive HSL-Zuid und Betuweroute.'],
  ['be-bahn', 'Belgien – Bahnstrecken', 'BEL', 'Die wichtigsten Bahnstrecken Belgiens – mit den Schnellfahrstrecken nach Paris, Köln und Amsterdam.'],
  ['fr-bahn', 'Frankreich – Bahnstrecken', 'FRA', 'Die großen Bahnstrecken Frankreichs – mit den LGV-Schnellfahrstrecken des TGV.'],
  ['es-bahn', 'Spanien – Bahnstrecken', 'ESP', 'Die großen Bahnstrecken Spaniens – mit den Hochgeschwindigkeitsstrecken des AVE.'],
  ['it-bahn', 'Italien – Bahnstrecken', 'ITA', 'Die großen Bahnstrecken Italiens – mit den Schnellfahrstrecken (Alta Velocità).'],
  ['at-bahn', 'Österreich – Bahnstrecken', 'AUT', 'Von Wien nach Salzburg, über den Semmering und den Brenner – die Bahnstrecken Österreichs.'],
  ['uk-bahn', 'Vereinigtes Königreich – Bahnstrecken', 'GBR', 'West Coast Main Line, East Coast Main Line, HS1 – die großen Bahnstrecken Großbritanniens.'],
]

/* ───────────── Katalog ───────────── */

export const EUROPA_QUIZZES: QuizDef[] = [
  ...REGIONEN.map(([slug, title, country, noun, one, capWord, text, groups, extra]) => q({
    slug, title, country, text, kind: 'regionen', noun, meta: `# ${noun}`,
    ask: [`Wo liegt ${one}?`, `${one.replace(/^der /, 'Welcher ').replace(/^die /, 'Welche ').replace(/^das /, 'Welches ')} ist markiert?`, `${capWord}?`],
    groups: groups ?? ALLE(title.split(' – ')[0]), layers: [`eu-${slug}`], ...extra,
  })),
  ...STAEDTE.map(([slug, title, country, text, extra]) => q({
    slug, title, country, text, kind: 'staedte', noun: 'Städte', meta: '# Städte', ask: ['Wo liegt die Stadt?', 'Welche Stadt ist markiert?'], groups: POP, ...extra,
  })),
  ...RU_STUFEN.map(([slug, stufe, text]) => q({
    slug, title: `Russland – Städte (${stufe})`, country: 'RUS', text, kind: 'staedte', noun: 'Städte', meta: `# Städte · ${stufe}`,
    ask: ['Wo liegt die Stadt?', 'Welche Stadt ist markiert?'], groups: POP, frame: RU_FRAME,
  })),
  ...FLUGHAEFEN.map(([slug, title, country, text, extra]) => q({
    slug, title, country, text, kind: 'flughaefen', noun: 'Flughäfen', meta: '# Flughäfen · mit IATA-Code', ask: AP_ASK, groups: AP_GROUPS, ...extra,
  })),
  q({
    slug: 'europa-haefen', title: 'Europa – Häfen', meta: '# Häfen', kind: 'haefen', section: 'Verkehr', noun: 'Häfen',
    text: 'Rotterdam, Hamburg, Antwerpen, Piräus – die großen See- und Binnenhäfen Europas.',
    ask: ['Wo liegt der Hafen?', 'Welcher Hafen ist markiert?', 'In welchem Land?'], frame: EUROPA_FRAME,
    groups: cycle({ nordsee: 'Nordsee', aermelkanal: 'Ärmelkanal', ostsee: 'Ostsee', atlantik: 'Atlantik', mittelmeer: 'Mittelmeer', 'schwarzes-meer': 'Schwarzes Meer', nordmeer: 'Nordmeer', binnenhafen: 'Binnenhafen' }),
  }),
  q({
    slug: 'de-bahnhoefe', title: 'Deutschland – Fernbahnhöfe', meta: '# Bahnhöfe', country: 'DEU', kind: 'bahn', section: 'Verkehr', noun: 'Bahnhöfe',
    text: 'Die großen Bahnhöfe Deutschlands (Kategorie 1 und 2 der Deutschen Bahn) – von Kiel Hbf bis München Hbf.',
    ask: ['Wo liegt der Bahnhof?', 'Welcher Bahnhof ist markiert?', 'In welchem Bundesland?'], frame: [[5.6, 47.2], [15.3, 55.1]],
    groups: { k1: g('Kategorie 1 (größte Knoten)', C.rose), k2: g('Kategorie 2', C.blue) },
  }),
  q({
    slug: 'de-plz-zonen', title: 'Deutschland – Postleitzonen', meta: '# Zonen', country: 'DEU', kind: 'postleitzahlen', section: 'Verkehr', noun: 'Zonen',
    text: 'Die zehn Postleitzonen – die erste Ziffer jeder Postleitzahl. Wo fängt die PLZ mit 6 an?',
    ask: ['Wo liegt die Zone?', 'Welche Zone ist markiert?', 'Welche erste Ziffer?'], groups: ALLE('Deutschland'), layers: ['eu-plz-zonen'], labelSize: 12,
  }),
  q({
    slug: 'de-plz-regionen', title: 'Deutschland – Postleitregionen', meta: '# Regionen · zweistellig', country: 'DEU', kind: 'postleitzahlen', section: 'Verkehr', noun: 'Leitregionen',
    text: 'Alle zweistelligen Postleitregionen – 60… ist Frankfurt, 80… München. Wo liegt die 35?',
    ask: ['Wo liegt die Leitregion?', 'Welche Leitregion ist markiert?', 'Welche zwei Ziffern?'], layers: ['eu-plz-regionen'],
    groups: cycle(Object.fromEntries([...'0123456789'].map(z => [`z${z}`, `Zone ${z}`]))),
    tip: { title: 'Tipp', text: 'Die erste Ziffer ist die Zone, die zweite die Region darin. Die Zone ist farbig – so findest du dich schneller zurecht.' },
  }),
  q({
    slug: 'de-wahlkreise', title: 'Deutschland – Bundestagswahlkreise', meta: '# Wahlkreise · Wahl 2025', country: 'DEU', kind: 'regionen', noun: 'Wahlkreise',
    text: 'Alle 299 Wahlkreise der Bundestagswahl 2025 – mit Nummer und Bundesland.',
    ask: ['Wo liegt der Wahlkreis?', 'Welcher Wahlkreis ist markiert?', 'Welche Nummer?'], layers: ['eu-de-wahlkreise'], labelSize: 6,
    groups: cycle(STADTTEIL_GROUPS['de-wahlkreise'] ?? {}),
    tip: { title: 'Gut zu wissen', text: 'Die Nummern laufen Bundesland für Bundesland – grob von Norden nach Süden: Wahlkreis 1 ist Flensburg – Schleswig, Wahlkreis 299 ist Homburg im Saarland.' },
  }),
  ...STADTTEILE.map(([slug, title, country, noun, text, groups, extra]) => q({
    slug, title, country, text, kind: 'stadtteile', noun, meta: `# ${noun}`, layers: [`eu-${slug}`], labelSize: 7,
    ask: ['Wo liegt der Stadtteil?', 'Welcher Stadtteil ist markiert?', groups ? 'In welchem Bezirk?' : 'Nummer?'],
    groups: groups ?? ALLE(title.split(' – ')[0], C.terra), ...extra,
  })),
  ...STRASSEN,
  ...BAHN.map(([slug, title, country, text]) => q({
    slug, title, country, text, kind: 'bahn', section: 'Verkehr', noun: 'Strecken', meta: '# Strecken', layers: [`eu-${slug}`],
    ask: ['Wo verläuft die Strecke?', 'Welche Strecke ist markiert?'], groups: ALLE('Strecke', C.terra),
  })),
].filter(d => (EUROPA_COUNTS[d.slug] ?? 0) > 0)