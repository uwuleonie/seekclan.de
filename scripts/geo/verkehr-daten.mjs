// Daten für scripts/geo/build-europa.mjs – Flughäfen, Häfen, Bahnhöfe, Stadtteile, Postleitzahlen, Straßen und Bahn.

/* ═════════════ Flughäfen (OurAirports) ═════════════ */

const EUROPA_CC = ['AL', 'AD', 'AT', 'BE', 'BA', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IS', 'IE', 'IT', 'XK', 'LV', 'LI', 'LT', 'LU', 'MT', 'MD', 'MC', 'ME', 'NL', 'MK', 'NO', 'PL', 'PT', 'RO', 'SM', 'RS', 'SK', 'SI', 'ES', 'SE', 'CH', 'UA', 'GB', 'BY']

export const FLUGHAFEN_QUIZZES = {
  'de-flughaefen': { cc: ['DE'] },
  'uk-flughaefen': { cc: ['GB'] },
  'fr-flughaefen': { cc: ['FR'] },
  'it-flughaefen': { cc: ['IT'] },
  'es-flughaefen': { cc: ['ES'] },
  'gr-flughaefen': { cc: ['GR'] },
  'ru-flughaefen': { cc: ['RU'], large: true },
  'europa-flughaefen': { cc: EUROPA_CC, large: true },
}

/** Englische Ortsnamen in Flughafen-Namen → deutsch */
export const FLUGHAFEN_DE = {
  Munich: 'München', Cologne: 'Köln', Nuremberg: 'Nürnberg', Hanover: 'Hannover', Moscow: 'Moskau', 'Saint Petersburg': 'Sankt Petersburg', 'St Petersburg': 'Sankt Petersburg',
  Rome: 'Rom', Milan: 'Mailand', Venice: 'Venedig', Naples: 'Neapel', Florence: 'Florenz', Genoa: 'Genua', Athens: 'Athen', Lisbon: 'Lissabon', Brussels: 'Brüssel', Vienna: 'Wien',
  Zurich: 'Zürich', Geneva: 'Genf', Prague: 'Prag', Warsaw: 'Warschau', Copenhagen: 'Kopenhagen', Seville: 'Sevilla', Corfu: 'Korfu', Rhodes: 'Rhodos', Bucharest: 'Bukarest',
  Belgrade: 'Belgrad', Kyiv: 'Kyjiw', Kiev: 'Kyjiw', Cracow: 'Krakau', Krakow: 'Krakau', Wroclaw: 'Breslau', Gdansk: 'Danzig', Gothenburg: 'Göteborg', Nice: 'Nizza', Lyon: 'Lyon',
  Marseille: 'Marseille', Strasbourg: 'Straßburg', Majorca: 'Mallorca', Tenerife: 'Teneriffa', Corsica: 'Korsika', Sardinia: 'Sardinien', Sicily: 'Sizilien', Crete: 'Kreta',
}

/** Feste deutsche Namen für bekannte Flughäfen (IATA → Name) */
export const FLUGHAFEN_NAME = {
  FRA: 'Frankfurt am Main', MUC: 'München', BER: 'Berlin Brandenburg', DUS: 'Düsseldorf', HAM: 'Hamburg', CGN: 'Köln/Bonn', STR: 'Stuttgart', HAJ: 'Hannover', NUE: 'Nürnberg',
  LEJ: 'Leipzig/Halle', DRS: 'Dresden', BRE: 'Bremen', DTM: 'Dortmund', FMO: 'Münster/Osnabrück', PAD: 'Paderborn/Lippstadt', NRN: 'Weeze (Niederrhein)', HHN: 'Frankfurt-Hahn',
  FKB: 'Karlsruhe/Baden-Baden', FDH: 'Friedrichshafen', FMM: 'Memmingen', SCN: 'Saarbrücken', ERF: 'Erfurt-Weimar', RLG: 'Rostock-Laage', HDF: 'Heringsdorf', GWT: 'Sylt', LBC: 'Lübeck', KSF: 'Kassel',
  LHR: 'London Heathrow', LGW: 'London Gatwick', STN: 'London Stansted', LTN: 'London Luton', LCY: 'London City', SEN: 'London Southend',
  CDG: 'Paris-Charles de Gaulle', ORY: 'Paris-Orly', BVA: 'Paris-Beauvais', FCO: 'Rom-Fiumicino', CIA: 'Rom-Ciampino', MXP: 'Mailand-Malpensa', LIN: 'Mailand-Linate', BGY: 'Bergamo',
  MAD: 'Madrid-Barajas', BCN: 'Barcelona-El Prat', PMI: 'Palma de Mallorca', AGP: 'Málaga', ATH: 'Athen', SVO: 'Moskau-Scheremetjewo', DME: 'Moskau-Domodedowo', VKO: 'Moskau-Wnukowo', LED: 'Sankt Petersburg-Pulkowo',
}

/* ═════════════ Häfen ═════════════ */
// [Name, Name in Natural Earth (ne_10m_ports) oder null, Land, Meer, [Länge, Breite] falls nicht in Natural Earth, Hinweis]

export const HAEFEN = [
  ['Rotterdam', 'Rotterdam', 'Niederlande', 'Nordsee', null, 'Größter Hafen Europas.'],
  ['Antwerpen', 'Antwerpen', 'Belgien', 'Nordsee', null, 'Seit 2022 mit Zeebrugge zum Hafen Antwerpen-Brügge zusammengelegt.'],
  ['Hamburg', 'Hamburg', 'Deutschland', 'Nordsee', null, 'Größter Seehafen Deutschlands – liegt rund 100 km von der Nordsee entfernt an der Elbe.'],
  ['Bremerhaven', 'Bremerhaven', 'Deutschland', 'Nordsee', null],
  ['Wilhelmshaven', 'Wilhelmshaven', 'Deutschland', 'Nordsee', null, 'Einziger Tiefwasserhafen Deutschlands (JadeWeserPort).'],
  ['Amsterdam', 'Amsterdam', 'Niederlande', 'Nordsee', null],
  ['Zeebrugge', 'Zeebrugge', 'Belgien', 'Nordsee', null],
  ['Felixstowe', null, 'Vereinigtes Königreich', 'Nordsee', [1.32, 51.955], 'Größter Containerhafen Großbritanniens.'],
  ['London', 'London', 'Vereinigtes Königreich', 'Nordsee', null],
  ['Immingham', null, 'Vereinigtes Königreich', 'Nordsee', [-0.19, 53.63]],
  ['Göteborg', 'Goteborg', 'Schweden', 'Nordsee', null, 'Größter Hafen Skandinaviens.'],
  ['Aarhus', null, 'Dänemark', 'Nordsee', [10.23, 56.15]],
  ['Bergen', 'Bergen', 'Norwegen', 'Nordsee', null],
  ['Oslo', 'Oslo', 'Norwegen', 'Nordsee', null],
  ['Le Havre', 'Le Havre', 'Frankreich', 'Ärmelkanal', null, 'Größter Containerhafen Frankreichs.'],
  ['Southampton', 'Southampton', 'Vereinigtes Königreich', 'Ärmelkanal', null],
  ['Dünkirchen', 'Dunkerque', 'Frankreich', 'Ärmelkanal', null],
  ['Calais', 'Calais', 'Frankreich', 'Ärmelkanal', null],
  ['Dover', 'Dover', 'Vereinigtes Königreich', 'Ärmelkanal', null, 'Wichtigster Fährhafen über den Ärmelkanal.'],
  ['Danzig', 'Gdansk', 'Polen', 'Ostsee', null],
  ['Gdynia', 'Gdynia', 'Polen', 'Ostsee', null],
  ['Stettin', 'Szczecin', 'Polen', 'Ostsee', null],
  ['Rostock', 'Rostock', 'Deutschland', 'Ostsee', null],
  ['Kiel', 'Kiel', 'Deutschland', 'Ostsee', null],
  ['Lübeck-Travemünde', null, 'Deutschland', 'Ostsee', [10.87, 53.96]],
  ['Klaipėda', 'Klaipeda', 'Litauen', 'Ostsee', null],
  ['Riga', 'Riga', 'Lettland', 'Ostsee', null],
  ['Tallinn', 'Tallinn', 'Estland', 'Ostsee', null],
  ['Helsinki', 'Helsinki', 'Finnland', 'Ostsee', null],
  ['Sankt Petersburg', 'Sankt-Peterburg', 'Russland', 'Ostsee', null],
  ['Ust-Luga', null, 'Russland', 'Ostsee', [28.4, 59.68]],
  ['Sines', 'Sines', 'Portugal', 'Atlantik', null],
  ['Lissabon', 'Lisboa', 'Portugal', 'Atlantik', null],
  ['Leixões (Porto)', 'Leixoes', 'Portugal', 'Atlantik', null],
  ['Bilbao', 'Bilbao', 'Spanien', 'Atlantik', null],
  ['Bordeaux', 'Bordeaux', 'Frankreich', 'Atlantik', null],
  ['Nantes-Saint-Nazaire', null, 'Frankreich', 'Atlantik', [-2.2, 47.28]],
  ['Las Palmas', null, 'Spanien', 'Atlantik', [-15.42, 28.14]],
  ['Dublin', 'Dublin', 'Irland', 'Atlantik', null],
  ['Liverpool', 'Liverpool', 'Vereinigtes Königreich', 'Atlantik', null],
  ['Huelva', 'Huelva', 'Spanien', 'Atlantik', null],
  ['Algeciras', 'Algeciras', 'Spanien', 'Mittelmeer', null, 'An der Straße von Gibraltar – einer der größten Containerhäfen am Mittelmeer.'],
  ['Valencia', 'Valencia', 'Spanien', 'Mittelmeer', null],
  ['Barcelona', 'Barcelona', 'Spanien', 'Mittelmeer', null],
  ['Tarragona', 'Tarragona', 'Spanien', 'Mittelmeer', null],
  ['Cartagena', 'Cartagena', 'Spanien', 'Mittelmeer', null],
  ['Marseille', 'Marseille', 'Frankreich', 'Mittelmeer', null, 'Größter Hafen Frankreichs (Marseille-Fos).'],
  ['Genua', null, 'Italien', 'Mittelmeer', [8.91, 44.405]],
  ['La Spezia', 'La Spezia', 'Italien', 'Mittelmeer', null],
  ['Livorno', 'Livorno', 'Italien', 'Mittelmeer', null],
  ['Gioia Tauro', null, 'Italien', 'Mittelmeer', [15.9, 38.45]],
  ['Neapel', null, 'Italien', 'Mittelmeer', [14.27, 40.84]],
  ['Palermo', 'Palermo', 'Italien', 'Mittelmeer', null],
  ['Tarent', 'Taranto', 'Italien', 'Mittelmeer', null],
  ['Triest', 'Trieste', 'Italien', 'Mittelmeer', null],
  ['Venedig', null, 'Italien', 'Mittelmeer', [12.27, 45.44]],
  ['Ravenna', 'Ravenna', 'Italien', 'Mittelmeer', null],
  ['Koper', null, 'Slowenien', 'Mittelmeer', [13.73, 45.55], 'Einziger großer Seehafen Sloweniens.'],
  ['Rijeka', 'Rijeka', 'Kroatien', 'Mittelmeer', null],
  ['Piräus', 'Piraeus', 'Griechenland', 'Mittelmeer', null, 'Hafen von Athen – einer der größten Passagierhäfen Europas.'],
  ['Thessaloniki', 'Thessaloniki', 'Griechenland', 'Mittelmeer', null],
  ['Marsaxlokk', 'Marsaxlokk', 'Malta', 'Mittelmeer', null],
  ['Constanța', null, 'Rumänien', 'Schwarzes Meer', [28.66, 44.17], 'Größter Hafen am Schwarzen Meer.'],
  ['Odessa', 'Odessa', 'Ukraine', 'Schwarzes Meer', null],
  ['Noworossijsk', 'Novorossiysk', 'Russland', 'Schwarzes Meer', null],
  ['Warna', 'Varna', 'Bulgarien', 'Schwarzes Meer', null],
  ['Burgas', 'Burgas', 'Bulgarien', 'Schwarzes Meer', null],
  ['Murmansk', 'Murmansk', 'Russland', 'Nordmeer', null, 'Eisfreier Hafen nördlich des Polarkreises – dank des Golfstroms.'],
  ['Narvik', 'Narvik', 'Norwegen', 'Nordmeer', null],
  ['Duisburg', null, 'Deutschland', 'Binnenhafen', [6.73, 51.45], 'Gilt als größter Binnenhafen Europas – liegt am Rhein, nicht am Meer.'],
]

/* ═════════════ Bahnhöfe ═════════════ */

/** Betriebsbahnhöfe ohne Fahrgäste */
export const BAHNHOF_DROP = ['Etzenricht']

/* ═════════════ Stadtteile ═════════════ */

export const BERLIN_BEZIRKE = ['Mitte', 'Friedrichshain-Kreuzberg', 'Pankow', 'Charlottenburg-Wilmersdorf', 'Spandau', 'Steglitz-Zehlendorf', 'Tempelhof-Schöneberg', 'Neukölln', 'Treptow-Köpenick', 'Marzahn-Hellersdorf', 'Lichtenberg', 'Reinickendorf']

/** Inner London nach dem London Government Act 1963 (ohne Haringey/Newham, die statistisch manchmal dazu zählen) */
export const LONDON_INNER = ['City of London', 'Camden', 'Greenwich', 'Hackney', 'Hammersmith and Fulham', 'Islington', 'Kensington and Chelsea', 'Lambeth', 'Lewisham', 'Southwark', 'Tower Hamlets', 'Wandsworth', 'Westminster']

export const PARIS_ARR = {
  'Louvre': 1, 'Bourse': 2, 'Temple': 3, 'Hôtel-de-Ville': 4, 'Panthéon': 5, 'Luxembourg': 6, 'Palais-Bourbon': 7, 'Élysée': 8, 'Opéra': 9, 'Enclos-St-Laurent': 10,
  'Popincourt': 11, 'Reuilly': 12, 'Gobelins': 13, 'Observatoire': 14, 'Vaugirard': 15, 'Passy': 16, 'Batignolles-Monceau': 17, 'Butte-Montmartre': 18, 'Buttes-Chaumont': 19, 'Ménilmontant': 20,
}

export const FRANKFURT_NAMEN = { 'Sachsenhausen-N.': 'Sachsenhausen-Nord', 'Sachsenhausen-S.': 'Sachsenhausen-Süd' }

const nr = s => +(String(s).match(/\d+/) ?? [0])[0]
const MADRID = ['Centro', 'Arganzuela', 'Retiro', 'Salamanca', 'Chamartín', 'Tetuán', 'Chamberí', 'Fuencarral-El Pardo', 'Moncloa-Aravaca', 'Latina', 'Carabanchel', 'Usera',
  'Puente de Vallecas', 'Moratalaz', 'Ciudad Lineal', 'Hortaleza', 'Villaverde', 'Villa de Vallecas', 'Vicálvaro', 'San Blas-Canillejas', 'Barajas']
const WIEN = ['Innere Stadt', 'Leopoldstadt', 'Landstraße', 'Wieden', 'Margareten', 'Mariahilf', 'Neubau', 'Josefstadt', 'Alsergrund', 'Favoriten', 'Simmering', 'Meidling',
  'Hietzing', 'Penzing', 'Rudolfsheim-Fünfhaus', 'Ottakring', 'Hernals', 'Währing', 'Döbling', 'Brigittenau', 'Floridsdorf', 'Donaustadt', 'Liesing']
const MUENCHEN = ['Altstadt-Lehel', 'Ludwigsvorstadt-Isarvorstadt', 'Maxvorstadt', 'Schwabing-West', 'Au-Haidhausen', 'Sendling', 'Sendling-Westpark', 'Schwanthalerhöhe', 'Neuhausen-Nymphenburg',
  'Moosach', 'Milbertshofen-Am Hart', 'Schwabing-Freimann', 'Bogenhausen', 'Berg am Laim', 'Trudering-Riem', 'Ramersdorf-Perlach', 'Obergiesing-Fasangarten', 'Untergiesing-Harlaching',
  'Thalkirchen-Obersendling-Forstenried-Fürstenried-Solln', 'Hadern', 'Pasing-Obermenzing', 'Aubing-Lochhausen-Langwied', 'Allach-Untermenzing', 'Feldmoching-Hasenbergl', 'Laim']
const HAMBURG = ['Hamburg-Mitte', 'Altona', 'Eimsbüttel', 'Hamburg-Nord', 'Wandsbek', 'Bergedorf', 'Harburg']
const ordinal = n => `${n}. Arrondissement`
const findIn = (list, name) => { const n = name.replace(/\s+-\s+/g, '-').replace(/^Bezirk |^Stadtbezirk |^Distrito /, ''); return list.find(x => n === x) }

/** Bezirke aus OpenStreetMap (Datei unter GEO_SRC/osm/, siehe Kommentar oben in build-europa.mjs) */
export const OSM_BEZIRKE = {
  'lyon-arrondissements': {
    file: 'lyon.json', filter: f => /^Lyon \d/.test(f.properties.name ?? ''), id: p => String(nr(p.name)), name: p => ordinal(nr(p.name)),
    details: p => [{ label: 'Postleitzahl', value: `6900${nr(p.name)}` }], interval: 30,
  },
  'marseille-arrondissements': {
    file: 'marseille.json', filter: f => /^Marseille \d/.test(f.properties.name ?? ''), id: p => String(nr(p.name)), name: p => ordinal(nr(p.name)),
    details: p => [{ label: 'Postleitzahl', value: `130${String(nr(p.name)).padStart(2, '0')}` }], interval: 30,
  },
  'madrid-distritos': {
    file: 'madrid.json', filter: f => !!findIn(MADRID, f.properties.name ?? '') && !/Getafe/.test(f.properties.wikipedia ?? ''), id: p => findIn(MADRID, p.name), name: p => findIn(MADRID, p.name),
    details: p => [{ label: 'Nummer', value: String(MADRID.indexOf(findIn(MADRID, p.name)) + 1).padStart(2, '0') }],
  },
  'wien-bezirke': {
    file: 'wien.json', filter: f => !!findIn(WIEN, f.properties.name ?? ''), id: p => findIn(WIEN, p.name), name: p => findIn(WIEN, p.name),
    details: p => [{ label: 'Bezirk Nr.', value: String(WIEN.indexOf(findIn(WIEN, p.name)) + 1), big: true }],
    text: p => ({ prompt: findIn(WIEN, p.name), sub: 'Welche Bezirksnummer?', answer: String(WIEN.indexOf(findIn(WIEN, p.name)) + 1), big: true }),
  },
  'muenchen-bezirke': {
    file: 'muenchen.json', filter: f => !!findIn(MUENCHEN, f.properties.name ?? ''), id: p => findIn(MUENCHEN, p.name), name: p => findIn(MUENCHEN, p.name),
    details: p => [{ label: 'Stadtbezirk Nr.', value: String(MUENCHEN.indexOf(findIn(MUENCHEN, p.name)) + 1) }],
  },
  'hamburg-bezirke': {
    file: 'hamburg.json', filter: f => !!findIn(HAMBURG, f.properties.name ?? ''), id: p => findIn(HAMBURG, p.name), name: p => findIn(HAMBURG, p.name),
  },
  'hamburg-stadtteile': {
    file: 'hamburg10.json', parent: 'hamburg-bezirke', interval: 30,
  },
}

/* ═════════════ Postleitzahlen ═════════════ */

export const PLZ_ZONEN = {
  0: 'Dresden, Leipzig, Chemnitz, Halle', 1: 'Berlin, Potsdam, Rostock, Schwerin', 2: 'Hamburg, Bremen, Kiel, Lübeck', 3: 'Hannover, Magdeburg, Kassel, Braunschweig',
  4: 'Düsseldorf, Dortmund, Essen, Münster', 5: 'Köln, Bonn, Aachen, Koblenz', 6: 'Frankfurt am Main, Mannheim, Mainz, Saarbrücken', 7: 'Stuttgart, Karlsruhe, Freiburg',
  8: 'München, Augsburg, Ulm', 9: 'Nürnberg, Würzburg, Regensburg, Erfurt',
}

/* ═════════════ Straßen (OpenStreetMap) ═════════════ */

const num = r => parseInt(r.replace(/\D+/g, ''), 10) || 0

export const STRASSEN = {
  'de-autobahnen': {
    file: 'de_bab.json', clip: 'DEU', dual: true, minKm: 12,
    norm: r => { const m = r.match(/^A\s?(\d{1,3}[a-z]?)$/); return m ? `A ${m[1]}` : null },
    order: num,
    groupOf: r => (num(r) < 10 ? 'fern' : num(r) < 100 ? 'region' : 'kurz'),
    info: {
      'A 1': 'Heiligenhafen – Hamburg – Bremen – Dortmund – Köln – Saarbrücken', 'A 2': 'Oberhausen – Dortmund – Hannover – Magdeburg – Berlin',
      'A 3': 'Grenze NL (Elten) – Oberhausen – Köln – Frankfurt – Würzburg – Nürnberg – Regensburg – Passau', 'A 4': 'Aachen – Köln – Olpe … Kirchheim – Erfurt – Dresden – Görlitz',
      'A 5': 'Hattenbacher Dreieck – Frankfurt – Karlsruhe – Basel', 'A 6': 'Saarbrücken – Mannheim – Heilbronn – Nürnberg – Grenze CZ (Waidhaus)',
      'A 7': 'Grenze DK (Ellund) – Hamburg – Hannover – Kassel – Würzburg – Ulm – Füssen', 'A 8': 'Grenze LU (Perl) – Saarbrücken – Karlsruhe – Stuttgart – München – Salzburg',
      'A 9': 'Berlin – Leipzig – Nürnberg – München', 'A 10': 'Berliner Ring', 'A 11': 'Berlin – Grenze PL (Richtung Stettin)', 'A 12': 'Berlin – Frankfurt (Oder)',
      'A 13': 'Berlin – Dresden', 'A 14': 'Wismar – Magdeburg – Halle – Leipzig – Nossen', 'A 17': 'Dresden – Grenze CZ (Richtung Prag)', 'A 20': 'Ostseeautobahn: Bad Segeberg – Lübeck – Rostock – Grenze PL',
      'A 24': 'Hamburg – Berlin', 'A 27': 'Cuxhaven – Bremerhaven – Bremen – Walsrode', 'A 31': 'Emden – Lingen – Bottrop („Ostfriesenspieß“)', 'A 38': 'Göttingen – Halle – Leipzig',
      'A 40': 'Venlo – Duisburg – Essen – Dortmund („Ruhrschnellweg“)', 'A 44': 'Aachen – Düsseldorf – Dortmund – Kassel', 'A 45': 'Dortmund – Siegen – Gießen – Aschaffenburg („Sauerlandlinie“)',
      'A 61': 'Venlo – Mönchengladbach – Koblenz – Ludwigshafen – Hockenheim', 'A 66': 'Wiesbaden – Frankfurt – Fulda', 'A 71': 'Sangerhausen – Erfurt – Schweinfurt',
      'A 72': 'Hof – Chemnitz – Leipzig', 'A 81': 'Würzburg – Heilbronn – Stuttgart – Singen', 'A 93': 'Hof – Regensburg – Rosenheim – Kiefersfelden', 'A 94': 'München – Passau',
      'A 95': 'München – Garmisch-Partenkirchen', 'A 96': 'München – Memmingen – Lindau', 'A 99': 'Autobahnring München',
    },
  },
  'de-bundesstrassen': {
    file: 'de_b.json', clip: 'DEU', minKm: 20, interval: 1500,
    norm: r => { const m = r.match(/^B\s?(\d{1,2}[a-z]?)$/); return m ? `B ${m[1]}` : null },
    order: num,
    groupOf: r => (num(r) < 10 ? 'eins' : num(r) < 50 ? 'zwei' : 'fuenf'),
  },
  'fr-autoroutes': {
    file: 'fr_auto.json', clip: 'FRA', dual: true, minKm: 25,
    norm: r => { const m = r.match(/^A\s?(\d{1,3})$/); return m ? `A${m[1]}` : null },
    order: num,
    groupOf: r => (num(r) < 20 ? 'paris' : 'region'),
    info: {
      A1: 'Paris – Lille („Autoroute du Nord“)', A4: 'Paris – Reims – Metz – Straßburg („Autoroute de l’Est“)', A6: 'Paris – Lyon („Autoroute du Soleil“)', A7: 'Lyon – Marseille („Autoroute du Soleil“)',
      A8: 'Aix-en-Provence – Nizza – Grenze IT („La Provençale“)', A9: 'Orange – Montpellier – Perpignan – Grenze ES („La Languedocienne“)', A10: 'Paris – Orléans – Tours – Bordeaux („L’Aquitaine“)',
      A11: 'Paris – Le Mans – Angers – Nantes („L’Océane“)', A13: 'Paris – Rouen – Caen („Autoroute de Normandie“)', A16: 'Paris – Amiens – Calais – Dünkirchen', A26: 'Calais – Reims – Troyes („Autoroute des Anglais“)',
      A31: 'Grenze LU – Metz – Nancy – Dijon – Beaune', A36: 'Beaune – Besançon – Mülhausen („La Comtoise“)', A40: 'Mâcon – Genf – Chamonix („Autoroute Blanche“)', A43: 'Lyon – Chambéry – Fréjus-Tunnel',
      A61: 'Toulouse – Narbonne („Autoroute des Deux Mers“)', A62: 'Bordeaux – Toulouse („Autoroute des Deux Mers“)', A63: 'Bordeaux – Bayonne – Grenze ES („Côte Basque“)', A64: 'Bayonne – Pau – Toulouse („La Pyrénéenne“)',
      A71: 'Orléans – Bourges – Clermont-Ferrand („L’Arverne“)', A75: 'Clermont-Ferrand – Millau – Béziers („La Méridienne“)', A84: 'Caen – Rennes („Autoroute des Estuaires“)', A89: 'Bordeaux – Clermont-Ferrand – Lyon',
    },
  },
  'es-autovias': {
    file: 'es_auto.json', clip: 'ESP', dual: true, minKm: 25,
    norm: r => { const m = r.match(/^(A|AP)-(\d{1,2})$/); return m ? `${m[1]}-${m[2]}` : null },
    order: r => num(r) + (r.startsWith('AP') ? 0.5 : 0),
    groupOf: r => (r.startsWith('AP') ? 'maut' : num(r) <= 6 ? 'radial' : 'andere'),
    info: {
      'A-1': 'Madrid – Burgos („Autovía del Norte“)', 'A-2': 'Madrid – Saragossa – Barcelona („Autovía del Nordeste“)', 'A-3': 'Madrid – Valencia („Autovía del Este“)',
      'A-4': 'Madrid – Córdoba – Sevilla („Autovía del Sur“)', 'A-5': 'Madrid – Badajoz („Autovía del Suroeste“)', 'A-6': 'Madrid – La Coruña („Autovía del Noroeste“)',
      'A-7': 'Algeciras – Málaga – Almería – Murcia – Valencia – Barcelona („Autovía del Mediterráneo“)', 'AP-7': 'La Jonquera – Barcelona – Tarragona – Valencia – Alicante („Autopista del Mediterráneo“)',
      'A-8': 'Baskenland – Kantabrien – Asturien („Autovía del Cantábrico“)', 'A-66': 'Gijón – León – Salamanca – Sevilla („Ruta de la Plata“)', 'A-23': 'Sagunto – Teruel – Saragossa – Huesca („Autovía Mudéjar“)',
      'A-92': 'Sevilla – Granada – Almería („Autovía de Andalucía“)', 'A-62': 'Burgos – Valladolid – Salamanca – Grenze PT („Autovía de Castilla“)', 'AP-9': 'Ferrol – La Coruña – Santiago – Vigo („Autopista del Atlántico“)',
      'A-52': 'Benavente – Ourense – Vigo („Autovía de las Rías Baixas“)', 'A-44': 'Granada – Motril („Autovía de Sierra Nevada“)', 'A-45': 'Córdoba – Málaga',
    },
  },
}

/* ═════════════ Bahn (OpenStreetMap, route=railway) ═════════════ */

export const BAHN = {
  'nl-bahn': { file: 'nl_rail.json', clip: 'NLD', minKm: 25, max: 40 },
  'be-bahn': { file: 'be_rail.json', clip: 'BEL', minKm: 20, max: 40 },
  'fr-bahn': { file: 'fr_rail.json', clip: 'FRA', minKm: 120, max: 50 },
  'es-bahn': { file: 'es_rail.json', clip: 'ESP', minKm: 100, max: 45 },
  'it-bahn': { file: 'it_rail.json', ways: 'it_ways.json', clip: 'ITA', minKm: 60, max: 45 },
  'at-bahn': { file: 'at_rail.json', clip: 'AUT', minKm: 30, max: 35 },
  'uk-bahn': { file: 'uk_rail.json', ways: 'uk_ways.json', clip: 'GBR', minKm: 50, max: 45 },
}
