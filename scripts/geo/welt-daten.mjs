// Von Hand gepflegte Tabellen für die Welt-Quizzes (scripts/geo/build-welt.mjs).
// Alles, was nicht direkt aus einer Datenquelle kommt (deutsche Namen, Auswahl der "normalen" Stufe,
// Korrekturen an Natural Earth), steht hier – damit man es prüfen und ändern kann.

/* ───────────── Kontinente ───────────── */

export const KONTINENTE = {
  EU: { name: 'Europa', group: 'europa', aliases: [] },
  AS: { name: 'Asien', group: 'asien', aliases: [] },
  AF: { name: 'Afrika', group: 'afrika', aliases: [] },
  NA: { name: 'Nordamerika', group: 'nordamerika', aliases: [] },
  SA: { name: 'Südamerika', group: 'suedamerika', aliases: [] },
  OZ: { name: 'Australien und Ozeanien', group: 'ozeanien', aliases: ['Australien', 'Ozeanien'] },
  AN: { name: 'Antarktika', group: 'antarktis', aliases: ['Antarktis'] },
}

/** Natural-Earth-Feld CONTINENT → Kontinent */
export const NE_CONTINENT = {
  Europe: 'EU', Asia: 'AS', Africa: 'AF', 'North America': 'NA', 'South America': 'SA', Oceania: 'OZ', Antarctica: 'AN',
}

/**
 * Abweichungen je Teilgebiet (map_subunits: SU_A3 oder ADM0_A3). null = gehört zu keinem Kontinent (z.B. Kerguelen).
 * Russland, Kasachstan und die Türkei werden zusätzlich an Ural/Uralfluss bzw. Bosporus geteilt (siehe EUROPA_SEITE).
 */
export const KONTINENT_OVERRIDE = {
  EGY: 'AF', IDN: 'AS', TLS: 'AS', PNG: 'OZ', GRL: 'NA', PAN: 'NA', ISL: 'EU', CYP: 'AS', GEO: 'AS', ARM: 'AS', AZE: 'AS',
  USH: 'OZ', // Hawaii
  CHP: 'OZ', CHS: 'OZ', // Osterinsel, Salas y Gómez
  ESC: 'AF', PMD: 'AF', PAZ: 'EU', // Kanaren, Madeira, Azoren
  MDV: 'AS', IOT: 'AS', IOD: 'AS', SYC: 'AF', MUS: 'AF', COM: 'AF', CPV: 'AF', STP: 'AF', MYT: 'AF', REU: 'AF',
  SHS: 'AF', BAC: 'AF', SHT: 'AF', JUI: 'AF', EUI: 'AF', BSI: 'AF', GOI: 'AF', TEI: 'AF', FSA: null,
  ATF: null, HMD: null, BVT: null, SGG: null, SGX: null, CLP: 'NA', BMU: 'NA',
  CXR: 'AS', CCK: 'AS',
}

/** Fläche westlich von Ural – Uralfluss (für Russland & Kasachstan) = Europa. Grobe Linie, reicht für eine Weltkarte. */
export const EUROPA_SEITE = [[-30, 85], [68, 85], [66.5, 69], [65, 67], [60, 64.8], [59.3, 62], [59.4, 60], [59.3, 58], [59.2, 56], [59, 54], [58.8, 52], [58.6, 51.2], [55.1, 51.75], [51.4, 51.2], [51.5, 50], [51.9, 47.1], [52, 45], [52, 38], [-30, 38], [-30, 85]]
/** Ostthrakien (europäischer Teil der Türkei, westlich des Bosporus und nördlich der Dardanellen) */
export const THRAKIEN = [[25, 43], [29.06, 43], [29.06, 41.0], [28.0, 40.85], [26.9, 40.55], [26.65, 40.38], [26.2, 40.02], [25, 40.02], [25, 43]]

/* ───────────── Überseegebiete & abhängige Gebiete ───────────── */
// code: eigener Schlüssel · su: Teilgebiete aus Natural Earth map_subunits (SU_A3) · iso: für Flagge/Domain
// tld: aktive Länderdomain (null = keine eigene oder nicht vergeben) · flag: eigene Flagge (nicht nur die des Staates)

const BOT = 'Britisches Überseegebiet'
const KRON = 'Britischer Kronbesitz (Crown Dependency)'
const FDOM = 'Französisches Überseedépartement und -region'
const FCOM = 'Französische Überseegemeinschaft'
const NLLAND = 'Autonomes Land im Königreich der Niederlande'
const USTERR = 'Außengebiet der Vereinigten Staaten'
const USMINOR = 'Kleinere Amerikanische Überseeinsel (unbewohnt)'
const AUEXT = 'Australisches Außengebiet'

