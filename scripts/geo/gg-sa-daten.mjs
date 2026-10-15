// Handgepflegte Daten für „GeoGuessr Südamerika“. Wird von scripts/geo/build-gg-sa.mjs gelesen.
//
// Quellen:
//  - Hinweise je Land (scripts/geo/gg-sa/<slug>.json): Fakten aus dem Plonk-It-Guide (plonkit.net, Lizenz CC BY-NC-SA 4.0) – auf Deutsch neu formuliert.
//  - Taxi-Farben Argentinien: Plonk-It-Grafik „Argentina Taxi Map“.
//  - Straßenbuchstaben Chile: es.wikipedia.org „Rutas regionales de Chile“ (Tabelle „Letra de rol por región“, CC BY-SA 4.0).
//  - Ländervorwahlen und Länderdomains: ITU-Ländervorwahlen und IANA-Root-Zone (allgemein bekannt).
//  - Fotos von Pflanzen: Wikimedia Commons (Liste mit Lizenz und Urheber: scripts/geo/gg-sa-pflanzen.json).

/** slug → [Name, ISO3 der Welt-Ebene, Flaggen-Schlüssel, Gruppe] */
export const LAENDER = {
  'argentina': ['Argentinien', 'ARG', 'ar', 'cono'],
  'chile': ['Chile', 'CHL', 'cl', 'cono'],
  'uruguay': ['Uruguay', 'URY', 'uy', 'cono'],
  'falkland-islands': ['Falklandinseln', 'FLK', 'fk', 'cono'],
  'brazil': ['Brasilien', 'BRA', 'br', 'brasilien'],
  'colombia': ['Kolumbien', 'COL', 'co', 'anden'],
  'ecuador': ['Ecuador', 'ECU', 'ec', 'anden'],
  'peru': ['Peru', 'PER', 'pe', 'anden'],
  'bolivia': ['Bolivien', 'BOL', 'bo', 'anden'],
}

export const GRUPPEN = {
  cono: 'Cono Sur: Argentinien, Chile, Uruguay',
  brasilien: 'Brasilien',
  anden: 'Andenländer: Kolumbien, Ecuador, Peru, Bolivien',
}

/** Kategorien der Hinweise (Reihenfolge = Reihenfolge im Steckbrief) */
export const KATEGORIEN = {
  'fahrseite': 'Fahrseite',
  'kennzeichen': 'Kennzeichen',
  'autos': 'Autos, Taxis & Mototaxis',
  'poller': 'Poller & Kilometersteine',
  'strassennummern': 'Straßennummern',
  'linien': 'Fahrbahnlinien',
  'verkehrsschilder': 'Schilder, Chevrons & Leitplanken',
  'wegweiser': 'Wegweiser',
  'ortsschild': 'Ortsschilder',
  'strommasten': 'Strommasten & Laternen',
  'zaeune': 'Zäune, Mauern & Tore',
  'sprache': 'Sprache',
  'werbung': 'Werbung & Wandmalereien',
  'google-auto': 'Google-Auto',
  'kamera': 'Kamera',
  'strassen': 'Straßen',
  'gebaeude': 'Gebäude',
  'klima': 'Klima',
  'landschaft': 'Landschaft',
  'pflanzen': 'Bäume, Palmen & Blumen',
  'abdeckung': 'Abdeckung',
  'telefon-domain': 'Vorwahl & Domain',
  'sonstiges': 'Sonstiges',
}

/** Merkmale für Vergleich und Ausschluss-Training: Schlüssel → [Name, mögliche Werte] */
export const MERKMALE = {
  fahrseite: ['Fahrseite', ['rechts', 'links']],
  sprache: ['Sprache', ['spanisch', 'portugiesisch', 'englisch']],
  kennzeichen: ['Kennzeichen', ['mercosur', 'weiß', 'gelb', 'gemischt']],
  mittellinie: ['Mittellinie', ['gelb', 'weiß', 'gemischt']],
  chevron: ['Chevron (Kurvenschild)', ['gelb-schwarz', 'schwarz-gelb', 'weiß-rot']],
  google_auto: ['Google-Auto (Gen 3)', ['schwarz', 'weiß', 'gemischt']],
}
export const TRAIN_KEYS = ['sprache', 'kennzeichen', 'mittellinie', 'chevron', 'google_auto']
export const WERT_NAMEN = {
  'spanisch': 'Spanisch', 'portugiesisch': 'Portugiesisch', 'englisch': 'Englisch',
  'mercosur': 'Mercosur (weiß, blauer Balken oben)',
  'gelb-schwarz': 'gelb mit schwarzem Pfeil', 'schwarz-gelb': 'schwarz mit gelbem Pfeil', 'weiß-rot': 'weiß mit rotem Pfeil',
}

