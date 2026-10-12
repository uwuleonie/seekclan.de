// Handgepflegte Daten für „GeoGuessr Europa“ (Phase 6). Wird von scripts/geo/build-gg.mjs gelesen.
//
// Quellen:
//  - Hinweise je Land (scripts/geo/gg/laender/*.json): Fakten aus dem Plonk-It-Guide (plonkit.net, Lizenz CC BY-NC-SA 4.0)
//    und dem älteren Guide „GeoGuessr – The Top Tips, Tricks and Techniques“ (somerandomstuff1.wordpress.com) – auf Deutsch neu formuliert.
//  - Ortsschilder & Fußgängerüberweg-Schilder: offizielle Verkehrszeichen-Grafiken von Wikimedia Commons (Liste mit Lizenz und Urheber: scripts/geo/gg/schilder.json).
//  - Straßennummern-Schilder: eigene Grafiken (SVG), Farben nach der Straßennummern-Karte „u/Melongated“ und den Guides.
//  - Kennzeichen-Codes Russland, Polen, Ukraine: Wikidata (Eigenschaft P395 „Kfz-Kennzeichen“).
//  - Fahrseite: in Europa fährt man rechts – links nur im Vereinigten Königreich, in Irland, auf Malta, Zypern, der Isle of Man und Jersey.

/** slug → [Name, ISO3 der Welt-Ebene (null = keine eigene Fläche), Flaggen-Schlüssel, Gruppe] */
export const LAENDER = {
  'ireland': ['Irland', 'IRL', 'ie', 'britisch'],
  'united-kingdom': ['Vereinigtes Königreich', 'GBR', 'gb', 'britisch'],
  'isle-of-man': ['Isle of Man', 'IMN', 'im', 'britisch'],
  'jersey': ['Jersey', 'JEY', 'je', 'britisch'],
  'gibraltar': ['Gibraltar', 'GIB', 'gi', 'iberien'],
  'portugal': ['Portugal', 'PRT', 'pt', 'iberien'],
  'azores': ['Azoren', null, 'pt', 'iberien'],
  'madeira': ['Madeira', null, 'pt', 'iberien'],
  'spain': ['Spanien', 'ESP', 'es', 'iberien'],
  'andorra': ['Andorra', 'AND', 'ad', 'iberien'],
  'france': ['Frankreich', 'FRA', 'fr', 'west'],
  'monaco': ['Monaco', 'MCO', 'mc', 'west'],
  'belgium': ['Belgien', 'BEL', 'be', 'west'],
  'netherlands': ['Niederlande', 'NLD', 'nl', 'west'],
  'luxembourg': ['Luxemburg', 'LUX', 'lu', 'west'],
  'germany': ['Deutschland', 'DEU', 'de', 'alpen'],
  'austria': ['Österreich', 'AUT', 'at', 'alpen'],
  'switzerland': ['Schweiz', 'CHE', 'ch', 'alpen'],
  'liechtenstein': ['Liechtenstein', 'LIE', 'li', 'alpen'],
  'italy': ['Italien', 'ITA', 'it', 'alpen'],
  'san-marino': ['San Marino', 'SMR', 'sm', 'alpen'],
  'malta': ['Malta', 'MLT', 'mt', 'alpen'],
  'slovenia': ['Slowenien', 'SVN', 'si', 'alpen'],
  'norway': ['Norwegen', 'NOR', 'no', 'nord'],
  'svalbard': ['Spitzbergen', null, 'no', 'nord'],
  'sweden': ['Schweden', 'SWE', 'se', 'nord'],
  'finland': ['Finnland', 'FIN', 'fi', 'nord'],
  'denmark': ['Dänemark', 'DNK', 'dk', 'nord'],
  'faroe-islands': ['Färöer', 'FRO', 'fo', 'nord'],
  'iceland': ['Island', 'ISL', 'is', 'nord'],
  'greenland': ['Grönland', 'GRL', 'gl', 'nord'],
  'poland': ['Polen', 'POL', 'pl', 'ostmitte'],
  'czechia': ['Tschechien', 'CZE', 'cz', 'ostmitte'],
  'slovakia': ['Slowakei', 'SVK', 'sk', 'ostmitte'],
  'hungary': ['Ungarn', 'HUN', 'hu', 'ostmitte'],
  'lithuania': ['Litauen', 'LTU', 'lt', 'ostmitte'],
  'latvia': ['Lettland', 'LVA', 'lv', 'ostmitte'],
  'estonia': ['Estland', 'EST', 'ee', 'ostmitte'],
  'croatia': ['Kroatien', 'HRV', 'hr', 'balkan'],
  'bosnia-and-herzegovina': ['Bosnien und Herzegowina', 'BIH', 'ba', 'balkan'],
  'serbia': ['Serbien', 'SRB', 'rs', 'balkan'],
  'montenegro': ['Montenegro', 'MNE', 'me', 'balkan'],
  'north-macedonia': ['Nordmazedonien', 'MKD', 'mk', 'balkan'],
  'albania': ['Albanien', 'ALB', 'al', 'balkan'],
  'romania': ['Rumänien', 'ROU', 'ro', 'balkan'],
  'bulgaria': ['Bulgarien', 'BGR', 'bg', 'balkan'],
  'greece': ['Griechenland', 'GRC', 'gr', 'balkan'],
  'cyprus': ['Zypern', 'CYP', 'cy', 'balkan'],
  'turkey': ['Türkei', 'TUR', 'tr', 'balkan'],
  'russia': ['Russland', 'RUS', 'ru', 'ost'],
  'ukraine': ['Ukraine', 'UKR', 'ua', 'ost'],
  'belarus': ['Belarus', 'BLR', 'by', 'ost'],
}