export const GEBIETE = [
  // Vereinigtes Königreich
  { code: 'AIA', name: 'Anguilla', sov: 'Vereinigtes Königreich', status: BOT, su: ['AIA'], iso: 'ai', tld: '.ai', flag: 'ai', cont: 'nordamerika' },
  { code: 'BMU', name: 'Bermuda', sov: 'Vereinigtes Königreich', status: BOT, su: ['BMU'], iso: 'bm', tld: '.bm', flag: 'bm', cont: 'nordamerika', aliases: ['Bermudas'] },
  { code: 'VGB', name: 'Britische Jungferninseln', sov: 'Vereinigtes Königreich', status: BOT, su: ['VGB'], iso: 'vg', tld: '.vg', flag: 'vg', cont: 'nordamerika' },
  { code: 'CYM', name: 'Kaimaninseln', sov: 'Vereinigtes Königreich', status: BOT, su: ['CYM'], iso: 'ky', tld: '.ky', flag: 'ky', cont: 'nordamerika', aliases: ['Cayman Islands', 'Caymaninseln'] },
  { code: 'TCA', name: 'Turks- und Caicosinseln', sov: 'Vereinigtes Königreich', status: BOT, su: ['TCA'], iso: 'tc', tld: '.tc', flag: 'tc', cont: 'nordamerika' },
  { code: 'MSR', name: 'Montserrat', sov: 'Vereinigtes Königreich', status: BOT, su: ['MSR'], iso: 'ms', tld: '.ms', flag: 'ms', cont: 'nordamerika' },
  { code: 'FLK', name: 'Falklandinseln', sov: 'Vereinigtes Königreich', status: BOT, note: 'Wird von Argentinien beansprucht (Malwinen).', su: ['FLK'], iso: 'fk', tld: '.fk', flag: 'fk', cont: 'suedamerika', aliases: ['Falklands', 'Malwinen'] },
  { code: 'SGS', name: 'Südgeorgien und die Südlichen Sandwichinseln', sov: 'Vereinigtes Königreich', status: BOT, note: 'Wird von Argentinien beansprucht.', su: ['SGG', 'SGX'], iso: 'gs', tld: '.gs', flag: 'gs', cont: 'suedamerika', aliases: ['Südgeorgien'] },
  { code: 'GIB', name: 'Gibraltar', sov: 'Vereinigtes Königreich', status: BOT, note: 'Wird von Spanien beansprucht.', su: ['GIB'], iso: 'gi', tld: '.gi', flag: 'gi', cont: 'europa' },
  { code: 'PCN', name: 'Pitcairninseln', sov: 'Vereinigtes Königreich', status: BOT, su: ['PCN'], iso: 'pn', tld: '.pn', flag: 'pn', cont: 'ozeanien', aliases: ['Pitcairn'] },
  { code: 'SHS', name: 'St. Helena', sov: 'Vereinigtes Königreich', status: `${BOT} (Teil von St. Helena, Ascension und Tristan da Cunha)`, su: ['SHS'], iso: 'sh', tld: '.sh', flag: 'sh-hl', cont: 'afrika', aliases: ['Sankt Helena'] },
  { code: 'BAC', name: 'Ascension', sov: 'Vereinigtes Königreich', status: `${BOT} (Teil von St. Helena, Ascension und Tristan da Cunha)`, su: ['BAC'], iso: 'ac', tld: '.ac', flag: 'sh-ac', cont: 'afrika', aliases: ['Ascension Island'] },
  { code: 'SHT', name: 'Tristan da Cunha', sov: 'Vereinigtes Königreich', status: `${BOT} (Teil von St. Helena, Ascension und Tristan da Cunha)`, su: ['SHT'], iso: 'ta', tld: null, flag: 'sh-ta', cont: 'afrika' },
  { code: 'IOT', name: 'Britisches Territorium im Indischen Ozean', sov: 'Vereinigtes Königreich', status: BOT, note: 'Chagos-Inseln mit Diego Garcia; 2025 wurde ein Abkommen zur Übergabe an Mauritius unterzeichnet.', su: ['IOT', 'IOD'], iso: 'io', tld: '.io', flag: 'io', cont: 'asien', aliases: ['Chagos-Inseln', 'Chagosinseln', 'Diego Garcia'] },
  { code: 'ADK', name: 'Akrotiri und Dekelia', sov: 'Vereinigtes Königreich', status: 'Britische Militärbasen auf Zypern (Hoheitszonen)', su: ['WSB', 'ESB'], iso: null, tld: null, flag: null, cont: 'asien', aliases: ['Akrotiri', 'Dhekelia', 'Dekelia'] },
  { code: 'JEY', name: 'Jersey', sov: 'Britische Krone', status: KRON, su: ['JEY'], iso: 'je', tld: '.je', flag: 'je', cont: 'europa' },
  { code: 'GGY', name: 'Guernsey', sov: 'Britische Krone', status: KRON, su: ['GGG', 'GGS', 'GGA', 'GGH'], iso: 'gg', tld: '.gg', flag: 'gg', cont: 'europa' },
  { code: 'IMN', name: 'Isle of Man', sov: 'Britische Krone', status: KRON, su: ['IMN'], iso: 'im', tld: '.im', flag: 'im', cont: 'europa', aliases: ['Insel Man'] },

  // Frankreich
  { code: 'GUF', name: 'Französisch-Guayana', sov: 'Frankreich', status: FDOM, su: ['GUF'], iso: 'gf', tld: '.gf', flag: null, cont: 'suedamerika', aliases: ['Guyane'] },
  { code: 'GLP', name: 'Guadeloupe', sov: 'Frankreich', status: FDOM, su: ['GLP'], iso: 'gp', tld: '.gp', flag: null, cont: 'nordamerika' },
  { code: 'MTQ', name: 'Martinique', sov: 'Frankreich', status: FDOM, su: ['MTQ'], iso: 'mq', tld: '.mq', flag: null, cont: 'nordamerika' },
  { code: 'REU', name: 'Réunion', sov: 'Frankreich', status: FDOM, su: ['REU'], iso: 're', tld: '.re', flag: null, cont: 'afrika', aliases: ['La Réunion'] },
  { code: 'MYT', name: 'Mayotte', sov: 'Frankreich', status: FDOM, note: 'Wird von den Komoren beansprucht.', su: ['MYT'], iso: 'yt', tld: '.yt', flag: null, cont: 'afrika' },
  { code: 'SPM', name: 'Saint-Pierre und Miquelon', sov: 'Frankreich', status: FCOM, su: ['SPM'], iso: 'pm', tld: '.pm', flag: null, cont: 'nordamerika', aliases: ['St. Pierre und Miquelon'] },
  { code: 'BLM', name: 'Saint-Barthélemy', sov: 'Frankreich', status: FCOM, su: ['BLM'], iso: 'bl', tld: null, flag: null, cont: 'nordamerika', aliases: ['St. Barth'] },
  { code: 'MAF', name: 'Saint-Martin', sov: 'Frankreich', status: `${FCOM} (Nordteil der Insel St. Martin)`, su: ['MAF'], iso: 'mf', tld: null, flag: null, cont: 'nordamerika' },
  { code: 'WLF', name: 'Wallis und Futuna', sov: 'Frankreich', status: FCOM, su: ['WLF'], iso: 'wf', tld: '.wf', flag: null, cont: 'ozeanien' },
  { code: 'PYF', name: 'Französisch-Polynesien', sov: 'Frankreich', status: `${FCOM} (Überseeland)`, su: ['PYF'], iso: 'pf', tld: '.pf', flag: 'pf', cont: 'ozeanien', aliases: ['Tahiti'] },
  { code: 'NCL', name: 'Neukaledonien', sov: 'Frankreich', status: 'Französisches Gebiet mit Sonderstatus', su: ['NCL'], iso: 'nc', tld: '.nc', flag: null, cont: 'ozeanien' },
  { code: 'ATF', name: 'Französische Süd- und Antarktisgebiete', sov: 'Frankreich', status: 'Französisches Überseegebiet (Kerguelen, Crozet, Amsterdam, St. Paul, Îles Éparses)', su: '@ATF', iso: 'tf', tld: '.tf', flag: 'tf', cont: 'afrika', aliases: ['TAAF', 'Kerguelen'] },
  { code: 'CLP', name: 'Clipperton-Insel', sov: 'Frankreich', status: 'Staatseigentum Frankreichs (unbewohnt)', su: ['CLP'], iso: null, tld: null, flag: null, cont: 'nordamerika', aliases: ['Clipperton'] },

  // Niederlande
  { code: 'ABW', name: 'Aruba', sov: 'Königreich der Niederlande', status: NLLAND, su: ['ABW'], iso: 'aw', tld: '.aw', flag: 'aw', cont: 'nordamerika' },
  { code: 'CUW', name: 'Curaçao', sov: 'Königreich der Niederlande', status: NLLAND, su: ['CUW'], iso: 'cw', tld: '.cw', flag: 'cw', cont: 'nordamerika', aliases: ['Curacao'] },
  { code: 'SXM', name: 'Sint Maarten', sov: 'Königreich der Niederlande', status: `${NLLAND} (Südteil der Insel St. Martin)`, su: ['SXM'], iso: 'sx', tld: '.sx', flag: 'sx', cont: 'nordamerika' },
  { code: 'BES', name: 'Karibische Niederlande', sov: 'Niederlande', status: 'Besondere Gemeinden der Niederlande (Bonaire, Sint Eustatius, Saba)', su: ['NLY'], iso: 'bq', tld: null, flag: null, cont: 'nordamerika', aliases: ['Bonaire', 'BES-Inseln'] },

  // Dänemark
  { code: 'GRL', name: 'Grönland', sov: 'Königreich Dänemark', status: 'Autonomer Landesteil des Königreichs Dänemark', su: ['GRL'], iso: 'gl', tld: '.gl', flag: 'gl', cont: 'nordamerika' },
  { code: 'FRO', name: 'Färöer', sov: 'Königreich Dänemark', status: 'Autonomer Landesteil des Königreichs Dänemark', su: ['FRO'], iso: 'fo', tld: '.fo', flag: 'fo', cont: 'europa', aliases: ['Färöer-Inseln', 'Färöerinseln'] },

  // Norwegen
  { code: 'SJM', name: 'Spitzbergen', sov: 'Norwegen', status: 'Teil Norwegens mit Sonderstatus (Spitzbergen-Vertrag)', su: ['NSV'], iso: 'sj', tld: null, flag: null, cont: 'europa', aliases: ['Svalbard'] },
  { code: 'NJM', name: 'Jan Mayen', sov: 'Norwegen', status: 'Teil Norwegens (eigene Verwaltung)', su: ['NJM'], iso: null, tld: null, flag: null, cont: 'europa' },
  { code: 'BVT', name: 'Bouvetinsel', sov: 'Norwegen', status: 'Norwegisches Nebenland (unbewohnt)', su: ['BVT'], iso: 'bv', tld: null, flag: null, cont: 'antarktis', aliases: ['Bouvet'] },

  // Vereinigte Staaten
  { code: 'PRI', name: 'Puerto Rico', sov: 'Vereinigte Staaten', status: `${USTERR} (Commonwealth)`, su: ['PRI'], iso: 'pr', tld: '.pr', flag: 'pr', cont: 'nordamerika' },
  { code: 'VIR', name: 'Amerikanische Jungferninseln', sov: 'Vereinigte Staaten', status: USTERR, su: ['VIR'], iso: 'vi', tld: '.vi', flag: 'vi', cont: 'nordamerika' },
  { code: 'GUM', name: 'Guam', sov: 'Vereinigte Staaten', status: USTERR, su: ['GUM'], iso: 'gu', tld: '.gu', flag: 'gu', cont: 'ozeanien' },
  { code: 'MNP', name: 'Nördliche Marianen', sov: 'Vereinigte Staaten', status: `${USTERR} (Commonwealth)`, su: ['MNP'], iso: 'mp', tld: '.mp', flag: 'mp', cont: 'ozeanien' },
  { code: 'ASM', name: 'Amerikanisch-Samoa', sov: 'Vereinigte Staaten', status: USTERR, su: ['ASM'], iso: 'as', tld: '.as', flag: 'as', cont: 'ozeanien' },
  { code: 'UM-JQ', name: 'Johnston-Atoll', sov: 'Vereinigte Staaten', status: USMINOR, su: ['JQI'], iso: null, tld: null, flag: null, cont: 'ozeanien', aliases: ['Johnston'] },
  { code: 'UM-DQ', name: 'Jarvisinsel', sov: 'Vereinigte Staaten', status: USMINOR, su: ['DQI'], iso: null, tld: null, flag: null, cont: 'ozeanien', aliases: ['Jarvis'] },
  { code: 'UM-FQ', name: 'Bakerinsel', sov: 'Vereinigte Staaten', status: USMINOR, su: ['FQI'], iso: null, tld: null, flag: null, cont: 'ozeanien', aliases: ['Baker'] },
  { code: 'UM-HQ', name: 'Howlandinsel', sov: 'Vereinigte Staaten', status: USMINOR, su: ['HQI'], iso: null, tld: null, flag: null, cont: 'ozeanien', aliases: ['Howland'] },
  { code: 'UM-WQ', name: 'Wake', sov: 'Vereinigte Staaten', status: `${USMINOR}; von den Marshallinseln beansprucht`, su: ['WQI', 'PGA'], iso: null, tld: null, flag: null, cont: 'ozeanien', aliases: ['Wakeinsel', 'Wake Island'] },
  { code: 'UM-MQ', name: 'Midwayinseln', sov: 'Vereinigte Staaten', status: USMINOR, su: ['MQI'], iso: null, tld: null, flag: null, cont: 'ozeanien', aliases: ['Midway'] },
  { code: 'UM-LQ', name: 'Palmyra', sov: 'Vereinigte Staaten', status: 'Inkorporiertes Außengebiet der USA (unbewohnt)', su: ['LQI'], iso: null, tld: null, flag: null, cont: 'ozeanien', aliases: ['Palmyra-Atoll'] },
  { code: 'UM-KQ', name: 'Kingmanriff', sov: 'Vereinigte Staaten', status: USMINOR, su: ['KQI'], iso: null, tld: null, flag: null, cont: 'ozeanien', aliases: ['Kingman Reef'] },
  { code: 'UM-BQ', name: 'Navassa', sov: 'Vereinigte Staaten', status: `${USMINOR}; von Haiti beansprucht`, su: ['BQI'], iso: null, tld: null, flag: null, cont: 'nordamerika', aliases: ['Navassa-Insel'] },

  // Australien
  { code: 'CXR', name: 'Weihnachtsinsel', sov: 'Australien', status: AUEXT, su: ['CXR'], iso: 'cx', tld: '.cx', flag: 'cx', cont: 'asien', aliases: ['Christmas Island'] },
  { code: 'CCK', name: 'Kokosinseln', sov: 'Australien', status: AUEXT, su: ['CCK'], iso: 'cc', tld: '.cc', flag: 'cc', cont: 'asien', aliases: ['Keelinginseln', 'Cocos Islands'] },
  { code: 'NFK', name: 'Norfolkinsel', sov: 'Australien', status: AUEXT, su: ['NFK'], iso: 'nf', tld: '.nf', flag: 'nf', cont: 'ozeanien', aliases: ['Norfolk Island'] },
  { code: 'HMD', name: 'Heard und McDonaldinseln', sov: 'Australien', status: `${AUEXT} (unbewohnt)`, su: ['HMD'], iso: 'hm', tld: '.hm', flag: null, cont: 'antarktis' },
  { code: 'ATC', name: 'Ashmore- und Cartierinseln', sov: 'Australien', status: `${AUEXT} (unbewohnt)`, su: ['ATC'], iso: null, tld: null, flag: null, cont: 'ozeanien' },
  { code: 'CSI', name: 'Korallenmeerinseln', sov: 'Australien', status: AUEXT, su: ['CSI'], iso: null, tld: null, flag: null, cont: 'ozeanien' },

  // Neuseeland
  { code: 'COK', name: 'Cookinseln', sov: 'Neuseeland', status: 'Selbstverwaltet in freier Assoziierung mit Neuseeland', su: ['COK'], iso: 'ck', tld: '.ck', flag: 'ck', cont: 'ozeanien' },
  { code: 'NIU', name: 'Niue', sov: 'Neuseeland', status: 'Selbstverwaltet in freier Assoziierung mit Neuseeland', su: ['NIU'], iso: 'nu', tld: '.nu', flag: 'nu', cont: 'ozeanien' },
  { code: 'TKL', name: 'Tokelau', sov: 'Neuseeland', status: 'Außengebiet Neuseelands', su: ['TKL'], iso: 'tk', tld: '.tk', flag: 'tk', cont: 'ozeanien' },

  // China, Finnland, Portugal, Spanien
  { code: 'HKG', name: 'Hongkong', sov: 'Volksrepublik China', status: 'Sonderverwaltungszone der Volksrepublik China', su: ['HKG'], iso: 'hk', tld: '.hk', flag: 'hk', cont: 'asien', aliases: ['Hong Kong'] },
  { code: 'MAC', name: 'Macau', sov: 'Volksrepublik China', status: 'Sonderverwaltungszone der Volksrepublik China', su: ['MAC'], iso: 'mo', tld: '.mo', flag: 'mo', cont: 'asien', aliases: ['Macao'] },
  { code: 'ALA', name: 'Åland', sov: 'Finnland', status: 'Autonome Region Finnlands', su: ['ALD'], iso: 'ax', tld: '.ax', flag: 'ax', cont: 'europa', aliases: ['Aland', 'Ålandinseln'] },
  { code: 'PAZ', name: 'Azoren', sov: 'Portugal', status: 'Autonome Region Portugals', su: ['PAZ'], iso: null, tld: null, flag: null, cont: 'europa' },
  { code: 'PMD', name: 'Madeira', sov: 'Portugal', status: 'Autonome Region Portugals', su: ['PMD'], iso: null, tld: null, flag: null, cont: 'afrika' },
  { code: 'ESC', name: 'Kanarische Inseln', sov: 'Spanien', status: 'Autonome Gemeinschaft Spaniens', su: ['ESC'], iso: 'ic', tld: null, flag: 'ic', cont: 'afrika', aliases: ['Kanaren'] },
  { code: 'SEC', name: 'Ceuta', sov: 'Spanien', status: 'Autonome Stadt Spaniens in Nordafrika', su: ['SEC'], iso: null, tld: null, flag: null, cont: 'afrika' },
  { code: 'SEM', name: 'Melilla', sov: 'Spanien', status: 'Autonome Stadt Spaniens in Nordafrika', su: ['SEM'], iso: null, tld: null, flag: null, cont: 'afrika' },

  // Ungeklärt
  { code: 'ESH', name: 'Westsahara', sov: 'umstritten', status: 'Status ungeklärt – größtenteils von Marokko kontrolliert, von der Polisario (DARS) beansprucht', su: ['SAH'], iso: 'eh', tld: null, flag: null, cont: 'afrika' },
]

