// Handgepflegte Daten für die Afrika-Quizzes von seekclan.de/geo. Wird von scripts/geo/build-afrika.mjs gelesen.
//
// Quellen (allgemein bekannte Fakten, Stand Oktober 2026):
//  - Amtssprachen, Kolonialgeschichte, Unabhängigkeit, Währungen, Zeitzonen, Fahrseite, Vorwahlen, Domains:
//    jeweilige Wikipedia-Artikel der Staaten (de.wikipedia.org) bzw. ITU/IANA
//  - Länder mit Street View in GeoGuessr: geometas.com/learn/geoguessr_country_coverage + Namibia (Street View seit 4. Juni 2025)
//  - Verwaltungsgrenzen: geoBoundaries (gbOpen, CC BY 4.0) bzw. Natural Earth (gemeinfrei) – siehe ADM unten

/**
 * iso3 → Länderdaten
 *  sp: Amtssprachen · spG: Hauptgruppe für die Sprachen-Karte (fr, en, pt, ar, es, andere)
 *  kol: Kolonialgeschichte (Text) · kolG: letzte Kolonialmacht (frankreich, uk, portugal, belgien, spanien, italien, suedafrika, keine)
 *  un: Jahr der Unabhängigkeit (null = nie Kolonie) · cur: Währung · cfa: 'west' | 'zentral' | null
 *  links: Linksverkehr · binnen: kein Meer · insel: Inselstaat · utc: Zeitzone (Standardzeit)
 *  tel: Vorwahl · tld: Domain · team: Spitzname der Fußball-Nationalmannschaft · alt: frühere Namen
 */