/**
 * Merkmale je Land – aus den Hinweisen (Plonk It) zusammengefasst.
 * Chevron „gelb-schwarz“ für Kolumbien, Ecuador, Peru und Bolivien: Plonk It (Uruguay-Seite): „Wie in den meisten Ländern Lateinamerikas sind die Chevrons gelb mit schwarzen Pfeilen.“
 */
export const MERKMAL = {
  'argentina': { fahrseite: 'rechts', sprache: 'spanisch', kennzeichen: 'gemischt', mittellinie: 'gemischt', chevron: 'weiß-rot', google_auto: 'schwarz' },
  'chile': { fahrseite: 'rechts', sprache: 'spanisch', kennzeichen: 'weiß', mittellinie: 'weiß', chevron: 'gelb-schwarz', google_auto: 'weiß' },
  'uruguay': { fahrseite: 'rechts', sprache: 'spanisch', kennzeichen: 'mercosur', mittellinie: 'gemischt', chevron: 'gelb-schwarz', google_auto: 'schwarz' },
  'falkland-islands': { fahrseite: 'links', sprache: 'englisch' },
  'brazil': { fahrseite: 'rechts', sprache: 'portugiesisch', kennzeichen: 'mercosur', mittellinie: 'gelb', chevron: 'schwarz-gelb', google_auto: 'weiß' },
  'colombia': { fahrseite: 'rechts', sprache: 'spanisch', kennzeichen: 'gelb', mittellinie: 'gelb', chevron: 'gelb-schwarz', google_auto: 'gemischt' },
  'ecuador': { fahrseite: 'rechts', sprache: 'spanisch', kennzeichen: 'weiß', chevron: 'gelb-schwarz', google_auto: 'weiß' },
  'peru': { fahrseite: 'rechts', sprache: 'spanisch', kennzeichen: 'weiß', mittellinie: 'gelb', chevron: 'gelb-schwarz', google_auto: 'gemischt' },
  'bolivia': { fahrseite: 'rechts', sprache: 'spanisch', kennzeichen: 'weiß', mittellinie: 'gemischt', chevron: 'gelb-schwarz', google_auto: 'weiß' },
}

/** Vorwahl und Domain (ITU / IANA) – auch Länder ohne Steckbrief, für die Lernkarten */
export const CODES = [
  ['Argentinien', 'ar', '+54', '.ar'], ['Bolivien', 'bo', '+591', '.bo'], ['Brasilien', 'br', '+55', '.br'], ['Chile', 'cl', '+56', '.cl'],
  ['Kolumbien', 'co', '+57', '.co'], ['Ecuador', 'ec', '+593', '.ec'], ['Peru', 'pe', '+51', '.pe'], ['Uruguay', 'uy', '+598', '.uy'],
  ['Paraguay', 'py', '+595', '.py'], ['Venezuela', 've', '+58', '.ve'], ['Guyana', 'gy', '+592', '.gy'], ['Suriname', 'sr', '+597', '.sr'],
  ['Falklandinseln', 'fk', '+500', '.fk'], ['Französisch-Guayana', 'gf', '+594', '.gf'],
]

/**
 * Argentinien: Taxi-Farben je Stadt (Plonk It, „Argentina Taxi Map“)
 * [Stadt, Provinz, Länge, Breite, Beschreibung, Gruppe, Zeichnung (siehe gg-sa-zeichnungen.mjs TAXI)]
 */
export const AR_TAXIS = [
  ['San Salvador de Jujuy', 'Jujuy', -65.30, -24.19, 'schwarz', 'schwarz', { body: '#1e1e1e' }],
  ['Salta', 'Salta', -65.41, -24.79, 'rot', 'rot', { body: '#c8202a' }],
  ['San Miguel de Tucumán', 'Tucumán', -65.22, -26.82, 'weiß mit gelbem, kariertem Streifen', 'weiss', { body: '#f2f2ee', stripe: '#f2c230', checker: true }],
  ['Resistencia', 'Chaco', -58.98, -27.45, 'weiß mit rot-grünem Streifen', 'weiss', { body: '#f2f2ee', stripe: '#c8202a', stripe2: '#1f8a4c' }],
  ['Santiago del Estero', 'Santiago del Estero', -64.26, -27.78, 'weiß und grün', 'weiss', { body: '#f2f2ee', lower: '#1f8a4c' }],
  ['Córdoba', 'Córdoba', -64.18, -31.42, 'grün – oder gelb mit schwarzem Streifen', 'gruen', { body: '#2f9b5f' }],
  ['San Juan', 'San Juan', -68.54, -31.54, 'weiß mit gelbem Dach', 'weiss', { body: '#f2f2ee', roof: '#f2c230' }],
  ['Mendoza', 'Mendoza', -68.84, -32.89, 'schwarz mit gelbem Dach', 'schwarz', { body: '#1e1e1e', roof: '#f2c230' }],
  ['Rosario', 'Santa Fe', -60.64, -32.95, 'schwarz mit gelbem Dach', 'schwarz', { body: '#1e1e1e', roof: '#f2c230' }],
  ['Buenos Aires', 'Buenos Aires', -58.38, -34.60, 'schwarz mit gelbem Dach', 'schwarz', { body: '#1e1e1e', roof: '#f2c230' }],
  ['La Plata', 'Buenos Aires', -57.95, -34.92, 'weiß und grün', 'weiss', { body: '#f2f2ee', lower: '#1f8a4c' }],
  ['San Luis', 'San Luis', -66.34, -33.30, 'weiß mit blauem Streifen', 'weiss', { body: '#f2f2ee', stripe: '#2459c2' }],
  ['Neuquén', 'Neuquén', -68.06, -38.95, 'gelb', 'gelb', { body: '#f2c230' }],
  ['San Carlos de Bariloche', 'Río Negro', -71.31, -41.13, 'weiß mit blau', 'weiss', { body: '#f2f2ee', lower: '#2459c2' }],
  ['Comodoro Rivadavia', 'Chubut', -67.48, -45.86, 'weiß', 'weiss', { body: '#f2f2ee' }],
]
/** Zweite Variante in Córdoba */
export const AR_TAXI_EXTRA = [['Córdoba', { body: '#f2c230', stripe: '#1e1e1e' }, 'gelb mit schwarzem Streifen']]