/* ───────────── Vorwahlen ───────────── */
// Länder mit gemeinsamer Vorwahl werden zu einem Eintrag zusammengefasst.
export const VORWAHL_FIX = {
  SRB: '381',
  VAT: '39', // nutzt +39 06 698 (Italien); +379 ist reserviert, aber nicht in Betrieb
  KOS: '383',
  SDS: '211',
}
export const VORWAHL_NOTE = {
  VAT: 'Vatikanstadt nutzt das italienische Netz (+39 06 698…). Die eigene Vorwahl +379 ist reserviert, aber nicht in Betrieb.',
  KAZ: 'Kasachstan teilt sich +7 mit Russland (eigene Bereiche +7 0, +7 6 und +7 7). Ein Wechsel auf +997 wurde 2023 verworfen.',
  DOM: 'Die Dominikanische Republik hat drei Vorwahlen: +1 809, +1 829 und +1 849.',
}
export const VORWAHL_EXTRA_ALIASES = { DOM: ['+1 829', '+1 849', '1829', '1849'] }

/* ───────────── Meere ───────────── */

/** Stufe 1 (normal): Ozeane + die bekanntesten Nebenmeere (Natural-Earth-Namen) */
export const MEER_STUFE1 = new Set([
  'Arctic Ocean', 'SOUTHERN OCEAN', 'North Atlantic Ocean', 'South Atlantic Ocean', 'North Pacific Ocean', 'South Pacific Ocean', 'INDIAN OCEAN',
  'Bay of Bengal', 'Hudson Bay', 'Baffin Bay', 'Gulf of Mexico', 'Gulf of Alaska', 'Persian Gulf', 'Black Sea', 'Philippine Sea', 'Tasman Sea',
  'South China Sea', 'Arabian Sea', 'Beaufort Sea', 'Caribbean Sea', 'Labrador Sea', 'Caspian Sea', 'Red Sea', 'Sea of Okhotsk', 'Weddell Sea',
  'Mediterranean Sea', 'Ross Sea', 'Coral Sea', 'Sea of Japan', 'North Sea', 'Baltic Sea', 'Bering Sea', 'Barents Sea', 'East China Sea',
  'Yellow Sea', 'Norwegian Sea', 'Gulf of Guinea',
])
/** Natural-Earth-Klassen, die nicht abgefragt werden (Flussmündungen, unbenannte Flächen) */
export const MEER_RAUS_KLASSE = new Set(['river', 'generic'])