export const LAND = {
  DZA: { sp: ['Arabisch', 'Tamazight'], spG: 'ar', kol: 'Frankreich', kolG: 'frankreich', un: 1962, cur: 'Algerischer Dinar', utc: 1, tel: '+213', tld: '.dz', team: 'Les Fennecs (Wüstenfüchse)' },
  AGO: { sp: ['Portugiesisch'], spG: 'pt', kol: 'Portugal', kolG: 'portugal', un: 1975, cur: 'Kwanza', utc: 1, tel: '+244', tld: '.ao', team: 'Palancas Negras (Rappenantilopen)' },
  BEN: { sp: ['Französisch'], spG: 'fr', kol: 'Frankreich', kolG: 'frankreich', un: 1960, cur: 'CFA-Franc', cfa: 'west', utc: 1, tel: '+229', tld: '.bj', team: 'Les Guépards (Geparden)', alt: ['Dahomey'] },
  BWA: { sp: ['Englisch', 'Setswana'], spG: 'en', kol: 'Vereinigtes Königreich (Betschuanaland)', kolG: 'uk', un: 1966, cur: 'Pula', links: true, binnen: true, utc: 2, tel: '+267', tld: '.bw', team: 'The Zebras', alt: ['Betschuanaland'] },
  BFA: { sp: ['Französisch'], spG: 'fr', kol: 'Frankreich', kolG: 'frankreich', un: 1960, cur: 'CFA-Franc', cfa: 'west', binnen: true, utc: 0, tel: '+226', tld: '.bf', team: 'Les Étalons (Hengste)', alt: ['Obervolta'] },
  BDI: { sp: ['Kirundi', 'Französisch', 'Englisch'], spG: 'fr', kol: 'Deutschland, dann Belgien', kolG: 'belgien', un: 1962, cur: 'Burundi-Franc', binnen: true, utc: 2, tel: '+257', tld: '.bi', team: 'Intamba mu Rugamba' },
  CPV: { sp: ['Portugiesisch'], spG: 'pt', kol: 'Portugal', kolG: 'portugal', un: 1975, cur: 'Kap-Verde-Escudo', insel: true, utc: -1, tel: '+238', tld: '.cv', team: 'Tubarões Azuis (Blaue Haie)' },
  CMR: { sp: ['Französisch', 'Englisch'], spG: 'fr', kol: 'Deutschland, dann Frankreich und Vereinigtes Königreich', kolG: 'frankreich', un: 1960, cur: 'CFA-Franc', cfa: 'zentral', utc: 1, tel: '+237', tld: '.cm', team: 'Unbezähmbare Löwen' },
  CAF: { sp: ['Französisch', 'Sango'], spG: 'fr', kol: 'Frankreich', kolG: 'frankreich', un: 1960, cur: 'CFA-Franc', cfa: 'zentral', binnen: true, utc: 1, tel: '+236', tld: '.cf', team: 'Les Fauves', alt: ['Ubangi-Schari'] },
  TCD: { sp: ['Französisch', 'Arabisch'], spG: 'fr', kol: 'Frankreich', kolG: 'frankreich', un: 1960, cur: 'CFA-Franc', cfa: 'zentral', binnen: true, utc: 1, tel: '+235', tld: '.td', team: 'Les Sao' },
  COM: { sp: ['Komorisch', 'Französisch', 'Arabisch'], spG: 'fr', kol: 'Frankreich', kolG: 'frankreich', un: 1975, cur: 'Komoren-Franc', insel: true, utc: 3, tel: '+269', tld: '.km', team: 'Les Cœlacanthes (Quastenflosser)' },
  COD: { sp: ['Französisch'], spG: 'fr', kol: 'Belgien', kolG: 'belgien', un: 1960, cur: 'Kongo-Franc', utc: 1, utcNote: 'Westen UTC+1, Osten UTC+2', tel: '+243', tld: '.cd', team: 'Les Léopards', alt: ['Zaire', 'Belgisch-Kongo', 'Kongo-Freistaat'] },
  COG: { sp: ['Französisch'], spG: 'fr', kol: 'Frankreich', kolG: 'frankreich', un: 1960, cur: 'CFA-Franc', cfa: 'zentral', utc: 1, tel: '+242', tld: '.cg', team: 'Les Diables Rouges (Rote Teufel)' },
  CIV: { sp: ['Französisch'], spG: 'fr', kol: 'Frankreich', kolG: 'frankreich', un: 1960, cur: 'CFA-Franc', cfa: 'west', utc: 0, tel: '+225', tld: '.ci', team: 'Les Éléphants' },
  DJI: { sp: ['Französisch', 'Arabisch'], spG: 'fr', kol: 'Frankreich', kolG: 'frankreich', un: 1977, cur: 'Dschibuti-Franc', utc: 3, tel: '+253', tld: '.dj', team: 'Riverains de la Mer Rouge', alt: ['Französisch-Somaliland', 'Französisches Afar- und Issa-Territorium'] },
  EGY: { sp: ['Arabisch'], spG: 'ar', kol: 'Vereinigtes Königreich (Protektorat)', kolG: 'uk', un: 1922, cur: 'Ägyptisches Pfund', utc: 2, tel: '+20', tld: '.eg', team: 'Die Pharaonen' },
  GNQ: { sp: ['Spanisch', 'Französisch', 'Portugiesisch'], spG: 'es', kol: 'Spanien', kolG: 'spanien', un: 1968, cur: 'CFA-Franc', cfa: 'zentral', utc: 1, tel: '+240', tld: '.gq', team: 'Nzalang Nacional', alt: ['Spanisch-Guinea'] },
  ERI: { sp: ['Tigrinya', 'Arabisch', 'Englisch'], spG: 'andere', spNote: 'Arbeitssprachen, keine offizielle Amtssprache', kol: 'Italien, dann Vereinigtes Königreich und Äthiopien', kolG: 'italien', un: 1993, cur: 'Nakfa', utc: 3, tel: '+291', tld: '.er', team: 'Red Sea Boys' },
  SWZ: { sp: ['Englisch', 'Siswati'], spG: 'en', kol: 'Vereinigtes Königreich', kolG: 'uk', un: 1968, cur: 'Lilangeni', links: true, binnen: true, utc: 2, tel: '+268', tld: '.sz', team: 'Sihlangu Semnikati', alt: ['Swasiland'] },
  ETH: { sp: ['Amharisch', 'Afaan Oromo', 'Tigrinya', 'Somali', 'Afar'], spG: 'andere', spNote: 'Arbeitssprachen des Bundes', kol: 'nie Kolonie (1936–1941 von Italien besetzt)', kolG: 'keine', un: null, cur: 'Birr', binnen: true, utc: 3, tel: '+251', tld: '.et', team: 'Walia-Steinböcke', alt: ['Abessinien'] },
  GAB: { sp: ['Französisch'], spG: 'fr', kol: 'Frankreich', kolG: 'frankreich', un: 1960, cur: 'CFA-Franc', cfa: 'zentral', utc: 1, tel: '+241', tld: '.ga', team: 'Les Panthères' },
  GMB: { sp: ['Englisch'], spG: 'en', kol: 'Vereinigtes Königreich', kolG: 'uk', un: 1965, cur: 'Dalasi', utc: 0, tel: '+220', tld: '.gm', team: 'The Scorpions' },
  GHA: { sp: ['Englisch'], spG: 'en', kol: 'Vereinigtes Königreich (Goldküste)', kolG: 'uk', un: 1957, cur: 'Cedi', utc: 0, tel: '+233', tld: '.gh', team: 'Black Stars', alt: ['Goldküste'] },
  GIN: { sp: ['Französisch'], spG: 'fr', kol: 'Frankreich', kolG: 'frankreich', un: 1958, cur: 'Guinea-Franc', utc: 0, tel: '+224', tld: '.gn', team: 'Syli Nationale (Nationale Elefanten)', alt: ['Französisch-Guinea'] },
  GNB: { sp: ['Portugiesisch'], spG: 'pt', kol: 'Portugal', kolG: 'portugal', un: 1973, cur: 'CFA-Franc', cfa: 'west', utc: 0, tel: '+245', tld: '.gw', team: 'Djurtus', alt: ['Portugiesisch-Guinea'] },
  KEN: { sp: ['Swahili', 'Englisch'], spG: 'en', kol: 'Vereinigtes Königreich', kolG: 'uk', un: 1963, cur: 'Kenia-Schilling', links: true, utc: 3, tel: '+254', tld: '.ke', team: 'Harambee Stars', alt: ['Britisch-Ostafrika'] },
  LSO: { sp: ['Sesotho', 'Englisch'], spG: 'en', kol: 'Vereinigtes Königreich (Basutoland)', kolG: 'uk', un: 1966, cur: 'Loti', links: true, binnen: true, utc: 2, tel: '+266', tld: '.ls', team: 'Likuena (Krokodile)', alt: ['Basutoland'] },
  LBR: { sp: ['Englisch'], spG: 'en', kol: 'nie Kolonie – 1847 von befreiten Sklaven aus den USA gegründet', kolG: 'keine', un: 1847, cur: 'Liberianischer Dollar', utc: 0, tel: '+231', tld: '.lr', team: 'Lone Star' },
  LBY: { sp: ['Arabisch'], spG: 'ar', kol: 'Italien', kolG: 'italien', un: 1951, cur: 'Libyscher Dinar', utc: 2, tel: '+218', tld: '.ly', team: 'Mittelmeer-Ritter' },
  MDG: { sp: ['Malagasy', 'Französisch'], spG: 'fr', kol: 'Frankreich', kolG: 'frankreich', un: 1960, cur: 'Ariary', insel: true, utc: 3, tel: '+261', tld: '.mg', team: 'Barea' },
  MWI: { sp: ['Englisch', 'Chichewa'], spG: 'en', kol: 'Vereinigtes Königreich (Njassaland)', kolG: 'uk', un: 1964, cur: 'Malawi-Kwacha', links: true, binnen: true, utc: 2, tel: '+265', tld: '.mw', team: 'The Flames', alt: ['Njassaland'] },
  MLI: { sp: ['Bambara und weitere Landessprachen'], spG: 'fr', spNote: 'seit 2023 sind 13 Landessprachen Amtssprachen, Französisch ist Arbeitssprache', kol: 'Frankreich', kolG: 'frankreich', un: 1960, cur: 'CFA-Franc', cfa: 'west', binnen: true, utc: 0, tel: '+223', tld: '.ml', team: 'Les Aigles (Adler)', alt: ['Französisch-Sudan'] },
  MRT: { sp: ['Arabisch'], spG: 'ar', kol: 'Frankreich', kolG: 'frankreich', un: 1960, cur: 'Ouguiya', utc: 0, tel: '+222', tld: '.mr', team: 'Les Mourabitounes' },
  MUS: { sp: ['Englisch', 'Französisch'], spG: 'en', spNote: 'keine festgelegte Amtssprache; Englisch und Französisch in Verwaltung und Schule, im Alltag Kreolisch', kol: 'Niederlande, Frankreich, dann Vereinigtes Königreich', kolG: 'uk', un: 1968, cur: 'Mauritius-Rupie', links: true, insel: true, utc: 4, tel: '+230', tld: '.mu', team: 'Club M' },
  MAR: { sp: ['Arabisch', 'Tamazight'], spG: 'ar', kol: 'Frankreich und Spanien (Protektorate)', kolG: 'frankreich', un: 1956, cur: 'Marokkanischer Dirham', utc: 1, utcNote: 'seit 2018 ganzjährig UTC+1, im Ramadan UTC+0', tel: '+212', tld: '.ma', team: 'Atlas-Löwen' },
  MOZ: { sp: ['Portugiesisch'], spG: 'pt', kol: 'Portugal', kolG: 'portugal', un: 1975, cur: 'Metical', links: true, utc: 2, tel: '+258', tld: '.mz', team: 'Os Mambas' },
  NAM: { sp: ['Englisch'], spG: 'en', kol: 'Deutschland (Deutsch-Südwestafrika), dann Südafrika', kolG: 'suedafrika', un: 1990, cur: 'Namibia-Dollar', links: true, utc: 2, tel: '+264', tld: '.na', team: 'Brave Warriors', alt: ['Deutsch-Südwestafrika', 'Südwestafrika'] },
  NER: { sp: ['Hausa', 'Französisch'], spG: 'fr', spNote: 'seit 2025 Hausa als Landessprache, Französisch Arbeitssprache', kol: 'Frankreich', kolG: 'frankreich', un: 1960, cur: 'CFA-Franc', cfa: 'west', binnen: true, utc: 1, tel: '+227', tld: '.ne', team: 'Ménas' },
  NGA: { sp: ['Englisch'], spG: 'en', kol: 'Vereinigtes Königreich', kolG: 'uk', un: 1960, cur: 'Naira', utc: 1, tel: '+234', tld: '.ng', team: 'Super Eagles' },
  RWA: { sp: ['Kinyarwanda', 'Englisch', 'Französisch', 'Swahili'], spG: 'en', kol: 'Deutschland, dann Belgien', kolG: 'belgien', un: 1962, cur: 'Ruanda-Franc', binnen: true, utc: 2, tel: '+250', tld: '.rw', team: 'Amavubi (Wespen)' },
  STP: { sp: ['Portugiesisch'], spG: 'pt', kol: 'Portugal', kolG: 'portugal', un: 1975, cur: 'Dobra', insel: true, utc: 0, tel: '+239', tld: '.st', team: 'Os Falcões e Papagaios' },
  SEN: { sp: ['Französisch'], spG: 'fr', kol: 'Frankreich', kolG: 'frankreich', un: 1960, cur: 'CFA-Franc', cfa: 'west', utc: 0, tel: '+221', tld: '.sn', team: 'Lions de la Teranga' },
  SYC: { sp: ['Seychellenkreol', 'Englisch', 'Französisch'], spG: 'en', kol: 'Frankreich, dann Vereinigtes Königreich', kolG: 'uk', un: 1976, cur: 'Seychellen-Rupie', links: true, insel: true, utc: 4, tel: '+248', tld: '.sc', team: 'Pirates' },
  SLE: { sp: ['Englisch'], spG: 'en', kol: 'Vereinigtes Königreich', kolG: 'uk', un: 1961, cur: 'Leone', utc: 0, tel: '+232', tld: '.sl', team: 'Leone Stars' },
  SOM: { sp: ['Somali', 'Arabisch'], spG: 'ar', kol: 'Italien und Vereinigtes Königreich', kolG: 'italien', un: 1960, cur: 'Somalia-Schilling', utc: 3, tel: '+252', tld: '.so', team: 'Ocean Stars' },
  ZAF: { sp: ['12 Amtssprachen, u. a. Englisch, Afrikaans, isiZulu, isiXhosa'], spG: 'en', kol: 'Niederlande, dann Vereinigtes Königreich', kolG: 'uk', un: 1910, unText: '1910 (Südafrikanische Union), 1961 Republik', cur: 'Rand', links: true, utc: 2, tel: '+27', tld: '.za', team: 'Bafana Bafana' },
  SDS: { sp: ['Englisch'], spG: 'en', kol: 'Vereinigtes Königreich und Ägypten, dann Teil des Sudan', kolG: 'uk', un: 2011, cur: 'Südsudanesisches Pfund', binnen: true, utc: 2, tel: '+211', tld: '.ss', team: 'Bright Stars' },
  SDN: { sp: ['Arabisch', 'Englisch'], spG: 'ar', kol: 'Vereinigtes Königreich und Ägypten', kolG: 'uk', un: 1956, cur: 'Sudanesisches Pfund', utc: 2, tel: '+249', tld: '.sd', team: 'Sokoor Al-Jediane (Falken)' },
  TZA: { sp: ['Swahili', 'Englisch'], spG: 'en', kol: 'Deutschland (Deutsch-Ostafrika), dann Vereinigtes Königreich', kolG: 'uk', un: 1961, unText: '1961 (Tanganjika), 1964 Vereinigung mit Sansibar', cur: 'Tansania-Schilling', links: true, utc: 3, tel: '+255', tld: '.tz', team: 'Taifa Stars', alt: ['Tanganjika', 'Deutsch-Ostafrika'] },
  TGO: { sp: ['Französisch'], spG: 'fr', kol: 'Deutschland, dann Frankreich', kolG: 'frankreich', un: 1960, cur: 'CFA-Franc', cfa: 'west', utc: 0, tel: '+228', tld: '.tg', team: 'Les Éperviers (Sperber)' },
  TUN: { sp: ['Arabisch'], spG: 'ar', kol: 'Frankreich (Protektorat)', kolG: 'frankreich', un: 1956, cur: 'Tunesischer Dinar', utc: 1, tel: '+216', tld: '.tn', team: 'Adler von Karthago' },
  UGA: { sp: ['Englisch', 'Swahili'], spG: 'en', kol: 'Vereinigtes Königreich', kolG: 'uk', un: 1962, cur: 'Uganda-Schilling', links: true, binnen: true, utc: 3, tel: '+256', tld: '.ug', team: 'The Cranes (Kraniche)' },
  ZMB: { sp: ['Englisch'], spG: 'en', kol: 'Vereinigtes Königreich (Nordrhodesien)', kolG: 'uk', un: 1964, cur: 'Sambischer Kwacha', links: true, binnen: true, utc: 2, tel: '+260', tld: '.zm', team: 'Chipolopolo (Kupferkugeln)', alt: ['Nordrhodesien'] },
  ZWE: { sp: ['16 Amtssprachen, u. a. Englisch, Shona, Ndebele'], spG: 'en', kol: 'Vereinigtes Königreich (Südrhodesien)', kolG: 'uk', un: 1980, cur: 'Zimbabwe Gold (ZiG)', links: true, binnen: true, utc: 2, tel: '+263', tld: '.zw', team: 'The Warriors', alt: ['Rhodesien', 'Südrhodesien'] },
}