export const GRUPPEN = {
  britisch: 'Britische Inseln',
  iberien: 'Iberien & Atlantik',
  west: 'Frankreich & Benelux',
  alpen: 'Mitte & Alpen',
  nord: 'Skandinavien & Nordatlantik',
  ostmitte: 'Ostmitteleuropa & Baltikum',
  balkan: 'Balkan, Griechenland & Türkei',
  ost: 'Russland, Ukraine, Belarus',
}

/** Kategorien der Hinweise (Reihenfolge = Reihenfolge im Steckbrief) */
export const KATEGORIEN = {
  'fahrseite': 'Fahrseite',
  'kennzeichen': 'Kennzeichen',
  'poller': 'Poller & Leitpfosten',
  'ortsschild': 'Ortsschilder',
  'wegweiser': 'Wegweiser',
  'strassennummern': 'Straßennummern',
  'linien': 'Fahrbahnlinien',
  'verkehrsschilder': 'Verkehrsschilder',
  'zebrastreifen': 'Zebrastreifen',
  'strommasten': 'Strommasten',
  'sprache': 'Sprache',
  'schrift': 'Schrift',
  'google-auto': 'Google-Auto',
  'kamera': 'Kamera',
  'strassen': 'Straßen',
  'gebaeude': 'Gebäude',
  'landschaft': 'Landschaft',
  'pflanzen': 'Pflanzen',
  'abdeckung': 'Abdeckung',
  'telefon-domain': 'Vorwahl & Domain',
  'sonstiges': 'Sonstiges',
}

/** Merkmale für Vergleich und Ausschluss-Training: Schlüssel → [Name, mögliche Werte] */
export const MERKMALE = {
  fahrseite: ['Fahrseite', ['rechts', 'links']],
  schrift: ['Schrift', ['latein', 'kyrillisch', 'griechisch', 'latein+kyrillisch', 'latein+griechisch']],
  kennzeichen_hinten: ['Kennzeichen hinten', ['weiß', 'gelb', 'gemischt']],
  eu_streifen: ['Blauer Streifen am Kennzeichen', ['ja', 'nein', 'teils']],
  ortsschild_hintergrund: ['Ortsschild', ['weiß', 'gelb', 'blau', 'grün', 'gemischt']],
  ortsschild_rand: ['Ortsschild-Rand', ['rot', 'schwarz', 'blau', 'weiß', 'gemischt']],
  wegweiser: ['Wegweiser', ['weiß', 'gelb', 'blau', 'grün', 'gemischt']],
  mittellinie: ['Mittellinie', ['weiß', 'gelb', 'gemischt']],
  zebrastreifen_schild: ['Zebrastreifen-Schild', ['blau-quadrat', 'gelbes-dreieck', 'blau-gelbrand', 'hoch-blau', 'bake']],
  // Werte aus scripts/geo/gg-zeichnungen.mjs (LINIENFARBE)
  linienfarbe: ['Linienfarben', ['weiß', 'gelb-mitte', 'weiß+gelb', 'gelb-rand']],
}
export const WERT_NAMEN = {
  'latein+kyrillisch': 'Latein & Kyrillisch', 'latein+griechisch': 'Latein & Griechisch',
  'blau-quadrat': 'blaues Quadrat', 'gelbes-dreieck': 'gelbes Dreieck', 'blau-gelbrand': 'blau mit gelbem Rand',
  'hoch-blau': 'hohes blaues Schild', 'bake': 'Bake (Kugel auf Stange)',
  'gelb-mitte': 'gelbe Mittellinie', 'weiß+gelb': 'weiß, teils gelb', 'gelb-rand': 'gelbe Randlinie',
}