/** Die Ozeane (Nord-/Südteil werden zusammengelegt) */
export const OZEAN = {
  'Arctic Ocean': 'Arktischer Ozean',
  'SOUTHERN OCEAN': 'Südlicher Ozean',
  'North Atlantic Ocean': 'Atlantischer Ozean',
  'South Atlantic Ocean': 'Atlantischer Ozean',
  'North Pacific Ocean': 'Pazifischer Ozean',
  'South Pacific Ocean': 'Pazifischer Ozean',
  'INDIAN OCEAN': 'Indischer Ozean',
}
/** Zuordnung zu einem Ozean nach der IHO (wo die Nachbarschaft allein etwas anderes ergeben würde) */
export const MEER_PARENT = {
  'Hudson Bay': 'Arktischer Ozean',
  'Hudson Strait': 'Arktischer Ozean',
}
export const OZEAN_ALIAS = {
  'Arktischer Ozean': ['Arktis', 'Nordpolarmeer', 'Nördliches Eismeer'],
  'Südlicher Ozean': ['Südpolarmeer', 'Antarktischer Ozean'],
  'Atlantischer Ozean': ['Atlantik'],
  'Pazifischer Ozean': ['Pazifik', 'Stiller Ozean'],
  'Indischer Ozean': ['Indik'],
}
export const OZEAN_FARBE = {
  'Atlantischer Ozean': '#3b82f6', 'Pazifischer Ozean': '#14b8a6', 'Indischer Ozean': '#eab308', 'Arktischer Ozean': '#38bdf8', 'Südlicher Ozean': '#a855f7',
}