/** Länder mit Street View in GeoGuessr (Stand Okt. 2026, Geometas + Namibia) – für GG-Quizzes, Ausgangsliste im Adminpanel */
export const GG = ['BWA', 'SWZ', 'GHA', 'KEN', 'LSO', 'MDG', 'NAM', 'NGA', 'RWA', 'SEN', 'ZAF', 'UGA', 'TUN']

/** Bekannteste Länder (Stufe Leicht) – sonst nach Fläche und Einwohnern */
export const LAENDER_LEICHT = ['EGY', 'ZAF', 'NGA', 'KEN', 'ETH', 'MAR', 'DZA', 'LBY', 'SDN', 'COD', 'TZA', 'MDG', 'AGO', 'NAM', 'GHA', 'SEN', 'MLI', 'NER', 'TCD', 'SOM', 'TUN', 'MOZ', 'ZMB', 'ZWE', 'CMR', 'UGA']

/** Abhängige Gebiete in und um Afrika (Stufe Sehr schwer): Ebene gebiete (aus build-welt) bzw. world */
export const GEBIETE = [
  // [id in Ebene, Ebene, Name, gehört zu, Flagge]
  ['REU', 'gebiete', 'Réunion', 'Frankreich (Überseedepartement)', 're'],
  ['MYT', 'gebiete', 'Mayotte', 'Frankreich (Überseedepartement)', 'yt'],
  ['SHS', 'gebiete', 'St. Helena', 'Vereinigtes Königreich', 'sh-hl'],
  ['IOT', 'gebiete', 'Britisches Territorium im Indischen Ozean', 'Vereinigtes Königreich', 'io'],
]

/** Verwaltungsebene 1: Quelle und Bezeichnungen je Land.
 *  src: 'gb' = geoBoundaries ADM1, 'ne' = Natural Earth admin_1 · noun/one: Mehrzahl/Einzahl · cap: Bezeichnung des Hauptorts
 *  note: Hinweis zum Stand der Grenzen (auf der Kachel) */
export const ADM = {
  DZA: { src: 'gb', noun: 'Provinzen', one: 'Provinz (Wilaya)', note: 'Stand der freien Kartendaten: 48 Provinzen. Seit 2019 gibt es offiziell 58 – die 10 neuen Provinzen im Süden fehlen hier.' },
  AGO: { src: 'gb', noun: 'Provinzen', one: 'Provinz', note: 'Stand der Kartendaten: 18 Provinzen (seit 2024 sind es 21).' },
  BEN: { src: 'gb', noun: 'Departements', one: 'Departement' },
  BWA: { src: 'gb', noun: 'Distrikte', one: 'Distrikt' },
  BFA: { src: 'gb', noun: 'Regionen', one: 'Region', note: 'Stand der Kartendaten: 13 Regionen (seit 2025 sind es 17).' },
  BDI: { src: 'gb', noun: 'Provinzen', one: 'Provinz', note: 'Stand der Kartendaten: 18 Provinzen (seit 2025 sind es 5).' },
  CPV: { src: 'gb', noun: 'Gemeinden', one: 'Gemeinde' },
  CMR: { src: 'gb', noun: 'Regionen', one: 'Region' },
  CAF: { src: 'gb', noun: 'Präfekturen', one: 'Präfektur', note: 'Stand der Kartendaten: 16 Präfekturen und Bangui (seit 2020 sind es 20).' },
  TCD: { src: 'gb', noun: 'Provinzen', one: 'Provinz' },
  COM: { src: 'gb', noun: 'Inseln', one: 'Insel' },
  COD: { src: 'gb', noun: 'Provinzen', one: 'Provinz' },
  COG: { src: 'gb', noun: 'Departements', one: 'Departement' },
  CIV: { src: 'gb', noun: 'Distrikte', one: 'Distrikt' },
  DJI: { src: 'gb', noun: 'Regionen', one: 'Region' },
  EGY: { src: 'gb', noun: 'Gouvernements', one: 'Gouvernement' },
  GNQ: { src: 'gb', noun: 'Provinzen', one: 'Provinz' },
  ERI: { src: 'gb', noun: 'Regionen', one: 'Region' },
  SWZ: { src: 'gb', noun: 'Regionen', one: 'Region' },
  ETH: { src: 'gb', noun: 'Regionen', one: 'Region', note: 'Stand der Kartendaten: 9 Regionen und 2 Städte. Seit 2020 wurde die Region der Südlichen Völker in Sidama, Südwest-, Süd- und Zentraläthiopien geteilt.' },
  GAB: { src: 'gb', noun: 'Provinzen', one: 'Provinz' },
  GMB: { src: 'ne', noun: 'Regionen', one: 'Region' },
  GHA: { src: 'gb', noun: 'Regionen', one: 'Region' },
  GIN: { src: 'gb', noun: 'Regionen', one: 'Region' },
  GNB: { src: 'gb', noun: 'Regionen', one: 'Region' },
  KEN: { src: 'gb', noun: 'Countys', one: 'County' },
  LSO: { src: 'gb', noun: 'Distrikte', one: 'Distrikt' },
  LBR: { src: 'gb', noun: 'Countys', one: 'County' },
  LBY: { src: 'ne', noun: 'Distrikte', one: 'Distrikt (Schabiyya)' },
  MDG: { src: 'gb', noun: 'Regionen', one: 'Region' },
  MWI: { src: 'ne', noun: 'Distrikte', one: 'Distrikt' },
  MLI: { src: 'gb', noun: 'Regionen', one: 'Region', note: 'Stand der Kartendaten: 8 Regionen und Bamako (seit 2023 sind es 19 Regionen).' },
  MRT: { src: 'gb', noun: 'Regionen', one: 'Region' },
  MUS: { src: 'gb', noun: 'Distrikte', one: 'Distrikt' },
  MAR: { src: 'gb', noun: 'Regionen', one: 'Region', note: 'Ohne das Gebiet der Westsahara (grau): Dessen Status ist international ungeklärt.' },
  MOZ: { src: 'gb', noun: 'Provinzen', one: 'Provinz' },
  NAM: { src: 'gb', noun: 'Regionen', one: 'Region' },
  NER: { src: 'ne', noun: 'Regionen', one: 'Region' },
  NGA: { src: 'gb', noun: 'Bundesstaaten', one: 'Bundesstaat' },
  RWA: { src: 'gb', noun: 'Provinzen', one: 'Provinz' },
  STP: { src: 'gb', noun: 'Provinzen', one: 'Provinz' },
  SEN: { src: 'gb', noun: 'Regionen', one: 'Region' },
  SYC: { src: 'ne', noun: 'Distrikte', one: 'Distrikt' },
  SLE: { src: 'gb', noun: 'Provinzen', one: 'Provinz', note: 'Stand der Kartendaten: 4 Provinzen (seit 2017 sind es 5 mit der Nordwestprovinz).' },
  SOM: { src: 'gb', noun: 'Regionen', one: 'Region', note: 'Die 18 Regionen von vor 1991 – mit den Regionen von Somaliland im Norden.' },
  ZAF: { src: 'gb', noun: 'Provinzen', one: 'Provinz' },
  SDS: { src: 'gb', gb: 'SSD', noun: 'Bundesstaaten', one: 'Bundesstaat' },
  SDN: { src: 'gb', noun: 'Bundesstaaten', one: 'Bundesstaat' },
  TZA: { src: 'gb', noun: 'Regionen', one: 'Region', note: 'Stand der Kartendaten: 30 Regionen (seit 2016 sind es 31 mit Songwe).' },
  TGO: { src: 'gb', noun: 'Regionen', one: 'Region' },
  TUN: { src: 'gb', noun: 'Gouvernements', one: 'Gouvernement' },
  UGA: { src: 'ne', noun: 'Distrikte', one: 'Distrikt', note: 'Stand der Kartendaten: 112 Distrikte (heute sind es über 130).' },
  ZMB: { src: 'gb', noun: 'Provinzen', one: 'Provinz' },
  ZWE: { src: 'gb', noun: 'Provinzen', one: 'Provinz' },
}