/**
 * Ergänzungen und Korrekturen der Merkmale (gehen vor den Werten aus den Guides).
 * Fahrseite und Schrift: allgemein bekannt. Ortsschild: Vergleichsgrafiken „Comparison of locality signs“ (europamapas) + offizielle Zeichen auf Commons.
 * Zebrastreifen: offizielle Zeichen auf Commons (Vergleichstabelle „Comparison of European road signs“).
 */
const R = 'rechts'
export const MERKMAL_FIX = {
  'ireland': { fahrseite: 'links', ortsschild_hintergrund: 'grün', ortsschild_rand: 'weiß', zebrastreifen_schild: 'bake' },
  'united-kingdom': { fahrseite: 'links', ortsschild_hintergrund: 'gemischt', ortsschild_rand: 'gemischt', zebrastreifen_schild: 'bake' },
  'isle-of-man': { fahrseite: 'links' },
  'jersey': { fahrseite: 'links' },
  'gibraltar': { fahrseite: R },
  'portugal': { fahrseite: R, ortsschild_hintergrund: 'weiß', ortsschild_rand: 'schwarz', zebrastreifen_schild: 'blau-quadrat' },
  'azores': { fahrseite: R }, 'madeira': { fahrseite: R },
  'spain': { fahrseite: R, ortsschild_hintergrund: 'weiß', ortsschild_rand: 'rot', zebrastreifen_schild: 'blau-quadrat' },
  'andorra': { fahrseite: R, ortsschild_hintergrund: 'weiß', ortsschild_rand: 'rot' },
  'france': { fahrseite: R, ortsschild_hintergrund: 'weiß', ortsschild_rand: 'rot', zebrastreifen_schild: 'blau-quadrat' },
  'monaco': { fahrseite: R, ortsschild_hintergrund: 'weiß', ortsschild_rand: 'rot' },
  'belgium': { fahrseite: R, ortsschild_hintergrund: 'weiß', ortsschild_rand: 'schwarz', zebrastreifen_schild: 'blau-quadrat' },
  'netherlands': { fahrseite: R, ortsschild_hintergrund: 'blau', ortsschild_rand: 'weiß', zebrastreifen_schild: 'blau-quadrat' },
  'luxembourg': { fahrseite: R, ortsschild_hintergrund: 'gelb', ortsschild_rand: 'schwarz', zebrastreifen_schild: 'blau-quadrat' },
  'germany': { fahrseite: R, ortsschild_hintergrund: 'gelb', ortsschild_rand: 'schwarz', wegweiser: 'gelb', zebrastreifen_schild: 'blau-quadrat' },
  'austria': { fahrseite: R, ortsschild_hintergrund: 'weiß', ortsschild_rand: 'blau', zebrastreifen_schild: 'blau-quadrat' },
  'switzerland': { fahrseite: R, ortsschild_hintergrund: 'gemischt', ortsschild_rand: 'gemischt', zebrastreifen_schild: 'hoch-blau' },
  'liechtenstein': { fahrseite: R, ortsschild_hintergrund: 'blau', ortsschild_rand: 'weiß', zebrastreifen_schild: 'hoch-blau' },
  'italy': { fahrseite: R, ortsschild_hintergrund: 'weiß', ortsschild_rand: 'schwarz', zebrastreifen_schild: 'blau-quadrat' },
  'san-marino': { fahrseite: R },
  'malta': { fahrseite: 'links' },
  'slovenia': { fahrseite: R, ortsschild_hintergrund: 'gelb', ortsschild_rand: 'schwarz', zebrastreifen_schild: 'blau-quadrat' },
  'norway': { fahrseite: R, ortsschild_hintergrund: 'blau', ortsschild_rand: 'weiß', zebrastreifen_schild: 'blau-quadrat' },
  'svalbard': { fahrseite: R },
  'sweden': { fahrseite: R, ortsschild_hintergrund: 'blau', ortsschild_rand: 'weiß', zebrastreifen_schild: 'blau-quadrat' },
  'finland': { fahrseite: R, ortsschild_hintergrund: 'blau', ortsschild_rand: 'weiß', zebrastreifen_schild: 'blau-quadrat' },
  'denmark': { fahrseite: R, ortsschild_hintergrund: 'weiß', ortsschild_rand: 'schwarz', zebrastreifen_schild: 'blau-quadrat' },
  'faroe-islands': { fahrseite: R },
  'iceland': { fahrseite: R, ortsschild_hintergrund: 'gelb', ortsschild_rand: 'schwarz', zebrastreifen_schild: 'gelbes-dreieck' },
  'greenland': { fahrseite: R },
  'poland': { fahrseite: R, ortsschild_hintergrund: 'grün', ortsschild_rand: 'weiß', zebrastreifen_schild: 'blau-quadrat' },
  'czechia': { fahrseite: R, ortsschild_hintergrund: 'weiß', ortsschild_rand: 'schwarz', zebrastreifen_schild: 'blau-quadrat' },
  'slovakia': { fahrseite: R, ortsschild_hintergrund: 'weiß', ortsschild_rand: 'schwarz', zebrastreifen_schild: 'blau-quadrat' },
  'hungary': { fahrseite: R, ortsschild_hintergrund: 'weiß', ortsschild_rand: 'rot', zebrastreifen_schild: 'blau-quadrat' },
  'lithuania': { fahrseite: R, ortsschild_hintergrund: 'gemischt', ortsschild_rand: 'gemischt', zebrastreifen_schild: 'blau-quadrat' },
  'latvia': { fahrseite: R, ortsschild_hintergrund: 'gemischt', ortsschild_rand: 'gemischt', zebrastreifen_schild: 'blau-quadrat' },
  'estonia': { fahrseite: R, ortsschild_hintergrund: 'weiß', ortsschild_rand: 'schwarz', zebrastreifen_schild: 'blau-quadrat' },
  'croatia': { fahrseite: R, ortsschild_hintergrund: 'gelb', ortsschild_rand: 'schwarz' },
  'bosnia-and-herzegovina': { fahrseite: R, schrift: 'latein+kyrillisch', ortsschild_hintergrund: 'gelb', ortsschild_rand: 'schwarz', zebrastreifen_schild: 'blau-quadrat' },
  'serbia': { fahrseite: R, ortsschild_hintergrund: 'blau', ortsschild_rand: 'weiß', zebrastreifen_schild: 'blau-quadrat' },
  'montenegro': { fahrseite: R },
  'north-macedonia': { fahrseite: R, ortsschild_hintergrund: 'gelb', ortsschild_rand: 'schwarz', zebrastreifen_schild: 'blau-quadrat' },
  'albania': { fahrseite: R },
  'romania': { fahrseite: R, zebrastreifen_schild: 'blau-quadrat' },
  'bulgaria': { fahrseite: R, ortsschild_hintergrund: 'weiß', ortsschild_rand: 'schwarz', zebrastreifen_schild: 'blau-quadrat' },
  'greece': { fahrseite: R, zebrastreifen_schild: 'blau-quadrat' },
  'cyprus': { fahrseite: 'links' },
  'turkey': { fahrseite: R, ortsschild_hintergrund: 'blau', ortsschild_rand: 'weiß', zebrastreifen_schild: 'blau-quadrat' },
  'russia': { fahrseite: R, ortsschild_hintergrund: 'weiß', ortsschild_rand: 'schwarz' },
  'ukraine': { fahrseite: R, ortsschild_hintergrund: 'weiß', ortsschild_rand: 'schwarz', zebrastreifen_schild: 'blau-quadrat' },
  'belarus': { fahrseite: R, schrift: 'kyrillisch', ortsschild_hintergrund: 'weiß', ortsschild_rand: 'schwarz' },
}