/** Korrekturen der deutschen Namen aus Natural Earth (NE-Name → deutsch) */
export const MEER_NAME = {
  'Norwegian Sea': 'Europäisches Nordmeer',
  'Bight of Biafra': 'Bucht von Biafra',
  'St. Helena Bay': 'St.-Helena-Bucht',
  'Baía de São Marcos': 'Baía de São Marcos',
  'Gulf of Yana': 'Janabucht',
  "Gulf of Olen‘k": 'Olenjokbucht',
  'Gulf of Kamchatka': 'Kamtschatkagolf',
  'Kronotskiy Gulf': 'Kronozki-Golf',
  'Lagoa dos Patos': 'Lagoa dos Patos',
  'Inner Seas': 'Hebridensee',
  'Weddell Sea': 'Weddellmeer',
  'Bellingshausen Sea': 'Bellingshausenmeer',
  'Zāgros': 'Zagros',
  'Kaliningrad': 'Frisches Haff',
  'Great Barrier Reef': 'Great Barrier Reef',
  'Saint Lawrence River': 'Sankt-Lorenz-Strom (Mündung)',
  'Gulf of Masira': 'Golf von Masira',
  'Gulf of Buli': 'Golf von Buli',
  'Gulf of Kau': 'Golf von Kau',
  'Golfo de Tehuantepec': 'Golf von Tehuantepec',
  'Golfo San Matías': 'Golf von San Matías',
  'Ozero Mogotoyevo': 'Mogotojewo-See',
  'Guba Gusinaya': 'Gänsebucht (Guba Gussinaja)',
  'Bay Inútil': 'Bahía Inútil',
  'Seno de Skyring': 'Seno Skyring',
  'Prince ALbert Sound': 'Prince Albert Sound',
  'Bahía de Campeche': 'Golf von Campeche',
  'Sea of Japan': 'Japanisches Meer',
  'The North Western Passages': 'Nordwestpassage',
}
export const MEER_ALIAS = {
  'Europäisches Nordmeer': ['Norwegische See', 'Nordmeer'],
  'Bucht von Biafra': ['Bucht von Bonny'],
  'Japanisches Meer': ['Ostmeer'],
  'Kaspisches Meer': ['Kaspisee'],
  'Persischer Golf': ['Arabischer Golf'],
  'Karibisches Meer': ['Karibik'],
  'Ärmelkanal': ['Englischer Kanal'],
  'Golf von Bengalen': ['Bucht von Bengalen'],
  'Bottnischer Meerbusen': ['Bottnischer Golf'],
  'Mindanaosee': ['Boholsee'],
  'Frisches Haff': ['Weichselhaff'],
}
export const MEER_NOTE = {
  'Kaspisches Meer': 'Eigentlich der größte See der Erde – wird aber "Meer" genannt.',
  'Sargassosee': 'Das einzige Meer ohne Küste – begrenzt nur durch Meeresströmungen.',
}

/* ───────────── Gebirge ───────────── */

/** Stufe 1: die großen Gebirge (Natural-Earth-Namen) */
export const GEBIRGE_STUFE1 = new Set([
  'ALPS', 'ANDES', 'HIMALAYAS', 'ROCKY MOUNTAINS', 'URAL MOUNTAINS', 'CAUCASUS MTS.', 'TIAN SHAN', 'GREAT DIVIDING RANGE', 'Transantarctic Mountains',
  'ETHIOPIAN HIGHLANDS', 'ZAGROS MOUNTAINS', 'ALTAY MOUNTAINS', 'PAMIRS', 'HINDU KUSH', 'KARAKORAM RA.', 'KUNLUN MOUNTAINS', 'ATLAS MOUNTAINS',
  'APPALACHIAN MTS.', 'BROOKS RANGE', 'COAST MOUNTAINS', 'CASCADE RANGE', 'ALASKA RANGE', 'GREATER KHINGAN RANGE', 'STANOVOY RANGE',
  'CHAÎNE ANNAMITIQUE', 'DRAKENSBERG', 'KJØLEN MOUNTAINS', 'CARPATHIAN MOUNTAINS', 'APPENNINI', 'PYRENEES', 'SIERRA MADRE ORIENTAL',
  'SIERRA MADRE OCCIDENTAL', 'WESTERN GHATS', 'EASTERN GHATS', 'VERKHOYANSK RANGE', 'SOUTHERN ALPS', 'Dinaric Alps', 'Balkan Mts.', 'Taurus Mts.',
  'ELBURZ MTS.', 'Harz', 'Erzgebirge',
])
/** Natural-Earth-Name → deutscher Name (wo der NE-Name falsch oder unglücklich ist) */
export const GEBIRGE_NAME = {
  'APPENNINI': 'Apennin',
  'ZAGROS MOUNTAINS': 'Zagros',
  'ELBURZ MTS.': 'Elburs',
  'CRYSTAL MOUNTAINS': 'Kristallgebirge',
  'MITUMBA MTS.': 'Mitumba-Gebirge',
  'TORNGAT MTS.': 'Torngat Mountains',
  'NEW GUINEA HIGHLANDS': 'Neuguinea-Hochland',
  'Chin Hills': 'Chin Hills',
  'Hamgyong Mts.': 'Hamgyŏng-Gebirge',
  'Central Highlands': 'Zentrales Hochland (Vietnam)',
  'Southern Ghats': 'Südliche Ghats',
  'Calabria': 'Kalabrischer Apennin',
  'Al Jabal al Akhdar': 'Dschabal al-Achdar (Libyen)',
  'Kopet Dag Mts .': 'Kopet-Dag',
  'Paropamisus Ra.': 'Paropamisus',
  'Queen Maude Mountains': 'Königin-Maud-Gebirge',
  'Queen Maud Mountains': 'Königin-Maud-Gebirge',
  'Karatau Range': 'Karatau',
  'Sulaiman Ra.': 'Sulaimangebirge',
  'Inyanga Mts.': 'Inyanga-Berge',
  'COAST RANGES': 'Pazifisches Küstengebirge',
  'CORD. CENTRAL': 'Cordillera Central',
  'CORD. OCCIDENTAL': 'Cordillera Occidental',
  'CORDILLERA  REAL': 'Cordillera Real',
  'SIERRA NEVADA': 'Sierra Nevada',
  'S. Nevada': 'Sierra Nevada',
  'Central Bruhui Range': 'Brahui-Gebirge',
  'Central Makran': 'Makran-Gebirge',
  'Hardanger-vidda': 'Hardangervidda',
  'GUIANA HIGHLANDS': 'Bergland von Guayana',
  'Siwalik Hills': 'Siwaliks',
  'Groot Karasberge': 'Große Karasberge',
  'Chaîne des Mongos': 'Bongo-Massiv',
  'S. do Piaui': 'Serra do Piauí',
  'Serra Acaraí': 'Acaraí-Gebirge',
  'Tannu-Ola Ra.': 'Tannu-ola',
  'Alataw Mts.': 'Dsungarischer Alatau',
  'Borohoro Mts.': 'Borohoro Shan',
}
export const GEBIRGE_ALIAS = {
  'Himalaya': ['Himalaja'],
  'Rocky Mountains': ['Rockies', 'Felsengebirge'],
  'Skandinavisches Gebirge': ['Skanden', 'Kjölen'],
  'Hochland von Abessinien': ['Äthiopisches Hochland'],
  'Großes Hinggan-Gebirge': ['Großer Chingan', 'Großes Khingan-Gebirge'],
  'Truong-Son-Gebirge': ['Annamitische Kordillere', 'Annamitisches Gebirge'],
  'Kaukasus': ['Großer Kaukasus'],
  'Apennin': ['Apenninen'],
  'Dinarisches Gebirge': ['Dinariden', 'Dinarische Alpen'],
  'Pyrenäen': ['Pyrenäen-Gebirge'],
  'Karakorum': ['Karakoram'],
}
/** Kein echtes Gebirge oder doppelt → weglassen */
export const GEBIRGE_RAUS = new Set([])

/** Natural-Earth-Region → Gruppe */
export const NE_REGION = {
  Europe: 'europa', Asia: 'asien', Africa: 'afrika', 'North America': 'nordamerika', 'South America': 'suedamerika', Oceania: 'ozeanien', Antarctica: 'antarktis',
}

/* ───────────── Gipfel ───────────── */
// Höhen: Natural Earth, korrigiert nach den heute gültigen Messungen (z.B. Everest 8849 m seit 2020).