/** Zweite Verwaltungsebene – nur für GG-Länder (Leonie, Okt. 2026) */
export const ADM2 = {
  ZAF: { noun: 'Distrikte', one: 'Distrikt', title: 'Distrikte' },
  BWA: { noun: 'Unterdistrikte', one: 'Unterdistrikt', title: 'Unterdistrikte' },
  NAM: { noun: 'Wahlkreise', one: 'Wahlkreis', title: 'Wahlkreise (Constituencies)' },
  LSO: { noun: 'Wahlkreise', one: 'Wahlkreis', title: 'Wahlkreise' },
  SWZ: { noun: 'Tinkhundla', one: 'Inkhundla', title: 'Tinkhundla' },
  KEN: { noun: 'Wahlkreise', one: 'Wahlkreis', title: 'Wahlkreise (Constituencies)' },
  UGA: { noun: 'Countys', one: 'County', title: 'Countys' },
  RWA: { noun: 'Distrikte', one: 'Distrikt', title: 'Distrikte' },
  MDG: { noun: 'Distrikte', one: 'Distrikt', title: 'Distrikte' },
  NGA: { noun: 'LGAs', one: 'Local Government Area', title: 'Local Government Areas' },
  GHA: { noun: 'Distrikte', one: 'Distrikt', title: 'Distrikte' },
  SEN: { noun: 'Departements', one: 'Departement', title: 'Departements' },
  // Tunesien: Die freien Daten (geoBoundaries) haben nur arabische Namen der Delegationen – deshalb (noch) nicht dabei.
}

/** Länder mit eigenem Quiz „Hauptstädte der Provinzen/Regionen“ */
export const ADM_HAUPTSTAEDTE = ['ZAF', 'NGA', 'KEN', 'GHA', 'MAR', 'EGY', 'DZA', 'COD', 'TZA', 'ETH', 'MDG', 'NAM', 'SEN', 'TUN', 'UGA', 'BWA', 'RWA', 'CMR', 'AGO', 'MOZ', 'ZMB', 'ZWE', 'SDN', 'CIV', 'LSO', 'SWZ']

/** Namen von Hand (Rohname aus den Kartendaten → deutscher bzw. richtiger Name) */
export const NAME_FIX = {
  "District Autonome D'Abidjan": 'Abidjan', 'District Autonome De Yamoussoukro': 'Yamoussoukro', Comoe: 'Comoé', Denguele: 'Denguélé', 'Valle Du Bandama': 'Vallée du Bandama',
  'Sassandra-Marahoue': 'Sassandra-Marahoué', 'Nothern Cape': 'Nordkap', 'Region der südlichen Nationen, Nationalitäten und Völker': 'Südliche Nationen, Nationalitäten und Völker',
  SNNPR: 'Südliche Nationen, Nationalitäten und Völker', 'Afar-Region': 'Afar', 'Savannen-Region': 'Savannah', 'Nairobi City': 'Nairobi',
}
/** ISO-3166-2-Codes von geoBoundaries, die anders lauten als bei Wikidata */
export const CODE_FIX = { ZAF: { GT: 'ZA-GP', KZ: 'ZA-KZN', LI: 'ZA-LP' } }

/** Hauptorte von Hand (überschreibt Wikidata, wenn dort veraltet oder leer): Code oder Name → Hauptort */
export const CAP_FIX = {
  'ET-OR': 'Addis Abeba', 'ET-AA': null, 'ET-DD': null, 'ET-HA': 'Harar', 'NA-OT': 'Omuthiya', 'NA-KE': 'Rundu', 'KE-110': null, 'KE-30': null,
  'ZA-GP': 'Johannesburg', 'NG-FC': 'Abuja', 'EG-C': null, 'EG-ALX': null, 'TZ-02': null, 'GH-AA': 'Accra', 'SN-DK': null,
}

/* ───────────── Natur ───────────── */

/** Flüsse: englischer Name in Natural Earth → deutscher Name */
export const FLUSS_DE = {
  Nile: 'Nil', 'White Nile': 'Weißer Nil', 'Blue Nile': 'Blauer Nil', Congo: 'Kongo', Niger: 'Niger', Zambezi: 'Sambesi', Orange: 'Oranje',
  Limpopo: 'Limpopo', Senegal: 'Senegal', Volta: 'Volta', 'Black Volta': 'Schwarzer Volta', 'White Volta': 'Weißer Volta', Ubangi: 'Ubangi', Kasai: 'Kasai',
  Benue: 'Benue', Lualaba: 'Lualaba', Okavango: 'Okavango', Cubango: 'Okavango', Kafue: 'Kafue', Luangwa: 'Luangwa', Shire: 'Shire', Rufiji: 'Rufiji',
  Juba: 'Jubba', Jubba: 'Jubba', Shabeelle: 'Shabelle', Shebele: 'Shabelle', Atbara: 'Atbara', Sobat: 'Sobat', Gambia: 'Gambia', Vaal: 'Vaal',
  Cuanza: 'Cuanza', Kwanza: 'Cuanza', Ogooué: 'Ogooué', Sanaga: 'Sanaga', Chari: 'Schari', Logone: 'Logone', Tana: 'Tana', Awash: 'Awash',
  Uele: 'Uele', Sankuru: 'Sankuru', Lomami: 'Lomami', Aruwimi: 'Aruwimi', Kwango: 'Kwango', Cunene: 'Kunene', Kunene: 'Kunene', Save: 'Save',
  Rovuma: 'Rovuma', Ruvuma: 'Rovuma', 'Bahr el Ghazal': 'Bahr al-Ghazal', 'Bahr al Arab': 'Bahr al-Arab', Moulouya: 'Moulouya', Chelif: 'Chelif', Draa: 'Draa',
  Sous: 'Sous', 'Oum er Rbia': 'Oum er-Rbia', Sebou: 'Sebou', Medjerda: 'Medjerda', 'Great Fish': 'Great Fish', Tugela: 'Tugela', Pangani: 'Pangani',
  Kagera: 'Kagera', Ruzizi: 'Ruzizi', Bani: 'Bani', Sokoto: 'Sokoto', Kaduna: 'Kaduna', 'Cross': 'Cross', Mono: 'Mono', Ouémé: 'Ouémé', Comoé: 'Comoé',
  Bandama: 'Bandama', Sassandra: 'Sassandra', 'Saint Paul': 'St. Paul', Corubal: 'Corubal', Casamance: 'Casamance', Mangoky: 'Mangoky', Betsiboka: 'Betsiboka',
  Mana: 'Mana', Luapula: 'Luapula', Chambeshi: 'Chambeshi', Zambeze: 'Sambesi', Lukuga: 'Lukuga', Kwilu: 'Kwilu', Mbomou: 'Mbomou', Sangha: 'Sangha',
  'El Bahr el Abyad': 'Weißer Nil', 'El Bahr el Azraq': 'Blauer Nil', Abay: 'Blauer Nil', 'Bahr el Jebel': 'Bahr al-Dschabal', 'Albert Nile': 'Albert-Nil',
  'Victoria Nile': 'Victoria-Nil', Sénégal: 'Senegal', Bénoué: 'Benue', Shebele: 'Shabelle', Shabeelle: 'Shabelle', Komoé: 'Comoé', Mouhoun: 'Schwarzer Volta (Mouhoun)',
  Nakanbé: 'Weißer Volta (Nakanbé)', Rusizi: 'Ruzizi', 'Suez Canal': 'Suezkanal', 'Damietta Branch': 'Damiette-Arm (Nil)', 'Rosetta Branch': 'Rosetta-Arm (Nil)',
  'Oued Sebou': 'Sebou', 'Oum Er Rbia': 'Oum er-Rbia', 'Great Ruaha': 'Großer Ruaha', 'Great Kei': 'Großer Kei', 'Bahr Aouk': 'Bahr Aouk', 'Ismailiya Canal': 'Ismailiya-Kanal',
  Fish: 'Fischfluss', Swakop: 'Swakop', Kuiseb: 'Kuiseb', Shashe: 'Shashe', Olifants: 'Olifants', Molopo: 'Molopo', Nossob: 'Nossob', Gariep: 'Oranje',
}
/** Die großen, bekannten Flüsse (Stufe Leicht) */
export const FLUSS_LEICHT = ['Nil', 'Weißer Nil', 'Blauer Nil', 'Kongo', 'Niger', 'Sambesi', 'Oranje', 'Limpopo', 'Senegal', 'Volta', 'Ubangi', 'Kasai', 'Benue', 'Okavango', 'Gambia', 'Schari', 'Jubba', 'Shabelle', 'Atbara', 'Lualaba', 'Vaal', 'Cuanza', 'Rufiji', 'Kunene']