/**
 * Straßennummern-Schilder (eigene Grafiken): [Land, Straßenart, Text, Hintergrund, Schrift, Form]
 * Form: 'rect' Rechteck · 'round' abgerundet mit Innenrand · 'shield' Wappenform · 'hex' Sechseck
 */
const BLAU = '#1f4fa8', GRUEN = '#1d7a4a', ROT = '#c8102e', GELB = '#f6c600', WEISS = '#ffffff', SCHWARZ = '#111111', ORANGE = '#ea6b1c', BRAUN = '#6b4a2b'
export const STRASSEN = [
  ['germany', 'Autobahn', 'A 2', BLAU, WEISS, 'round'],
  ['germany', 'Bundesstraße', 'B 27', GELB, SCHWARZ, 'rect'],
  ['austria', 'Bundesstraße', 'B 38', BLAU, WEISS, 'rect'],
  ['switzerland', 'Autobahn', '1', ROT, WEISS, 'rect'],
  ['switzerland', 'Hauptstraße', '16', BLAU, WEISS, 'rect'],
  ['france', 'Autobahn', 'A 12', ROT, WEISS, 'rect'],
  ['france', 'Nationalstraße', 'N 141', ROT, WEISS, 'rect'],
  ['france', 'Departementstraße', 'D 105', GELB, SCHWARZ, 'rect'],
  ['spain', 'Autobahn', 'A-42', BLAU, WEISS, 'rect'],
  ['spain', 'Mautautobahn', 'AP-7', BLAU, WEISS, 'rect'],
  ['spain', 'Nationalstraße', 'N-634', ROT, WEISS, 'rect'],
  ['portugal', 'Autobahn', 'A1', BLAU, WEISS, 'rect'],
  ['portugal', 'Hauptroute', 'IP 3', ROT, WEISS, 'rect'],
  ['italy', 'Autobahn', 'A24', GRUEN, WEISS, 'round'],
  ['italy', 'Staatsstraße', 'SS 10', BLAU, WEISS, 'rect'],
  ['united-kingdom', 'Autobahn', 'M62', BLAU, WEISS, 'rect'],
  ['united-kingdom', 'Hauptstraße', 'A614', GRUEN, GELB, 'rect'],
  ['united-kingdom', 'Nebenstraße', 'B6295', WEISS, SCHWARZ, 'rect'],
  ['ireland', 'Autobahn', 'M17', BLAU, WEISS, 'rect'],
  ['ireland', 'Nationalstraße', 'N71', GRUEN, GELB, 'rect'],
  ['ireland', 'Regionalstraße', 'R195', WEISS, SCHWARZ, 'rect'],
  ['belgium', 'Autobahn', 'A12', WEISS, SCHWARZ, 'rect'],
  ['belgium', 'Nationalstraße', 'N277', BLAU, WEISS, 'round'],
  ['netherlands', 'Autobahn', 'A2', ROT, WEISS, 'rect'],
  ['netherlands', 'Provinzstraße', 'N283', GELB, SCHWARZ, 'rect'],
  ['luxembourg', 'Autobahn', 'A6', BLAU, WEISS, 'rect'],
  ['luxembourg', 'Nationalstraße', '12', '#8b1a2b', WEISS, 'rect'],
  ['luxembourg', 'Lokale Straße', '306', GELB, SCHWARZ, 'rect'],
  ['norway', 'Europastraße', 'E6', GRUEN, WEISS, 'rect'],
  ['norway', 'Reichsstraße', '35', GRUEN, WEISS, 'rect'],
  ['norway', 'Provinzstraße', '51', WEISS, SCHWARZ, 'rect'],
  ['sweden', 'Nationalstraße', '66', BLAU, WEISS, 'rect'],
  ['finland', 'Hauptstraße 1. Klasse', '4', ROT, WEISS, 'rect'],
  ['finland', 'Hauptstraße 2. Klasse', '45', GELB, SCHWARZ, 'rect'],
  ['denmark', 'Hauptstraße', '18', GELB, SCHWARZ, 'rect'],
  ['poland', 'Autobahn', 'A18', ROT, WEISS, 'rect'],
  ['poland', 'Schnellstraße', 'S14', ROT, WEISS, 'rect'],
  ['poland', 'Landesstraße', '7', ROT, WEISS, 'rect'],
  ['poland', 'Woiwodschaftsstraße', '694', GELB, SCHWARZ, 'rect'],
  ['czechia', 'Autobahn', 'D1', ROT, WEISS, 'rect'],
  ['czechia', 'Straße 1. Klasse', '38', BLAU, WEISS, 'rect'],
  ['slovakia', 'Schnellstraße', 'R2', ROT, WEISS, 'rect'],
  ['slovakia', 'Straße 1. Klasse', '21', BLAU, WEISS, 'rect'],
  ['hungary', 'Autobahn', 'M5', BLAU, WEISS, 'shield'],
  ['hungary', 'Hauptstraße', '6', GRUEN, WEISS, 'shield'],
  ['slovenia', 'Autobahn', 'A1', GRUEN, WEISS, 'round'],
  ['slovenia', 'Schnellstraße', 'H3', BLAU, WEISS, 'round'],
  ['lithuania', 'Fernstraße', 'A2', ROT, WEISS, 'rect'],
  ['lithuania', 'Regionalstraße', '105', GELB, SCHWARZ, 'rect'],
  ['estonia', 'Hauptstraße', '11', ROT, WEISS, 'rect'],
  ['romania', 'Autobahn', 'A2', GRUEN, WEISS, 'rect'],
  ['romania', 'Nationalstraße', '6', ROT, WEISS, 'shield'],
  ['romania', 'Kreisstraße', '711', BLAU, WEISS, 'shield'],
  ['bulgaria', 'Autobahn', 'A4', GRUEN, WEISS, 'rect'],
  ['bulgaria', 'Straße 1. Klasse', '63', BLAU, WEISS, 'rect'],
  ['turkey', 'Autobahn', 'O-4', ORANGE, WEISS, 'rect'],
  ['turkey', 'Staatsstraße', 'D.750', BLAU, WEISS, 'rect'],
  ['russia', 'Fernstraße', 'M3', BLAU, WEISS, 'round'],
  ['russia', 'Regionale Fernstraße', 'P258', BLAU, WEISS, 'rect'],
  ['ukraine', 'Fernstraße', 'M-05', BLAU, WEISS, 'rect'],
  ['ukraine', 'Regionalstraße', 'P-20', BLAU, WEISS, 'rect'],
  ['montenegro', 'Hauptstraße', 'M-4', BLAU, WEISS, 'rect'],
  ['montenegro', 'Regionalstraße', 'R-15', GELB, SCHWARZ, 'rect'],
]
export const STRASSEN_FARBEN = { BLAU, GRUEN, ROT, GELB, WEISS, SCHWARZ, ORANGE, BRAUN }