/** Fehlende Achttausender (Koordinaten [Länge, Breite]) */
export const ACHTTAUSENDER_EXTRA = [
  { name: 'Lhotse', ll: [86.933, 27.962], h: 8516, region: 'asien' },
  { name: 'Makalu', ll: [87.089, 27.890], h: 8485, region: 'asien' },
  { name: 'Cho Oyu', ll: [86.661, 28.094], h: 8188, region: 'asien' },
  { name: 'Manaslu', ll: [84.560, 28.550], h: 8163, region: 'asien' },
  { name: 'Annapurna I', ll: [83.820, 28.596], h: 8091, region: 'asien', aliases: ['Annapurna'] },
  { name: 'Gasherbrum I', ll: [76.696, 35.724], h: 8080, region: 'asien', aliases: ['Hidden Peak'] },
  { name: 'Broad Peak', ll: [76.568, 35.811], h: 8051, region: 'asien' },
  { name: 'Gasherbrum II', ll: [76.653, 35.758], h: 8035, region: 'asien' },
  { name: 'Shishapangma', ll: [85.780, 28.353], h: 8027, region: 'asien', aliases: ['Xixabangma'] },
]
export const ACHTTAUSENDER = new Set(['Mount Everest', 'K2', 'Kangchendzönga', 'Lhotse', 'Makalu', 'Cho Oyu', 'Dhaulagiri', 'Manaslu', 'Nanga Parbat', 'Annapurna I', 'Gasherbrum I', 'Broad Peak', 'Gasherbrum II', 'Shishapangma'])
/** Seven Summits (höchster Berg jedes Kontinents; Ozeanien in beiden Varianten) + berühmte Gipfel für die normale Stufe */
export const GIPFEL_STUFE1 = new Set(['Mount Everest', 'K2', 'Aconcagua', 'Denali', 'Kilimandscharo', 'Elbrus', 'Vinson-Massiv', 'Carstensz-Pyramide', 'Mount Kosciuszko', 'Mont Blanc', 'Matterhorn', 'Zugspitze', 'Fuji', 'Ätna', 'Kangchendzönga', 'Nanga Parbat'])
export const SEVEN_SUMMITS = {
  'Mount Everest': 'Höchster Berg Asiens und der Erde',
  'Aconcagua': 'Höchster Berg Südamerikas (und von Amerika)',
  'Denali': 'Höchster Berg Nordamerikas',
  'Kilimandscharo': 'Höchster Berg Afrikas',
  'Elbrus': 'Höchster Berg Europas (wenn der Kaukasus zu Europa zählt)',
  'Mont Blanc': 'Höchster Berg der Alpen und der EU',
  'Vinson-Massiv': 'Höchster Berg der Antarktis',
  'Carstensz-Pyramide': 'Höchster Berg Ozeaniens (Neuguinea)',
  'Mount Kosciuszko': 'Höchster Berg des australischen Festlands',
  'Zugspitze': 'Höchster Berg Deutschlands',
}
/** Name/Höhe korrigieren: NE-Name (+ gerundete NE-Höhe bei Doppelnamen) → Werte */
export const GIPFEL_FIX = {
  'Mount Everest': { h: 8849, aliases: ['Everest', 'Sagarmatha', 'Chomolungma', 'Qomolangma'] },
  'Dhaulagiri': { h: 8167 },
  'Kanchenjunga': { aliases: ['Kanchenjunga', 'Kangchenjunga'] },
  'Mount Olympus@2917': { name: 'Olymp', aliases: ['Olymp (Griechenland)', 'Olympos'] },
  'Mount Olympus@2429': { name: 'Mount Olympus (USA)' },
  'Olympus@1951': { name: 'Olympos (Zypern)' },
  'Fuji Station (Japan)': { drop: true },
  'Pico de Santa Isabel': { name: 'Pico Basilé' },
  'Pik Pobeda': { name: 'Dschengisch Tschokusu', aliases: ['Pik Pobeda', 'Jengish Chokusu'] },
  'Pik Imeni Ismail Samani': { name: 'Pik Ismoil Somoni', aliases: ['Pik Kommunismus'] },
  'Mount Kilimanjaro': { name: 'Kilimandscharo', aliases: ['Kibo', 'Kilimanjaro'] },
  'Denali': { aliases: ['Mount McKinley'] },
  'Puncak Jaya': { name: 'Carstensz-Pyramide', aliases: ['Puncak Jaya'] },
  'Monte Etna': { name: 'Ätna', aliases: ['Etna'] },
  'Pico de Orizaba': { aliases: ['Pico de Orizaba', 'Orizaba'] },
  'Gora Elbrus': { name: 'Elbrus' },
  'Vinson Massif': { name: 'Vinson-Massiv', aliases: ['Mount Vinson'] },
  'Cerro Aconcagua': { name: 'Aconcagua' },
}

/* ───────────── Flüsse ───────────── */

/** Mehrere Natural-Earth-Abschnitte (deutsche NE-Namen) zu einem Fluss zusammenlegen */
export const FLUSS_MERGE = {
  'Jangtsekiang': ['Jangtsekiang', 'Jinsha-Fluss', 'Zhi Qu', 'Tuotuo He'],
  'Brahmaputra': ['Brahmaputra', 'Yarlung-Fluss'],
  'Jenissei': ['Jenissei', 'Kleiner Jenissei', 'Verkhniy Yenisey'],
  'Kongo': ['Kongo', 'Lualaba'],
  'Rhein': ['Rhein', 'Nederrijn', 'Lek', 'Waal'],
  'Donau': ['Donau', 'Kilijaarm', 'Sulinaarm', 'St. Georg', 'Borcea'],
  'Irrawaddy': ['Irrawaddy', "N'Mai Hka"],
  'Indus': ['Indus', 'Sênggê Zangbo'],
  'Paraná': ['Río Paraná', 'Paraná'],
  'Weißer Nil': ['Weißer Nil', 'Kagera-Nil'],
  'Nil': ['Nil', 'Rosetta Branch', 'Damietta Branch'],
  'Ottawa': ['Ottawa (Fluss)', 'Ottawa Fluss'],
  'Lena': ['Lena', 'Bykovskaya Protoka', 'Trofimovskaya Protoka', 'Tumatskaya Protoka', 'Protoka Olenëkskaya'],
  'Theiß': ['Theiß'],
  'Okavango': ['Okavango'],
  'Schari': ['Schari'],
  'Tajo': ['Tajo'],
  'Dnepr': ['Dnepr'],
}
/** Deutscher Name für Natural-Earth-Namen (wo NE keinen oder einen schlechten hat) */
export const FLUSS_NAME = {
  'Grande@USA': 'Rio Grande', 'Grande@MEX': 'Rio Grande',
  'Colorado@USA': 'Colorado', 'Colorado@MEX': 'Colorado', 'Colorado@ARG': 'Río Colorado (Argentinien)',
  'Negro@BRA': 'Rio Negro', 'Negro@COL': 'Rio Negro', 'Negro@VEN': 'Rio Negro', 'Negro@ARG': 'Río Negro (Argentinien)',
  'Gelber Fluss': 'Gelber Fluss', 'Westfluss': 'Xi Jiang', 'Saluen': 'Saluen',
  'Sankt-Lorenz-Strom': 'Sankt-Lorenz-Strom',
}
export const FLUSS_ALIAS = {
  'Jangtsekiang': ['Jangtse', 'Yangtze', 'Chang Jiang'],
  'Gelber Fluss': ['Huang He', 'Hwangho'],
  'Rio Grande': ['Río Bravo', 'Rio Bravo'],
  'Sankt-Lorenz-Strom': ['St. Lorenz', 'Sankt Lorenz'],
  'Sambesi': ['Zambezi'],
  'Kongo': ['Congo'],
  'Amudarja': ['Amu Darya', 'Oxus'],
  'Syrdarja': ['Syr Darya'],
  'Irtysch': ['Irtysh'],
  'Jenissei': ['Yenisei'],
  'Xi Jiang': ['Westfluss', 'Xi'],
  'Saluen': ['Salween', 'Nu Jiang'],
  'Dnepr': ['Dnipro'],
  'Dnister': ['Dnjestr'],
  'Themse': ['Thames'],
  'Weichsel': ['Wisła'],
  'Euphrat': ['Fırat'],
  'Düna': ['Daugava'],
  'Oranje': ['Orange'],
  'Theiß': ['Tisza'],
  'Douro': ['Duero'],
}
/** Stufe 1 (normal): große und bekannte Flüsse (deutsche Namen nach Zusammenlegung) */
export const FLUSS_STUFE1 = new Set([
  'Nil', 'Weißer Nil', 'Blauer Nil', 'Amazonas', 'Jangtsekiang', 'Mississippi', 'Missouri', 'Jenissei', 'Gelber Fluss', 'Ob', 'Irtysch', 'Paraná',
  'Kongo', 'Amur', 'Lena', 'Mekong', 'Mackenzie', 'Niger', 'Wolga', 'Murray', 'Darling', 'Sankt-Lorenz-Strom', 'Yukon', 'Rio Grande', 'Colorado',
  'Columbia', 'Donau', 'Indus', 'Brahmaputra', 'Ganges', 'Euphrat', 'Tigris', 'Sambesi', 'Oranje', 'Limpopo', 'Orinoco', 'Madeira', 'Tocantins',
  'São Francisco', 'Uruguay', 'Syrdarja', 'Amudarja', 'Ural', 'Dnepr', 'Don', 'Rhein', 'Elbe', 'Weichsel', 'Oder', 'Loire', 'Seine', 'Rhone', 'Po',
  'Themse', 'Tajo', 'Ebro', 'Kolyma', 'Angara', 'Saluen', 'Irrawaddy', 'Senegal', 'Okavango', 'Ohio', 'Xingu', 'Jordan', 'Dnister', 'Kama',
  'Petschora', 'Nördliche Dwina', 'Tarim', 'Volta', 'Fraser', 'Nelson', 'Magdalena', 'Rio Negro',
])