/** Gipfel, die in Natural Earth fehlen: [Name, Höhe, Länge, Breite, Land, Hinweis] */
export const GIPFEL_EXTRA = [
  ['Kilimandscharo (Kibo)', 5895, 37.3533, -3.0758, 'TZA', 'Höchster Berg Afrikas und höchster freistehender Berg der Welt'],
  ['Mount Kenya', 5199, 37.3083, -0.1521, 'KEN', 'Zweithöchster Berg Afrikas'],
  ['Mount Stanley (Margherita Peak)', 5109, 29.8717, 0.3856, 'COD', 'Höchster Gipfel des Ruwenzori, auf der Grenze zu Uganda'],
  ['Ras Daschen', 4550, 38.3726, 13.2364, 'ETH', 'Höchster Berg Äthiopiens'],
  ['Mount Meru', 4562, 36.7486, -3.2463, 'TZA', null],
  ['Karisimbi', 4507, 29.4453, -1.5081, 'RWA', 'Höchster Berg Ruandas, Vulkan an der Grenze zur DR Kongo'],
  ['Mount Elgon', 4321, 34.5258, 1.1342, 'UGA', 'Erloschener Vulkan an der Grenze zu Kenia'],
  ['Toubkal', 4167, -7.9158, 31.0597, 'MAR', 'Höchster Berg Nordafrikas'],
  ['Kamerunberg', 4040, 9.1708, 4.2033, 'CMR', 'Aktiver Vulkan, höchster Berg Westafrikas'],
  ['Emi Koussi', 3415, 18.5333, 19.7917, 'TCD', 'Höchster Berg der Sahara (Tibesti)'],
  ['Thabana Ntlenyana', 3482, 29.2681, -29.4678, 'LSO', 'Höchster Berg im südlichen Afrika'],
  ['Mafadi', 3450, 29.3539, -29.2045, 'ZAF', 'Höchster Berg Südafrikas'],
  ['Pico Basilé', 3011, 8.7867, 3.5803, 'GNQ', null],
  ['Pico do Fogo', 2829, -24.3814, 14.95, 'CPV', 'Aktiver Vulkan auf der Insel Fogo'],
  ['Piton des Neiges', 3069, 55.4783, -21.0989, 'REU', 'Höchster Berg im Indischen Ozean'],
  ['Mount Mulanje (Sapitwa)', 3002, 35.5833, -15.95, 'MWI', null],
  ['Mount Inyangani', 2592, 32.8833, -18.3167, 'ZWE', 'Höchster Berg Simbabwes'],
  ['Brandberg (Königstein)', 2573, 14.5833, -21.1333, 'NAM', 'Höchster Berg Namibias'],
  ['Tahat', 2908, 5.5333, 23.2833, 'DZA', 'Höchster Berg Algeriens (Ahaggar)'],
  ['Katharinenberg', 2629, 33.9500, 28.5111, 'EGY', 'Höchster Berg Ägyptens (Sinai)'],
  ['Mosesberg', 2285, 33.9750, 28.5394, 'EGY', 'Berg Sinai'],
  ['Maromokotro', 2876, 49.0, -14.0167, 'MDG', 'Höchster Berg Madagaskars'],
  ['Nyiragongo', 3470, 29.25, -1.5167, 'COD', 'Aktiver Vulkan mit Lavasee'],
  ['Erta Ale', 613, 40.6667, 13.6, 'ETH', 'Schildvulkan mit Lavasee in der Danakil-Senke'],
  ['Ol Doinyo Lengai', 2962, 35.9014, -2.7642, 'TZA', 'Einziger aktiver Karbonatit-Vulkan der Erde'],
  ['Tafelberg', 1085, 18.4033, -33.9628, 'ZAF', 'Hausberg von Kapstadt'],
  ['Mount Gorongosa', 1863, 34.0667, -18.4333, 'MOZ', null],
  ['Bintumani', 1945, -11.1167, 9.1667, 'SLE', 'Höchster Berg Sierra Leones'],
  ['Mount Nimba', 1752, -8.4833, 7.6, 'GIN', 'Auf der Grenze Guinea – Elfenbeinküste'],
].filter(g => g[1] > 0)
export const GIPFEL_LEICHT = ['Kilimandscharo (Kibo)', 'Mount Kenya', 'Mount Stanley (Margherita Peak)', 'Ras Daschen', 'Toubkal', 'Kamerunberg', 'Mount Elgon',
  'Thabana Ntlenyana', 'Tafelberg', 'Mount Meru', 'Nyiragongo', 'Emi Koussi', 'Pico do Fogo', 'Katharinenberg', 'Karisimbi', 'Brandberg (Königstein)']

/* ───────────── Wissen: Tiere, Pflanzen, Anbau, Rohstoffe, Essen ───────────── */