/**
 * Chile: Buchstabe der Regionalstraßen je Region (es.wikipedia „Rutas regionales de Chile“).
 * Schlüssel wie in scripts/geo/sa-daten.mjs (cl-regionen) → [Buchstaben, Provinzen]
 */
export const CL_STRASSEN = {
  'CL-AP': ['A', ''], 'CL-TA': ['A', ''], 'CL-AN': ['B', ''], 'CL-AT': ['C', ''], 'CL-CO': ['D', ''],
  'CL-VS': ['E · F · G', 'E Petorca, Los Andes, San Felipe · F Quillota, Marga Marga, Valparaíso · G San Antonio'],
  'CL-RM': ['G', ''], 'CL-LI': ['H · I', 'H Cachapoal · I Cardenal Caro, Colchagua'],
  'CL-ML': ['J · K · L · M', 'J Curicó · K Talca · L Linares · M Cauquenes'], 'CL-NB': ['N', ''],
  'CL-BI': ['O · P · Q', 'O Concepción · P Arauco · Q Biobío'], 'CL-AR': ['R · S', 'R Malleco · S Cautín'], 'CL-LR': ['T', ''],
  'CL-LL': ['U · V · W', 'U Osorno · V Llanquihue · W Chiloé, Palena'], 'CL-AI': ['X', ''], 'CL-MA': ['Y', ''],
}

/**
 * Pflanzen mit Foto (public/geo/gg-sa/pflanzen/<key>.jpg):
 * key → [Name, wissenschaftlicher Name, Länder (slugs), Wo (Region), Erkennen]
 * Wo und Erkennen aus den Hinweisen (Plonk It).
 */