/* ───────────── Kennzeichen-Codes (Wikidata P395) ───────────── */

/** Russland: Name wie in public/geo/items/europa.json (ru-subjekte) → Codes */
export const RU_CODES = [
  ['Moskau', '77,97,99,177,197,199,777,799'], ['Oblast Moskau', '50,90,150,190,750'], ['Tuwa', '17'], ['Sankt Petersburg', '78,98,178,198,778'],
  ['Oblast Samara', '63,163,763'], ['Oblast Kaliningrad', '39,91'], ['Oblast Murmansk', '51'], ['Oblast Archangelsk', '29'], ['Karelien', '10'],
  ['Oblast Wologda', '35'], ['Komi', '11'], ['Nenzen (Autonomer Kreis)', '83'], ['Oblast Leningrad', '47'], ['Oblast Pskow', '60'],
  ['Oblast Nowgorod', '53'], ['Oblast Nischni Nowgorod', '52,152'], ['Oblast Smolensk', '67'], ['Oblast Twer', '69'], ['Oblast Jaroslawl', '76'],
  ['Oblast Kostroma', '44'], ['Oblast Wladimir', '33'], ['Oblast Iwanowo', '37'], ['Oblast Rjasan', '62'], ['Oblast Tula', '71'],
  ['Oblast Brjansk', '32'], ['Oblast Orjol', '57'], ['Oblast Kaluga', '40'], ['Oblast Kursk', '46'], ['Oblast Tambow', '68'],
  ['Oblast Lipezk', '48'], ['Oblast Belgorod', '31'], ['Oblast Rostow', '61,161'], ['Adygeja', '01'], ['Oblast Wolgograd', '34,134'],
  ['Oblast Astrachan', '30'], ['Oblast Woronesch', '36,136'], ['Kalmückien', '08'], ['Region Krasnodar', '23,93,123,193,323'],
  ['Region Primorje', '25,125'], ['Tschetschenien', '20,95'], ['Inguschetien', '06'], ['Nordossetien-Alanien', '15'], ['Oblast Saratow', '64,164'],
  ['Karatschai-Tscherkessien', '09'], ['Mordwinien', '13,113'], ['Dagestan', '05'], ['Region Stawropol', '26,126'], ['Kabardino-Balkarien', '07'],
  ['Oblast Kirow', '43'], ['Mari El', '12'], ['Udmurtien', '18'], ['Region Perm', '59,159'], ['Oblast Orenburg', '56'], ['Oblast Swerdlowsk', '66,96,196'],
  ['Tschuwaschien', '21,121'], ['Tatarstan', '16,116'], ['Oblast Pensa', '58'], ['Baschkortostan', '02,102'], ['Oblast Tjumen', '72'],
  ['Oblast Uljanowsk', '73,173'], ['Oblast Omsk', '55'], ['Oblast Nowosibirsk', '54,154'], ['Oblast Tomsk', '70'], ['Oblast Tscheljabinsk', '74,174'],
  ['Oblast Kurgan', '45'], ['Republik Altai', '04'], ['Region Altai', '22'], ['Chanten und Mansen (Autonomer Kreis)', '86,186'], ['Oblast Kemerowo', '42,142'],
  ['Jamal-Nenzen (Autonomer Kreis)', '89'], ['Chakassien', '19'], ['Region Krasnojarsk', '24,124'], ['Oblast Irkutsk', '38,138'], ['Sacha (Jakutien)', '14'],
  ['Burjatien', '03'], ['Region Transbaikalien', '75'], ['Jüdische Autonome Oblast', '79'], ['Region Chabarowsk', '27'], ['Oblast Amur', '28'],
  ['Oblast Sachalin', '65'], ['Oblast Magadan', '49'], ['Region Kamtschatka', '41'], ['Tschuktschen (Autonomer Kreis)', '87'],
]