/** [Name, Gruppe, Länder (ISO3), Text] – „Wo leben …?“ (Hauptverbreitung, Auswahl) */
export const TIERE = [
  ['Lemuren', 'saeuger', ['MDG', 'COM'], 'Leben nur auf Madagaskar und den Komoren.'],
  ['Okapi', 'saeuger', ['COD'], 'Waldgiraffe – lebt nur im Regenwald der DR Kongo.'],
  ['Berggorilla', 'saeuger', ['RWA', 'UGA', 'COD'], 'In den Virunga-Vulkanen und im Bwindi-Wald.'],
  ['Flachlandgorilla', 'saeuger', ['CMR', 'GAB', 'COG', 'CAF', 'GNQ', 'COD'], 'Regenwälder Zentralafrikas.'],
  ['Schimpanse', 'saeuger', ['GIN', 'SLE', 'LBR', 'CIV', 'GHA', 'NGA', 'CMR', 'GAB', 'COG', 'CAF', 'COD', 'UGA', 'RWA', 'BDI', 'TZA', 'SEN', 'MLI'], 'Wälder West-, Zentral- und Ostafrikas.'],
  ['Bonobo', 'saeuger', ['COD'], 'Nur südlich des Kongo-Flusses in der DR Kongo.'],
  ['Spitzmaulnashorn', 'saeuger', ['ZAF', 'NAM', 'KEN', 'ZWE', 'TZA'], 'Die meisten leben in Südafrika und Namibia.'],
  ['Breitmaulnashorn', 'saeuger', ['ZAF', 'KEN', 'NAM', 'BWA', 'ZWE'], 'Fast alle leben im südlichen Afrika, vor allem in Südafrika.'],
  ['Afrikanischer Wildhund', 'saeuger', ['BWA', 'ZWE', 'ZAF', 'TZA', 'ZMB', 'MOZ', 'KEN'], 'Selten – größte Bestände in Botswana und Tansania.'],
  ['Äthiopischer Wolf', 'saeuger', ['ETH'], 'Seltenster Hundeartiger – nur im Hochland Äthiopiens.'],
  ['Dschelada', 'saeuger', ['ETH'], 'Affe des äthiopischen Hochlands.'],
  ['Fennek', 'saeuger', ['MAR', 'DZA', 'TUN', 'LBY', 'EGY', 'MRT', 'MLI', 'NER', 'TCD', 'SDN'], 'Wüstenfuchs der Sahara – Wappentier Algeriens.'],
  ['Dromedar', 'saeuger', ['MRT', 'MLI', 'NER', 'TCD', 'SDN', 'SOM', 'ETH', 'KEN', 'EGY', 'LBY', 'DZA', 'MAR', 'TUN', 'DJI', 'ERI'], 'Sahara, Sahel und Horn von Afrika. Somalia hat die meisten.'],
  ['Berberaffe', 'saeuger', ['MAR', 'DZA'], 'Einziger Affe Afrikas nördlich der Sahara (Atlas).'],
  ['Zwergflusspferd', 'saeuger', ['LBR', 'SLE', 'GIN', 'CIV'], 'Nur in Westafrika, die meisten in Liberia.'],
  ['Giraffe', 'saeuger', ['KEN', 'TZA', 'NAM', 'BWA', 'ZAF', 'ZMB', 'UGA', 'NER', 'TCD', 'ZWE', 'ETH', 'SOM'], 'Savannen von Niger bis Südafrika.'],
  ['Löwe', 'big5', ['TZA', 'ZAF', 'BWA', 'KEN', 'ZMB', 'ZWE', 'NAM', 'MOZ', 'UGA', 'ETH'], 'Die meisten leben in Tansania.'],
  ['Leopard', 'big5', ['ZAF', 'NAM', 'BWA', 'ZMB', 'ZWE', 'MOZ', 'TZA', 'KEN', 'UGA', 'COD', 'GAB', 'CMR', 'ETH'], 'Weit verbreitet – von der Savanne bis in den Regenwald.'],
  ['Afrikanischer Elefant', 'big5', ['BWA', 'ZWE', 'TZA', 'KEN', 'ZMB', 'ZAF', 'NAM', 'MOZ', 'GAB', 'COG', 'CMR', 'UGA'], 'Botswana hat die meisten Elefanten der Welt.'],
  ['Kaffernbüffel', 'big5', ['TZA', 'ZAF', 'BWA', 'ZWE', 'ZMB', 'KEN', 'MOZ', 'UGA'], 'Savannen südlich der Sahara.'],
  ['Nashorn (Big Five)', 'big5', ['ZAF', 'NAM', 'KEN', 'BWA', 'ZWE'], 'Gehört zu den Big Five – meist in Schutzgebieten im Süden und Osten.'],
  ['Strauß', 'voegel', ['KEN', 'TZA', 'NAM', 'BWA', 'ZAF', 'ETH', 'SOM'], 'Größter Vogel der Welt – Savannen und Halbwüsten.'],
  ['Brillenpinguin', 'voegel', ['ZAF', 'NAM'], 'Einziger Pinguin Afrikas – z. B. am Boulders Beach bei Kapstadt.'],
  ['Schuhschnabel', 'voegel', ['UGA', 'SDS', 'ZMB', 'TZA', 'COD', 'RWA'], 'Riesiger Sumpfvogel – Sudd, Bangweulu-Sümpfe, Ugandas Sümpfe.'],
  ['Flamingo (Rift Valley)', 'voegel', ['KEN', 'TZA', 'ETH'], 'Riesige Schwärme an den Sodaseen des Grabens (Nakuru, Natron, Bogoria).'],
  ['Nilkrokodil', 'reptilien', ['EGY', 'SDN', 'ETH', 'KEN', 'UGA', 'TZA', 'ZMB', 'ZWE', 'MOZ', 'BWA', 'ZAF', 'MDG'], 'In Flüssen und Seen fast ganz Afrikas südlich der Sahara.'],
  ['Chamäleons', 'reptilien', ['MDG'], 'Fast die Hälfte aller Chamäleon-Arten lebt auf Madagaskar.'],
  ['Quastenflosser', 'meer', ['COM', 'ZAF', 'TZA'], '„Lebendes Fossil“ – vor den Komoren und an der Küste Ostafrikas.'],
  ['Walhai', 'meer', ['MOZ', 'TZA', 'DJI', 'MDG', 'SYC'], 'Größter Fisch – vor Mosambik (Tofo), Mafia (Tansania) und Dschibuti.'],
]
export const TIER_GRUPPEN = { big5: 'Big Five', saeuger: 'Säugetier', voegel: 'Vogel', reptilien: 'Reptil', meer: 'Meer' }

/** Pflanzen und Bäume: [Name, Gruppe, Länder, Text] */
export const PFLANZEN = [
  ['Baobab (Affenbrotbaum)', 'baum', ['SEN', 'MLI', 'BFA', 'NER', 'NGA', 'SDN', 'ETH', 'KEN', 'TZA', 'MOZ', 'ZWE', 'ZMB', 'BWA', 'NAM', 'ZAF', 'MWI', 'AGO'], 'Typisch für trockene Savannen – in Senegal und Tansania besonders häufig.'],
  ['Madagaskar-Baobabs', 'baum', ['MDG'], '6 der 8 Baobab-Arten wachsen nur auf Madagaskar (Allee der Baobabs bei Morondava).'],
  ['Welwitschia', 'wueste', ['NAM', 'AGO'], 'Wird über 1.000 Jahre alt – wächst nur in der Namib.'],
  ['Köcherbaum', 'wueste', ['NAM', 'ZAF'], 'Aloe-Art im Süden Namibias und im Nordkap.'],
  ['Schirmakazie', 'baum', ['KEN', 'TZA', 'SOM', 'ETH', 'SDN', 'EGY', 'NAM', 'BWA', 'ZAF'], 'Das Bild der ostafrikanischen Savanne.'],
  ['Ölpalme', 'palme', ['NGA', 'GHA', 'CIV', 'CMR', 'LBR', 'SLE', 'GIN', 'COD', 'BEN', 'TGO'], 'Stammt aus Westafrika – Palmöl.'],
  ['Dattelpalme', 'palme', ['EGY', 'DZA', 'TUN', 'MAR', 'LBY', 'SDN', 'MRT'], 'Oasen der Sahara und das Niltal. Ägypten erntet die meisten Datteln der Welt.'],
  ['Raphia-Palme', 'palme', ['MDG', 'NGA', 'CMR', 'GHA'], 'Hat die längsten Blätter aller Pflanzen.'],
  ['Protea (Königsprotea)', 'blume', ['ZAF'], 'Nationalblume Südafrikas – typisch für das Fynbos am Kap.'],
  ['Arganbaum', 'baum', ['MAR'], 'Wächst fast nur im Südwesten Marokkos – Arganöl.'],
  ['Teff', 'feld', ['ETH', 'ERI'], 'Getreide für Injera – fast nur in Äthiopien und Eritrea angebaut.'],
  ['Eukalyptus-Plantagen', 'baum', ['ETH', 'RWA', 'KEN', 'UGA', 'MDG', 'ZAF', 'SWZ'], 'Eingeführt – heute in Ostafrika und im Süden überall (GeoGuessr-Hinweis).'],
  ['Kiefern-Plantagen', 'baum', ['SWZ', 'ZAF', 'MWI', 'ZWE'], 'Forstplantagen im Hochland (z. B. Eswatini, Mpumalanga).'],
  ['Bananen (Matoke)', 'feld', ['UGA', 'RWA', 'BDI', 'TZA', 'KEN', 'COD'], 'Kochbananen – Grundnahrung um den Victoriasee.'],
  ['Zuckerrohr', 'feld', ['ZAF', 'SWZ', 'MUS', 'EGY', 'KEN', 'SDN', 'ETH', 'MWI'], 'Große Plantagen in KwaZulu-Natal, Eswatini, auf Mauritius und Réunion.'],
]
export const PFLANZEN_GRUPPEN = { baum: 'Baum', palme: 'Palme', wueste: 'Wüstenpflanze', blume: 'Blume', feld: 'Feld & Plantage' }