export const PFLANZEN = {
  'araukarie': ['Chilenische Araukarie (Andentanne)', 'Araucaria araucana', ['chile', 'argentina'], 'Osten von Araucanía (Chile), Westen von Neuquén (Argentinien)', 'Äste wie Arme, Schuppen statt Nadeln – „Monkey Puzzle“'],
  'parana-kiefer': ['Paraná-Kiefer', 'Araucaria angustifolia', ['brazil'], 'Süden: Paraná, Santa Catarina, Rio Grande do Sul', 'lange waagrechte Äste, Nadeln nur an den Enden – Krone wie ein Schirm'],
  'monterey-kiefer': ['Monterey-Kiefer', 'Pinus radiata', ['chile', 'peru'], 'Biobío (Chile), Hochland-Plantagen (Peru)', 'buschige, „puffige“ Nadeln'],
  'eukalyptus': ['Eukalyptus-Plantage', 'Eucalyptus grandis', ['brazil', 'uruguay', 'chile', 'argentina'], 'überall in Brasilien, Uruguay, Entre Ríos, Südwest-Valparaíso', 'sehr hohe, gerade Stämme in Reihen'],
  'riesenrhabarber': ['Chilenischer Riesenrhabarber (Nalca)', 'Gunnera tinctoria', ['chile'], 'Isla Grande de Chiloé und Festland östlich davon', 'riesige Blätter wie ein Kohlkopf'],
  'lupine': ['Vielblättrige Lupine', 'Lupinus polyphyllus', ['chile'], 'entlang der Ruta 240 (Aysén)', 'lila Blütenkerzen am Straßenrand'],
  'tamarugo': ['Tamarugo', 'Prosopis tamarugo', ['chile'], 'Pampa del Tamarugal (Tarapacá)', 'Bäume säumen die Straße mitten in der Wüste'],
  'caranday-wachspalme': ['Caranday-Wachspalme', 'Copernicia alba', ['argentina'], 'Formosa, Chaco, Corrientes, Nord-Santa Fe', 'kurze Fächerblätter, lockere Wälder nur aus dieser Palme'],
  'caranday-palme': ['Caranday-Palme', 'Trithrinax campestris', ['argentina'], 'Sierras de Córdoba, San Luis', 'Mantel aus toten Blättern am Stamm'],
  'butia-yatay': ['Yatay-Palme', 'Butia yatay', ['argentina'], 'Corrientes, Parque Nacional El Palmar (Entre Ríos)', 'gebogene Fiederblätter, wächst oft schräg'],
  'totai': ['Totai-Palme', 'Acrocomia totai', ['argentina'], 'wild im Norden, als Zierpalme überall', 'kleine, dünne Blätter, glatter Stamm, speerförmige Spitze'],
  'cardon': ['Cardón-Kaktus', 'Echinopsis atacamensis', ['argentina'], 'hohe Berge von Catamarca, Tucumán, Salta, Jujuy', 'wie ein Kerzenleuchter'],
  'zahnstocher-kaktus': ['Zahnstocher-Kaktus', 'Stetsonia coryne', ['argentina'], 'zwischen Catamarca und Córdoba, Grenze Chaco–Salta–Formosa', 'groß, baumartig, viele Äste, lange Stacheln'],
  'wilde-sonnenblume': ['Wilde Sonnenblume', 'Tithonia tubaeformis', ['argentina'], 'Salta, Jujuy, Tucumán', 'gelbe Blüten am Straßenrand'],
  'calden': ['Caldén', 'Prosopis caldenia', ['argentina'], 'La Pampa', 'großer Baum mit kleinen Blättern und gewundenen Ästen'],
  'pampasgras': ['Pampasgras', 'Cortaderia selloana', ['argentina'], 'Pampa', 'lange Halme, weiße flauschige Blütenstände'],
  'lenga': ['Lenga-Buchenwald', 'Nothofagus pumilio', ['argentina'], 'Feuerland', 'Buchenwälder, oft mit hellen Stämmen'],
  'pappel': ['Pappelreihen', 'Populus', ['argentina'], 'rund um Neuquén', 'dünne, hohe Bäume in einzelnen Reihen'],
  'kokospalme': ['Kokospalme', 'Cocos nucifera', ['brazil', 'peru'], 'Nordosten Brasiliens, Küste nördlich von Lima', 'sehr hoch, dünner Stamm, lange Blätter'],
  'carnauba': ['Carnaúba-Palme', 'Copernicia prunifera', ['brazil'], 'Ceará, Piauí, Rio Grande do Norte', 'kurze kräftige Fächerblätter, Stamm unten stachelig'],
  'babassu': ['Babassu-Palme', 'Attalea speciosa', ['brazil'], 'ganzes Amazonasgebiet', 'lange kräftige Blätter aus vielen Fiederblättchen'],
  'acai': ['Açaí-Palme', 'Euterpe oleracea', ['brazil'], 'vor allem bei Belém, Amazonasgebiet', 'herabhängende Fiederblättchen, sehr dünne Stämme'],
  'moriche': ['Moriche-Palme', 'Mauritia flexuosa', ['brazil'], 'Roraima, Amazonas, Tocantins, Goiás', 'runde Fächerblätter, die unteren hängen abgestorben herab'],
  'macauba': ['Macaúba-Palme', 'Acrocomia aculeata', ['brazil'], 'Mato Grosso do Sul, Nord-Tocantins, um Belo Horizonte', 'dünnere Blätter, speerförmige Spitze'],
  'koenigspalme': ['Königspalme', 'Roystonea regia', ['brazil'], 'Zierpalme in Städten', 'glatter, grauer Stamm – weniger Blätter als die Macaúba'],
  'zuckerrohr': ['Zuckerrohr', 'Saccharum officinarum', ['brazil', 'argentina', 'colombia', 'peru'], 'São Paulo, Tucumán, Valle del Cauca, Nordküste Perus', 'hohe Halme in dichten Feldern'],
  'kaffee': ['Kaffee-Plantage', 'Coffea arabica', ['brazil'], 'vor allem Minas Gerais', 'Reihen dunkelgrüner Büsche an Hängen'],
  'banane': ['Bananen-Plantage', 'Musa', ['ecuador', 'peru'], 'Südwesten Ecuadors, Nordküste Perus', 'große, zerfranste Blätter'],
  'soja': ['Sojafeld', 'Glycine max', ['brazil'], 'Mato Grosso, Paraná, Goiás', 'kleine blättrige Pflanzen in Erdreihen'],
}