/* ───────────── Seen ───────────── */

export const SEE_STUFE1 = new Set([
  'Lake Superior', 'Lake Victoria', 'Lake Huron', 'Lake Michigan', 'Lake Tanganyika', 'Lake Baikal', 'Great Bear Lake', 'Lake Malawi',
  'Great Slave Lake', 'Lake Erie', 'Lake Winnipeg', 'Lake Ontario', 'Lake Ladoga', 'Lake Balkhash', 'Lake Onega', 'Lago Titicaca',
  'Lago de Nicaragua', 'Lake Athabasca', 'Reindeer Lake', 'Issyk-Kul', 'Lake Turkana', 'Lake Urmia', 'Vänern', 'Vättern', 'Lake Chad',
  'North Aral Sea', 'South Aral Sea', 'Great Salt Lake', 'Lake Albert', 'Lake Tana', 'Lake Geneva', 'Lake Balaton',
  'Lake Peipus', 'Lake Saimaa', 'Mälaren', 'Tonlé Sap', 'Qinghai Hu', 'Dead Sea', 'Lake Kivu', 'Lake Volta', 'Lake Nasser',
  'Lake Eyre North', 'Lake Taupo', 'Lake Tahoe', 'Lake Okeechobee', 'Lake Kariba', 'Lac Moeru', 'Lago di Garda', 'Bodensee',
])
export const SEE_NAME = {
  'Lake Superior': 'Oberer See',
  'Lake Eyre North': 'Lake Eyre',
  'Lake of the Woods': 'Lake of the Woods',
  'Wollaston Lake': 'Wollastonsee',
  'Reindeer Lake': 'Reindeer Lake',
  'Lake Saint Clair': 'Lake St. Clair',
  'Lagoa Mirim': 'Lagoa Mirim',
  'Issyk-Kul': 'Yssykköl',
  'North Aral Sea': 'Aralsee',
  'South Aral Sea': 'Aralsee',
  'Georgian Bay': 'Georgian Bay',
  'McLeod Bay': 'McLeod Bay',
  'Lake Balaton': 'Plattensee',
  'Lake Turkana': 'Turkanasee',
  'Lake Taupo': 'Tauposee',
  'Lake Kariba': 'Karibasee',
  'Qinghai Hu': 'Qinghai-See',
  'Lac Moeru': 'Mwerusee',
  'Tonlé Sap': 'Tonle Sap',
  'Lake Saimaa': 'Saimaa',
  'Lake Tahoe': 'Lake Tahoe',
  'Wollaston Lake': 'Wollastonsee',
}
export const SEE_ALIAS = {
  'Oberer See': ['Lake Superior'],
  'Yssykköl': ['Issyk-Kul', 'Issyk Kul'],
  'Victoriasee': ['Viktoriasee'],
  'Genfersee': ['Lac Léman', 'Genfer See'],
  'Bodensee': ['Lake Constance'],
  'Plattensee': ['Balaton', 'Lake Balaton'],
  'Gardasee': ['Lago di Garda'],
  'Titicacasee': ['Titicaca'],
  'Tanganjikasee': ['Tanganyika'],
  'Malawisee': ['Njassasee', 'Nyasasee'],
  'Turkanasee': ['Rudolfsee'],
  'Peipussee': ['Peipsi'],
}

/* ───────────── Wüsten ───────────── */

export const WUESTE_RAUS = new Set(['PUNJAB', 'CAATINGAS', 'Jabal as Sawdä’', 'Big Bend'])
export const WUESTE_NAME = {
  'BETPAQDALA DESERT': 'Betpak-Dala',
  'Mu Us Desert': 'Mu-Us-Wüste',
  'White Sands': 'White Sands',
  'Negev Desert': 'Negev',
  'Danakil': 'Danakil-Wüste',
  'Wahiba Sands': 'Wahiba Sands',
  'Margo Desert': 'Dascht-e Margo',
  'Sarïr Kalanshiyu ar Ramli al Kabi': 'Kalanshiyu-Sandsee',
  'Eastern Desert': 'Arabische Wüste (Ägypten)',
  'Jabal bin Ghunaymah': 'Dschabal bin Ghunaimah',
}
export const WUESTE_ALIAS = {
  'Rub al-Chali': ['Rub al Khali', 'Leeres Viertel'],
  'Taklamakan': ['Taklimakan'],
  'Karakum': ['Garagum'],
  'Kysylkum': ['Kyzylkum'],
  'Atacamawüste': ['Atacama'],
  'Betpak-Dala': ['Hungersteppe'],
  'Dascht-e Lut': ['Lut'],
  'Kawir': ['Dascht-e Kawir', 'Große Salzwüste (Iran)'],
  'Nefud': ['An-Nafud'],
}
export const WUESTE_NOTE = {
  'Antarktika': 'Nach Niederschlag ist die Antarktis die größte Wüste der Erde.',
}