/** Anbau – größte Produzenten Afrikas: [Produkt, Länder (größter zuerst), Text] */
export const ANBAU = [
  ['Kakao', ['CIV', 'GHA', 'CMR', 'NGA'], 'Elfenbeinküste und Ghana ernten zusammen fast zwei Drittel des Kakaos der Welt.'],
  ['Kaffee', ['ETH', 'UGA', 'CIV', 'TZA', 'KEN'], 'Äthiopien gilt als Heimat des Kaffees.'],
  ['Tee', ['KEN', 'MWI', 'UGA', 'TZA', 'RWA'], 'Kenia ist einer der größten Tee-Exporteure der Welt.'],
  ['Vanille', ['MDG', 'COM', 'UGA'], 'Madagaskar liefert den größten Teil der Vanille der Welt.'],
  ['Gewürznelken', ['MDG', 'TZA', 'COM'], 'Sansibar und Madagaskar.'],
  ['Baumwolle', ['BEN', 'BFA', 'MLI', 'CIV', 'EGY', 'TCD'], 'Der „Baumwollgürtel“ im Sahel.'],
  ['Cashewnüsse', ['CIV', 'GHA', 'NGA', 'GNB', 'BEN', 'TZA', 'MOZ'], 'Elfenbeinküste ist der größte Produzent der Welt.'],
  ['Erdnüsse', ['NGA', 'SDN', 'SEN', 'TCD', 'GHA'], 'Im Senegal ein wichtiges Exportgut.'],
  ['Maniok', ['NGA', 'COD', 'GHA', 'AGO', 'CMR'], 'Nigeria erntet am meisten Maniok weltweit.'],
  ['Wein', ['ZAF', 'EGY', 'DZA', 'MAR', 'TUN'], 'Südafrika (Westkap) ist mit Abstand der größte Weinproduzent Afrikas.'],
  ['Rosen (Schnittblumen)', ['KEN', 'ETH'], 'Rund um den Naivashasee wachsen Rosen für Europa.'],
  ['Tabak', ['ZWE', 'MWI', 'ZMB', 'TZA', 'MOZ'], 'Wichtigstes Exportgut Malawis.'],
]

/** Rohstoffe: [Rohstoff, Länder, Text] */
export const ROHSTOFFE = [
  ['Erdöl', ['NGA', 'LBY', 'DZA', 'AGO', 'EGY', 'COG', 'GAB', 'GNQ', 'SDS', 'TCD'], 'Nigeria, Libyen, Algerien und Angola fördern am meisten.'],
  ['Erdgas', ['DZA', 'EGY', 'NGA', 'LBY', 'MOZ'], 'Algerien liefert per Pipeline nach Europa.'],
  ['Gold', ['GHA', 'ZAF', 'MLI', 'BFA', 'SDN', 'TZA'], 'Ghana und Südafrika sind die größten Goldproduzenten Afrikas.'],
  ['Diamanten', ['BWA', 'COD', 'AGO', 'ZAF', 'NAM', 'SLE', 'LSO'], 'Botswana ist nach Wert einer der größten Diamantenproduzenten der Welt.'],
  ['Kupfer', ['COD', 'ZMB'], 'Der Kupfergürtel liegt in Katanga (DR Kongo) und Sambia.'],
  ['Kobalt', ['COD'], 'Rund drei Viertel des Kobalts der Welt kommen aus der DR Kongo.'],
  ['Platin', ['ZAF', 'ZWE'], 'Südafrika fördert den größten Teil des Platins der Welt.'],
  ['Uran', ['NAM', 'NER', 'ZAF'], 'Namibia und Niger gehören zu den größten Uranproduzenten.'],
  ['Phosphat', ['MAR', 'TUN', 'EGY', 'TGO', 'SEN'], 'Marokko hat die größten Phosphatvorkommen der Welt.'],
  ['Bauxit', ['GIN', 'GHA', 'SLE'], 'Guinea ist einer der größten Bauxitproduzenten der Welt.'],
  ['Coltan', ['COD', 'RWA', 'NGA'], 'Für Handys und Laptops – vor allem aus dem Osten der DR Kongo.'],
  ['Eisenerz', ['ZAF', 'MRT', 'SLE', 'LBR'], 'Mauretanien: Erzzug von Zouérat – einer der längsten Züge der Welt.'],
]

/** Nationalgerichte: [Land, Gericht, Text] */
export const GERICHTE = [
  ['ETH', 'Injera mit Wat', 'Säuerliches Fladenbrot aus Teff mit scharfen Eintöpfen.'],
  ['MAR', 'Tajine', 'Schmorgericht aus dem Lehmtopf mit spitzem Deckel.'],
  ['DZA', 'Couscous', 'Gedämpfter Grieß – Couscous ist UNESCO-Kulturerbe von Algerien, Marokko, Tunesien und Mauretanien.'],
  ['TUN', 'Brik', 'Knusprige Teigtasche mit Ei und Thunfisch.'],
  ['EGY', 'Koshari', 'Reis, Linsen, Nudeln und Tomatensoße mit Röstzwiebeln.'],
  ['SEN', 'Thiéboudienne', 'Reis mit Fisch und Gemüse – UNESCO-Kulturerbe.'],
  ['NGA', 'Jollof-Reis', 'Tomatenreis – Nigeria und Ghana streiten, wer ihn besser macht.'],
  ['GHA', 'Fufu', 'Gestampfter Teig aus Maniok und Kochbananen, dazu Suppe.'],
  ['ZAF', 'Bobotie', 'Gewürzter Hackfleischauflauf mit Eierguss.'],
  ['KEN', 'Ugali mit Sukuma Wiki', 'Fester Maisbrei mit Grünkohl.'],
  ['UGA', 'Matoke', 'Gekochte, gestampfte Kochbananen.'],
  ['MOZ', 'Piri-Piri-Huhn', 'Scharfes Grillhähnchen.'],
  ['CMR', 'Ndolé', 'Eintopf aus Bitterblättern, Erdnüssen und Fleisch oder Fisch.'],
  ['CIV', 'Attiéké', 'Maniok-Couscous, oft mit gegrilltem Fisch.'],
  ['MDG', 'Romazava', 'Eintopf mit Rindfleisch und Blattgemüse.'],
  ['ZWE', 'Sadza', 'Fester Maisbrei – wie Ugali oder Nshima.'],
  ['ZMB', 'Nshima', 'Fester Maisbrei, Grundnahrung in Sambia und Malawi.'],
  ['CPV', 'Cachupa', 'Eintopf aus Mais, Bohnen und Fleisch oder Fisch.'],
  ['MUS', 'Dholl Puri', 'Fladenbrot mit gelben Erbsen – indischer Einfluss.'],
  ['BWA', 'Seswaa', 'Lange gekochtes, zerzupftes Rindfleisch.'],
  ['NAM', 'Kapana', 'Gegrillte Fleischstücke vom Straßenstand.'],
  ['SDN', 'Ful medames', 'Gekochte Saubohnen mit Öl und Gewürzen.'],
  ['TZA', 'Pilau', 'Gewürzreis – sehr beliebt an der Swahili-Küste.'],
  ['RWA', 'Isombe', 'Maniokblätter mit Erdnüssen.'],
]