/** Polen: Name wie in europa.json (pl-woiwodschaften) → Anfangsbuchstabe */
export const PL_CODES = [
  ['Kujawien-Pommern', 'C'], ['Łódź', 'E'], ['Kleinpolen', 'K'], ['Niederschlesien', 'D'], ['Lebus', 'F'], ['Lublin', 'L'], ['Oppeln', 'O'],
  ['Pommern', 'G'], ['Masowien', 'W'], ['Heiligkreuz', 'T'], ['Ermland-Masuren', 'N'], ['Karpatenvorland', 'R'], ['Podlachien', 'B'],
  ['Schlesien', 'S'], ['Westpommern', 'Z'], ['Großpolen', 'P'],
]

/** Ukraine: ISO-Code der Oblast (ua-oblaste) → Buchstabenpaare (erst die von 2004, dann die neueren) */
export const UA_CODES = {
  'ua-30': 'AA,KA', 'ua-18': 'AM,KM', 'ua-71': 'CA', 'ua-40': 'CH', 'ua-65': 'BT', 'ua-46': 'BC', 'ua-74': 'CB', 'ua-07': 'AC,KC',
  'ua-05': 'AB', 'ua-53': 'BI,HI', 'ua-32': 'AI,KI', 'ua-77': 'CE', 'ua-21': 'AO,KO', 'ua-12': 'AE', 'ua-59': 'BM', 'ua-68': 'BX,HX',
  'ua-63': 'AX', 'ua-09': 'BB,HB', 'ua-23': 'AP', 'ua-51': 'BH', 'ua-26': 'AT,KT', 'ua-61': 'BO', 'ua-56': 'BK', 'ua-35': 'BA',
  'ua-48': 'BE', 'ua-14': 'AH,KH',
}