/* ───────────── Millionenstädte ───────────── */
// Quelle: GeoNames (Einwohner im Stadtgebiet). Herausgenommen: Stadtbezirke/Ortsteile und offensichtliche Fehleinträge,
// bei denen GeoNames die Einwohnerzahl eines ganzen Bezirks/Landkreises an einen kleinen Ort hängt.

export const STADT_RAUS = new Set([
  5110302, 5133273, 5125771, 5110266, // Brooklyn, Queens, Manhattan, The Bronx (Bezirke von New York)
  3526683, 3514674, // Iztapalapa, Gustavo A. Madero (Bezirke von Mexiko-Stadt)
  13308620, // Bao'an (Bezirk von Shenzhen)
  2293521, // Abobo (Stadtteil von Abidjan)
  2422488, // Camayenne (Stadtteil von Conakry)
  1262111, // Najafgarh (Teil von Delhi)
  953781, // Soweto (Teil von Johannesburg)
  7626690, 1259652, // Pimpri-Chinchwad (doppelt), Pimpri – Pune-Umland, GeoNames-Zahl unsicher → raus
  1258393, // Rasapūdipalem (Fehleintrag)
  12165956, // Kallakurichi (Distrikt-Zahl an Kleinstadt)
  1261162, // Nowrangapur (Distrikt-Zahl an Kleinstadt)
  1270926, // Gorakhpur in Haryana (Fehleintrag, Dorf)
  195272, // Kakamega (County-Zahl)
  1723510, // Budta (Fehleintrag)
  1978681, // Malingao (Fehleintrag)
  1798425, // Puyang in Zhejiang (Fehleintrag)
  12358576, // Wanzhou (Bezirk von Chongqing)
  1808316, // Heshan in Hunan (Fehleintrag)
  1802875, // Guankou (Fehleintrag)
  13512505, // Lüliang (Bezirksstadt, Zahl für den ganzen Bezirk)
  1785725, // Yunfu (Bezirksstadt, Zahl für den ganzen Bezirk)
  11838258, // Bayan Nur (ganze Bezirksstadt)
  12359313, // Qingyang (ganze Bezirksstadt)
  1272423, // Dombivali (Teil von Kalyan-Dombivli)
])
/** Fehlen in GeoNames bzw. liegen dort knapp unter 1 Mio., haben laut aktueller Zählung aber über 1 Mio. Einwohner */
export const STADT_EXTRA = [
  { name: 'Köln', iso: 'DE', ll: [6.958, 50.938], pop: 1024621, note: 'Destatis, 31.12.2023' },
  { name: 'Ulaanbaatar', iso: 'MN', ll: [106.917, 47.919], pop: 1691000, note: 'Statistikamt der Mongolei, 2023', aliases: ['Ulan Bator'] },
  { name: 'Bischkek', iso: 'KG', ll: [74.590, 42.870], pop: 1145000, note: 'Statistikamt Kirgisistan, 2022' },
  { name: 'Perm', iso: 'RU', ll: [56.250, 58.010], pop: 1034002, note: 'Russische Volkszählung 2021' },
  { name: 'Ghom', iso: 'IR', ll: [50.876, 34.640], pop: 1201158, note: 'Iranische Volkszählung 2016', aliases: ['Qom'] },
  { name: 'Ahvaz', iso: 'IR', ll: [48.669, 31.320], pop: 1184788, note: 'Iranische Volkszählung 2016', aliases: ['Ahwas'] },
]

/* ───────────── Flughäfen ───────────── */
// Die 50 passagierstärksten Flughäfen 2024 (Airports Council International, Stand Juli 2025). Passagiere in Mio.

export const FLUGHAFEN_TOP = [
  ['ATL', 'Atlanta', 108.1], ['DXB', 'Dubai', 92.3], ['DFW', 'Dallas/Fort Worth', 87.8], ['HND', 'Tokio-Haneda', 85.9],
  ['LHR', 'London-Heathrow', 83.9], ['DEN', 'Denver', 82.4], ['IST', 'Istanbul', 80.1], ['ORD', "Chicago O'Hare", 80.0],
  ['DEL', 'Delhi', 77.8], ['PVG', 'Shanghai-Pudong', 76.8], ['LAX', 'Los Angeles', 76.6], ['CAN', 'Guangzhou', 76.4],
  ['ICN', 'Seoul-Incheon', 71.2], ['CDG', 'Paris-Charles-de-Gaulle', 70.3], ['SIN', 'Singapur-Changi', 67.7], ['PEK', 'Peking-Hauptstadt', 67.4],
  ['AMS', 'Amsterdam-Schiphol', 66.8], ['MAD', 'Madrid-Barajas', 66.1], ['JFK', 'New York JFK', 63.3], ['BKK', 'Bangkok-Suvarnabhumi', 62.2],
  ['FRA', 'Frankfurt', 61.6], ['SZX', 'Shenzhen', 61.5], ['CLT', 'Charlotte', 58.8], ['LAS', 'Las Vegas', 58.4], ['MCO', 'Orlando', 57.2],
  ['KUL', 'Kuala Lumpur', 57.0], ['MIA', 'Miami', 55.9], ['BCN', 'Barcelona', 55.0], ['TFU', 'Chengdu-Tianfu', 54.9], ['BOM', 'Mumbai', 54.8],
  ['CGK', 'Jakarta', 54.8], ['HKG', 'Hongkong', 53.1], ['DOH', 'Doha', 52.7], ['SEA', 'Seattle', 52.6], ['PHX', 'Phoenix', 52.3],
  ['SFO', 'San Francisco', 52.3], ['MNL', 'Manila', 50.1], ['PKX', 'Peking-Daxing', 49.4], ['JED', 'Dschidda', 49.1], ['FCO', 'Rom-Fiumicino', 48.9],
  ['EWR', 'Newark', 48.9], ['CKG', 'Chongqing', 48.7], ['IAH', 'Houston', 48.4], ['HGH', 'Hangzhou', 48.1], ['SHA', 'Shanghai-Hongqiao', 47.9],
  ['KMG', 'Kunming', 47.2], ['XIY', "Xi'an", 47.0], ['YYZ', 'Toronto', 46.8], ['BOG', 'Bogotá', 45.8], ['MEX', 'Mexiko-Stadt', 45.4],
]
export const FLUGHAFEN_ALIAS = {
  LHR: ['Heathrow', 'London'], HND: ['Haneda', 'Tokio', 'Tokyo'], CDG: ['Paris', 'Charles de Gaulle', 'Roissy'], PEK: ['Peking', 'Beijing Capital'],
  PKX: ['Daxing', 'Beijing Daxing'], PVG: ['Pudong', 'Shanghai'], SHA: ['Hongqiao'], JFK: ['JFK', 'New York', 'John F. Kennedy'], ORD: ["O'Hare", 'Chicago'],
  DFW: ['Dallas', 'Dallas Fort Worth'], ICN: ['Incheon', 'Seoul'], SIN: ['Changi', 'Singapur', 'Singapore'], AMS: ['Schiphol', 'Amsterdam'],
  MAD: ['Barajas', 'Madrid'], BKK: ['Suvarnabhumi', 'Bangkok'], FCO: ['Fiumicino', 'Rom', 'Roma'], TFU: ['Tianfu', 'Chengdu'], JED: ['Jeddah'],
  MEX: ['Mexiko', 'Mexico City'], FRA: ['Frankfurt am Main'], EWR: ['Newark Liberty'],
}