/** Bauwerke und Sehenswürdigkeiten: [Name, Länge, Breite, Land, Gruppe, Text] */
export const BAUWERKE = [
  ['Pyramiden von Gizeh', 31.1342, 29.9792, 'EGY', 'antike', 'Das einzige erhaltene der sieben Weltwunder der Antike.'],
  ['Tempel von Abu Simbel', 31.6256, 22.3372, 'EGY', 'antike', 'Wurde 1964–68 wegen des Nasser-Stausees versetzt.'],
  ['Karnak-Tempel (Luxor)', 32.6573, 25.7188, 'EGY', 'antike', 'Größter Tempelbezirk des alten Ägypten.'],
  ['Felsenkirchen von Lalibela', 39.0473, 12.0317, 'ETH', 'religion', 'Elf Kirchen aus dem 12./13. Jahrhundert, aus dem Fels gehauen.'],
  ['Stelen von Aksum', 38.7194, 14.1311, 'ETH', 'antike', 'Riesige Steinstelen des Aksumitischen Reichs.'],
  ['Große Moschee von Djenné', -4.5553, 13.9056, 'MLI', 'religion', 'Größtes Lehmbauwerk der Welt.'],
  ['Timbuktu', -3.0074, 16.7735, 'MLI', 'stadt', 'Legendäre Handels- und Gelehrtenstadt am Rand der Sahara.'],
  ['Groß-Simbabwe', 30.9339, -20.2675, 'ZWE', 'antike', 'Ruinenstadt aus Stein – gab dem Land seinen Namen.'],
  ['Karthago', 10.3233, 36.8529, 'TUN', 'antike', 'Ruinen der phönizischen und römischen Stadt bei Tunis.'],
  ['Amphitheater von El Djem', 10.7069, 35.2964, 'TUN', 'antike', 'Eines der größten römischen Amphitheater.'],
  ['Leptis Magna', 14.2908, 32.6386, 'LBY', 'antike', 'Römische Ruinenstadt am Mittelmeer.'],
  ['Ksar Aït-Ben-Haddou', -7.1293, 31.0472, 'MAR', 'stadt', 'Lehmdorf am Rand des Hohen Atlas – Filmkulisse.'],
  ['Hassan-II.-Moschee', -7.6328, 33.6083, 'MAR', 'religion', 'Moschee in Casablanca mit dem höchsten Minarett Afrikas.'],
  ['Medina von Fès', -4.9736, 34.0617, 'MAR', 'stadt', 'Größte autofreie Altstadt der Welt.'],
  ['Robben Island', 18.3664, -33.8067, 'ZAF', 'geschichte', 'Gefängnisinsel, auf der Nelson Mandela 18 Jahre saß.'],
  ['Goree', -17.3986, 14.6672, 'SEN', 'geschichte', 'Insel vor Dakar – Erinnerungsort des Sklavenhandels.'],
  ['Cape Coast Castle', -1.2412, 5.1033, 'GHA', 'geschichte', 'Festung des Sklavenhandels an der Küste Ghanas.'],
  ['Steinstadt von Sansibar', 39.1925, -6.1622, 'TZA', 'stadt', 'Swahili-Altstadt mit geschnitzten Holztüren.'],
  ['Fort Jesus (Mombasa)', 39.6797, -4.0628, 'KEN', 'geschichte', 'Portugiesische Festung von 1593.'],
  ['Völkermord-Gedenkstätte Kigali', 30.0606, -1.9306, 'RWA', 'geschichte', 'Erinnert an den Völkermord an den Tutsi 1994.'],
  ['Basilika Notre-Dame de la Paix', -5.2964, 6.8106, 'CIV', 'religion', 'In Yamoussoukro – eine der größten Kirchen der Welt.'],
  ['Victoriafälle', 25.8573, -17.9243, 'ZMB', 'natur', 'Mosi-oa-Tunya – „Donnernder Rauch“, an der Grenze zu Simbabwe.'],
  ['Tafelberg', 18.4033, -33.9628, 'ZAF', 'natur', 'Flacher Hausberg von Kapstadt.'],
  ['Sossusvlei', 15.2907, -24.7275, 'NAM', 'natur', 'Rote Dünen und die Tonpfanne Deadvlei in der Namib.'],
  ['Allee der Baobabs', 44.4186, -20.2508, 'MDG', 'natur', 'Bei Morondava.'],
  ['Mauretanischer Erzzug (Zouérat)', -12.4757, 22.7347, 'MRT', 'geschichte', 'Einer der längsten und schwersten Züge der Welt.'],
]
export const BAUWERK_GRUPPEN = { antike: 'Antike', religion: 'Kirche & Moschee', stadt: 'Altstadt', geschichte: 'Geschichte', natur: 'Natur-Wahrzeichen' }

/** Alte Reiche: [Name, Länge, Breite, Zeit, heute in, Text] */
export const REICHE = [
  ['Altes Ägypten', 31.25, 29.85, 'ca. 3000–30 v. Chr.', 'EGY', 'Pharaonenreich am Nil.'],
  ['Kusch (Meroe)', 33.75, 16.94, 'ca. 1070 v. Chr.–350 n. Chr.', 'SDN', 'Nubisches Reich mit eigenen Pyramiden.'],
  ['Karthago', 10.32, 36.85, 'ca. 814–146 v. Chr.', 'TUN', 'Phönizische Handelsmacht, Gegner Roms.'],
  ['Aksum', 38.72, 14.13, 'ca. 100–940', 'ETH', 'Handelsreich am Roten Meer, früh christlich.'],
  ['Ghana-Reich (Wagadu)', -7.98, 15.77, 'ca. 300–1240', 'MRT', 'Goldhandel – lag in Mauretanien und Mali, nicht im heutigen Ghana.'],
  ['Mali-Reich', -8.0, 12.0, 'ca. 1235–1670', 'MLI', 'Herrscher Mansa Musa gilt als einer der reichsten Menschen der Geschichte.'],
  ['Songhai-Reich', 0.04, 16.27, 'ca. 1430–1591', 'MLI', 'Hauptstadt Gao am Niger.'],
  ['Großsimbabwe', 30.93, -20.27, 'ca. 1100–1450', 'ZWE', 'Steinstadt im Süden Afrikas.'],
  ['Königreich Kongo', 14.25, -6.27, 'ca. 1390–1914', 'AGO', 'Hauptstadt Mbanza Kongo im heutigen Angola.'],
  ['Königreich Benin', 5.62, 6.34, 'ca. 1180–1897', 'NGA', 'Berühmt für die Benin-Bronzen – im heutigen Nigeria.'],
  ['Aschanti-Reich', -1.62, 6.69, 'ca. 1701–1901', 'GHA', 'Hauptstadt Kumasi, Goldenes Schemel.'],
  ['Zulu-Königreich', 31.33, -28.31, 'ca. 1816–1897', 'ZAF', 'Unter König Shaka zur Großmacht.'],
  ['Kanem-Bornu', 14.0, 13.0, 'ca. 700–1893', 'TCD', 'Reich rund um den Tschadsee.'],
  ['Sultanat Sansibar', 39.19, -6.16, '1856–1964', 'TZA', 'Handelsmacht an der Swahili-Küste.'],
  ['Königreich Dahomey', 2.0, 7.18, 'ca. 1600–1904', 'BEN', 'Bekannt für die Kriegerinnen (Agojie) – heute Benin.'],
]

/** Verlegte Hauptstädte: [Land, alt, neu, Jahr, Länge neu, Breite neu, Text] */
export const HAUPTSTADT_UMZUG = [
  ['NGA', 'Lagos', 'Abuja', 1991, 7.4951, 9.0579, 'Abuja wurde extra als neue Hauptstadt in der Landesmitte gebaut.'],
  ['TZA', 'Daressalam', 'Dodoma', 1996, 35.7516, -6.163, 'Dodoma ist seit 1996 offiziell Hauptstadt – viele Ministerien zogen erst ab 2016 um.'],
  ['BDI', 'Bujumbura', 'Gitega', 2019, 29.9246, -3.4264, 'Gitega ist seit 2019 politische Hauptstadt.'],
  ['CIV', 'Abidjan', 'Yamoussoukro', 1983, -5.2767, 6.8276, 'Abidjan ist bis heute der Regierungs- und Wirtschaftssitz.'],
  ['MWI', 'Zomba', 'Lilongwe', 1975, 33.7741, -13.9626, 'Zomba war Hauptstadt des britischen Njassaland.'],
  ['BWA', 'Mafikeng', 'Gaborone', 1965, 25.9086, -24.6282, 'Die Kolonialverwaltung saß in Mafikeng – heute in Südafrika.'],
  ['MRT', 'Saint-Louis', 'Nouakchott', 1958, -15.9785, 18.0735, 'Saint-Louis liegt heute im Senegal.'],
  ['EGY', 'Kairo', 'Neue Verwaltungshauptstadt', 2023, 31.7614, 30.0187, 'Seit 2023 ziehen Regierung und Ministerien in die neue Stadt östlich von Kairo.'],
  ['GNQ', 'Malabo', 'Ciudad de la Paz', 2017, 10.6, 1.6, 'Neue Hauptstadt im Landesinneren auf dem Festland – im Bau.'],
]

/** Größte Stadt ≠ Hauptstadt (Text-Quiz): iso → größte Stadt */
export const GROESSTE_STADT = {
  NGA: 'Lagos', TZA: 'Daressalam', CIV: 'Abidjan', CMR: 'Douala', MAR: 'Casablanca', ZAF: 'Johannesburg', BDI: 'Bujumbura', BEN: 'Cotonou',
  GNQ: 'Bata', SWZ: 'Manzini',
}
