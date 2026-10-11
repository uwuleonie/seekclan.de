// Kuratierte Daten für die historischen Karten von seekclan.de/geo (benutzt von build-historisch.mjs).
//
// Grundidee: Wo sich Grenzen seit damals nicht verändert haben, werden HEUTIGE Grenzen benutzt
// (Natural Earth, Landkreise, italienische Provinzen) – die sind viel genauer als historische Datensätze.
// Nur wo es keine heutige Entsprechung gibt (z.B. Russland 1815, Österreich-Ungarn), kommen die Flächen
// aus "historical-basemaps" (github.com/aourednik/historical-basemaps).
//
// Wichtig: Landkreise und Provinzen sind eine ANNÄHERUNG an die damaligen Grenzen. Wo ein heutiger Kreis
// zu mehreren damaligen Staaten gehörte, wird er dem Staat mit dem größten Anteil zugeschlagen.

/* ═══════════════════════ Deutschland: Landkreise → Staaten ═══════════════════════ */
// Schlüssel = Kreisname aus deutschlandGeoJSON (GADM, ohne den Zusatz „Städte“), kreisfreie Städte mit "*"

const set = (id, names) => Object.fromEntries(names.map(n => [n, id]))

/** Thüringen vor 1826 (vor der Neuordnung der sächsischen Herzogtümer) */
const THUERINGEN_1815 = {
  ...set('sachsen-weimar', ['Weimar*', 'Weimarer Land', 'Jena*', 'Wartburgkreis']),
  ...set('sachsen-gotha', ['Gotha', 'Altenburger Land', 'Saale-Holzland']),
  ...set('sachsen-coburg', ['Sonneberg']),
  ...set('sachsen-meiningen', ['Schmalkalden-Meiningen']),
  ...set('sachsen-hildburghausen', ['Hildburghausen']),
  ...set('schwarzburg-rudolstadt', ['Saalfeld-Rudolstadt']),
  ...set('schwarzburg-sondershausen', ['Kyffhäuserkreis', 'Ilm-Kreis']),
  ...set('reuss-aelt', ['Greiz']),
  ...set('reuss-juengere', ['Gera*', 'Saale-Orla']),
  ...set('preussen', ['Erfurt*', 'Sömmerda', 'Nordhausen', 'Eichsfeld', 'Unstrut-Hainich', 'Suhl*']),
}
/** Thüringen nach 1826 (gilt für das Kaiserreich) */
const THUERINGEN_1871 = {
  ...set('sachsen-weimar', ['Weimar*', 'Weimarer Land', 'Jena*', 'Wartburgkreis']),
  ...set('sachsen-meiningen', ['Schmalkalden-Meiningen', 'Hildburghausen', 'Sonneberg']),
  ...set('sachsen-altenburg', ['Altenburger Land', 'Saale-Holzland']),
  ...set('sachsen-coburg-gotha', ['Gotha']),
  ...set('schwarzburg-rudolstadt', ['Saalfeld-Rudolstadt']),
  ...set('schwarzburg-sondershausen', ['Kyffhäuserkreis', 'Ilm-Kreis']),
  ...set('reuss-aelt', ['Greiz']),
  ...set('reuss-juengere', ['Gera*', 'Saale-Orla']),
  ...set('preussen', ['Erfurt*', 'Sömmerda', 'Nordhausen', 'Eichsfeld', 'Unstrut-Hainich', 'Suhl*']),
}

const BW_BASE = (rb, k, hohenzollern) => {
  if (k === 'Sigmaringen') return hohenzollern ? 'preussen' : 'hohenzollern-sigmaringen'
  if (k === 'Zollernalbkreis') return hohenzollern ? 'preussen' : 'hohenzollern-hechingen'
  if (['Calw', 'Freudenstadt', 'Rottweil', 'Tuttlingen', 'Bodensee'].includes(k)) return 'wuerttemberg'
  if (k === 'Main-Tauber') return 'baden'
  return rb === 'Karlsruhe' || rb === 'Freiburg' ? 'baden' : 'wuerttemberg'
}

const HESSEN_1815 = {
  ...set('kurhessen', ['Kassel*', 'Kassel', 'Schwalm-Eder-Kreis', 'Werra-Meißner-Kreis', 'Hersfeld-Rotenburg', 'Fulda', 'Main-Kinzig-Kreis', 'Marburg-Biedenkopf']),
  ...set('hessen-darmstadt', ['Darmstadt*', 'Darmstadt-Dieburg', 'Bergstraße', 'Odenwaldkreis', 'Offenbach am Main*', 'Offenbach', 'Groß-Gerau', 'Gießen', 'Vogelsbergkreis', 'Wetteraukreis']),
  ...set('nassau', ['Wiesbaden*', 'Rheingau-Taunus-Kreis', 'Main-Taunus-Kreis*', 'Hochtaunuskreis', 'Limburg-Weilburg', 'Lahn-Dill-Kreis']),
  ...set('frankfurt', ['Frankfurt am Main*']),
  ...set('waldeck', ['Waldeck-Frankenberg']),
}
const PFALZ = ['Bad Dürkheim', 'Donnersbergkreis', 'Frankenthal*', 'Germersheim', 'Kaiserslautern*', 'Kaiserslautern', 'Kusel', 'Landau*',
  'Ludwigshafen*', 'Neustadt*', 'Rhein-Pfalz-Kreis', 'Speyer Spires*', 'Südliche Weinstraße', 'Südwestpfalz', 'Zweibrücken*']
const RHEINHESSEN = ['Alzey-Worms', 'Mainz-Bingen', 'Mainz*', 'Worms*']
const VORPOMMERN = ['Nordvorpommern', 'Ostvorpommern', 'Rügen', 'Stralsund*', 'Greifswald*', 'Uecker-Randow', 'Demmin']
const OLDENBURG = ['Oldenburg', 'Oldenburg*', 'Ammerland', 'Wesermarsch', 'Cloppenburg', 'Vechta', 'Friesland', 'Wilhelmshaven*']
const BRAUNSCHWEIG = ['Braunschweig*', 'Wolfenbüttel', 'Salzgitter*', 'Helmstedt', 'Holzminden']
const SCHLESWIG = ['Nordfriesland', 'Schleswig-Flensburg', 'Flensburg*']

/** Deutscher Bund um 1815/1820 */
export function kreis1815(land, rb, k) {
  switch (land) {
    case 'Baden-Württemberg': return BW_BASE(rb, k, false)
    case 'Bayern': return k === 'Coburg' || k === 'Coburg*' ? 'sachsen-coburg' : 'bayern'
    case 'Berlin': case 'Brandenburg': return 'preussen'
    case 'Bremen': return 'bremen'
    case 'Hamburg': return 'hamburg'
    case 'Hessen': return HESSEN_1815[k] ?? null
    case 'Mecklenburg-Vorpommern':
      if (['Mecklenburg-Strelitz', 'Neubrandenburg*'].includes(k)) return 'mecklenburg-strelitz'
      return VORPOMMERN.includes(k) ? 'preussen' : 'mecklenburg-schwerin'
    case 'Niedersachsen':
      if (BRAUNSCHWEIG.includes(k)) return 'braunschweig'
      if (OLDENBURG.includes(k)) return 'oldenburg'
      if (k === 'Schaumburg') return 'schaumburg-lippe'
      return 'hannover'
    case 'Nordrhein-Westfalen': return k === 'Lippe' ? 'lippe' : 'preussen'
    case 'Rheinland-Pfalz':
      if (PFALZ.includes(k)) return 'bayern'
      if (RHEINHESSEN.includes(k)) return 'hessen-darmstadt'
      if (['Rhein-Lahn', 'Westerwaldkreis'].includes(k)) return 'nassau'
      if (k === 'Birkenfeld') return 'oldenburg'
      return 'preussen'
    case 'Saarland': return k === 'Saarpfalz' ? 'bayern' : k === 'Sankt Wendel' ? 'sachsen-coburg' : 'preussen'
    case 'Sachsen': return ['Delitzsch', 'Niederschlesischer Oberlausitzkreis', 'Görlitz*'].includes(k) ? 'preussen' : 'sachsen'
    case 'Sachsen-Anhalt':
      if (['Dessau*', 'Anhalt-Zerbst'].includes(k)) return 'anhalt-dessau'
      if (k === 'Köthen') return 'anhalt-koethen'
      if (k === 'Bernburg') return 'anhalt-bernburg'
      return 'preussen'
    case 'Schleswig-Holstein':
      if (SCHLESWIG.includes(k)) return 'schleswig'
      if (k === 'Lauenburg') return 'lauenburg'
      if (k === 'Lübeck*') return 'luebeck'
      return 'holstein'
    case 'Thüringen': return THUERINGEN_1815[k] ?? null
  }
  return null
}

/** Deutsches Kaiserreich 1871–1918 */
export function kreis1871(land, rb, k) {
  switch (land) {
    case 'Baden-Württemberg': return BW_BASE(rb, k, true)
    case 'Bayern': return k === 'Coburg' || k === 'Coburg*' ? 'sachsen-coburg-gotha' : 'bayern'
    case 'Berlin': case 'Brandenburg': return 'preussen'
    case 'Bremen': return 'bremen'
    case 'Hamburg': return 'hamburg'
    case 'Hessen': {
      const a = HESSEN_1815[k]
      return a === 'hessen-darmstadt' ? 'hessen' : a === 'waldeck' ? 'waldeck' : 'preussen'
    }
    case 'Mecklenburg-Vorpommern':
      if (['Mecklenburg-Strelitz', 'Neubrandenburg*'].includes(k)) return 'mecklenburg-strelitz'
      return VORPOMMERN.includes(k) ? 'preussen' : 'mecklenburg-schwerin'
    case 'Niedersachsen':
      if (BRAUNSCHWEIG.includes(k)) return 'braunschweig'
      if (OLDENBURG.includes(k)) return 'oldenburg'
      if (k === 'Schaumburg') return 'schaumburg-lippe'
      return 'preussen'
    case 'Nordrhein-Westfalen': return k === 'Lippe' ? 'lippe' : 'preussen'
    case 'Rheinland-Pfalz':
      if (PFALZ.includes(k)) return 'bayern'
      if (RHEINHESSEN.includes(k)) return 'hessen'
      if (k === 'Birkenfeld') return 'oldenburg'
      return 'preussen'
    case 'Saarland': return k === 'Saarpfalz' ? 'bayern' : 'preussen'
    case 'Sachsen': return ['Delitzsch', 'Niederschlesischer Oberlausitzkreis', 'Görlitz*'].includes(k) ? 'preussen' : 'sachsen'
    case 'Sachsen-Anhalt': return ['Dessau*', 'Anhalt-Zerbst', 'Köthen', 'Bernburg'].includes(k) ? 'anhalt' : 'preussen'
    case 'Schleswig-Holstein': return k === 'Lübeck*' ? 'luebeck' : 'preussen'
    case 'Thüringen': return THUERINGEN_1871[k] ?? null
  }
  return null
}

/** Besatzungszonen 1945–1949 */
const BW_US = ['Karlsruhe', 'Karlsruhe*', 'Mannheim*', 'Heidelberg*', 'Rhein-Neckar-Kreis', 'Neckar-Odenwald-Kreis', 'Pforzheim*', 'Enz']
export function kreis1945(land, rb, k) {
  switch (land) {
    case 'Bayern': return k === 'Lindau' ? 'fr' : 'us'
    case 'Hessen': return 'us'
    case 'Bremen': return 'bremen'
    case 'Baden-Württemberg':
      if (k === 'Ulm*') return 'us'
      if (rb === 'Stuttgart') return 'us'
      if (rb === 'Karlsruhe') return BW_US.includes(k) ? 'us' : 'fr'
      return 'fr'
    case 'Nordrhein-Westfalen': case 'Niedersachsen': case 'Schleswig-Holstein': case 'Hamburg': return 'uk'
    case 'Rheinland-Pfalz': return 'fr'
    case 'Saarland': return 'saar'
    case 'Berlin': return 'berlin'
    default: return 'su'
  }
}

/* ═══════════════════════ Italien: Provinzen → Staaten 1815 ═══════════════════════ */

export const ITALIEN_1815 = {
  ...set('sardinien', ['Turin', 'Cuneo', 'Asti', 'Alessandria', 'Vercelli', 'Biella', 'Novara', 'Verbano-Cusio-Ossola', 'Aoste',
    'Genova', 'Savona', 'Imperia', 'La Spezia', 'Pavia',
    'Cagliari', 'Sassari', 'Nuoro', 'Oristrano', 'Ogliastra', 'Olbia-Tempio', 'Medio Campidano', 'Carbonia-Iglesias']),
  ...set('lombardo-venetien', ['Milano', 'Monza e Brianza', 'Lodi', 'Varese', 'Como', 'Lecco', 'Sondrio', 'Bergamo', 'Brescia', 'Cremona', 'Mantova',
    'Verona', 'Vicenza', 'Padova', 'Treviso', 'Venezia', 'Rovigo', 'Belluno', 'Udine', 'Pordenone']),
  ...set('oesterreich', ['Bozen', 'Trento', 'Trieste', 'Gorizia']),
  ...set('parma', ['Parma', 'Piacenza']),
  ...set('modena', ['Modena', 'Reggio Emilia']),
  ...set('massa', ['Massa-Carrara']),
  ...set('lucca', ['Lucca']),
  ...set('toskana', ['Firenze', 'Prato', 'Pistoia', 'Pisa', 'Livorno', 'Siena', 'Arezzo', 'Grosseto']),
  ...set('kirchenstaat', ['Roma', 'Viterbo', 'Rieti', 'Frosinone', 'Latina', 'Perugia', 'Terni', 'Ancona', 'Macerata', 'Pesaro e Urbino', 'Fermo',
    'Ascoli Piceno', 'Bologna', 'Ferrara', 'Ravenna', 'Forlì-Cesena', 'Rimini']),
  ...set('beide-sizilien', ['Napoli', 'Caserta', 'Salerno', 'Avellino', 'Benevento', "L'Aquila", 'Teramo', 'Pescara', 'Chieti', 'Campobasso', 'Isernia',
    'Bari', 'Barletta-Andria Trani', 'Foggia', 'Brindisi', 'Lecce', 'Taranto', 'Potenza', 'Matera', 'Cosenza', 'Catanzaro', 'Crotene', 'Vibo Valentia',
    'Reggio Calabria', 'Palermo', 'Trapani', 'Agrigento', 'Caltanissetta', 'Enna', 'Catania', 'Messina', 'Ragusa', 'Siracusa']),
}
/** 1914: Trentino, Südtirol, Triest, Görz gehören zu Österreich-Ungarn, der Rest zu Italien */
export const ITALIEN_1914_AH = ['Bozen', 'Trento', 'Trieste', 'Gorizia']
/** 1815: Savoyen und Nizza gehören zu Sardinien */
export const FRANKREICH_SARDINIEN = ['Savoie', 'Haute-Savoie', 'Alpes-Maritimes']
// (Natural Earth schreibt „Haute-Rhin“)
export const ELSASS_LOTHRINGEN = ['Bas-Rhin', 'Haute-Rhin', 'Moselle']
export const FRANKREICH_UEBERSEE = ['Guyane française', 'Martinique', 'Guadeloupe', 'La Réunion', 'Mayotte']

/* ═══════════════════════ Europa 1815 ═══════════════════════ */

/** Namen in historical-basemaps 1815 → unsere ids (alles, was nicht hier steht, wird aus dem Namen gebildet) */
export const HB_1815 = {
  'Austrian Empire': 'oesterreich', Lombardy: 'lombardo-venetien', Venetia: 'lombardo-venetien',
  Prussia: 'preussen', 'Russian Empire': 'russland', 'Ottoman Empire': 'osmanisches', 'Republic of Kraków': 'krakau',
  Luxembourg: 'luxemburg', Denmark: 'daenemark', Schleswig: 'schleswig', Malta: 'malta',
  'United Kingdom of Netherlands': 'niederlande', 'Kingdom of the Two Sicilies': 'beide-sizilien',
  Algiers: 'algier', Tunis: 'tunis', Tripolitania: 'tripolitanien', Cyrenaica: 'cyrenaika', Egypt: 'aegypten', Persia: 'persien',
}
/** Inseln ohne Namen in den Rohdaten: Zuordnung nach Lage [West, Süd, Ost, Nord] */
export const HB_1815_INSELN = [
  { box: [19, 37, 21.2, 40], id: 'ionische-inseln' }, // Korfu, Kefalonia, Zakynthos …
  { box: [22.5, 35.8, 23.3, 36.4], id: 'ionische-inseln' }, // Kythira
  { box: [-8, 61, -6, 62.5], id: 'daenemark' }, // Färöer
  { box: [10.9, 54.3, 11.4, 54.6], id: 'schleswig' }, // Fehmarn
]

/** Staaten 1815 – g: Gruppe (gross, bund, italien, uebrige) */
export const STAATEN_1815 = {
  grossbritannien: { name: 'Vereinigtes Königreich', full: 'Vereinigtes Königreich Großbritannien und Irland', g: 'gross', cap: 'London', form: 'Königreich · Haus Hannover (Georg III.)', aliases: ['Großbritannien', 'England', 'UK'] },
  frankreich: { name: 'Frankreich', full: 'Königreich Frankreich', g: 'gross', cap: 'Paris', form: 'Königreich · Bourbonen (Ludwig XVIII.)' },
  russland: { name: 'Russland', full: 'Russisches Kaiserreich', g: 'gross', cap: 'St. Petersburg', form: 'Kaiserreich · Romanow (Alexander I.)', note: 'Mit dem Königreich Polen („Kongresspolen“) in Personalunion.', aliases: ['Russisches Reich', 'Russisches Kaiserreich', 'Zarenreich'] },
  preussen: { name: 'Preußen', full: 'Königreich Preußen', g: 'gross', cap: 'Berlin', form: 'Königreich · Hohenzollern (Friedrich Wilhelm III.)', note: 'Mitglied im Deutschen Bund – außer Ost- und Westpreußen und Posen.' },
  oesterreich: { name: 'Österreich', full: 'Kaisertum Österreich', g: 'gross', cap: 'Wien', form: 'Kaiserreich · Habsburg-Lothringen (Franz I.)', note: 'Führte den Vorsitz im Deutschen Bund – Mitglied nur mit den „deutschen“ Ländern (ohne Ungarn, Galizien, Lombardo-Venetien, Dalmatien).', aliases: ['Kaisertum Österreich', 'Kaiserreich Österreich'] },
  spanien: { name: 'Spanien', full: 'Königreich Spanien', g: 'uebrige', cap: 'Madrid', form: 'Königreich · Bourbonen (Ferdinand VII.)' },
  portugal: { name: 'Portugal', full: 'Vereinigtes Königreich von Portugal, Brasilien und den Algarven', g: 'uebrige', cap: 'Lissabon (der Königshof saß bis 1821 in Rio de Janeiro)', form: 'Königreich · Haus Braganza' },
  niederlande: { name: 'Niederlande', full: 'Vereinigtes Königreich der Niederlande', g: 'uebrige', cap: 'Amsterdam (Regierung abwechselnd in Den Haag und Brüssel)', form: 'Königreich · Oranien-Nassau (Wilhelm I.)', end: '1830 spaltet sich Belgien ab (anerkannt 1839).', aliases: ['Vereinigtes Königreich der Niederlande'] },
  schweiz: { name: 'Schweiz', full: 'Schweizerische Eidgenossenschaft', g: 'uebrige', cap: 'keine – der „Vorort“ wechselte alle zwei Jahre zwischen Zürich, Bern und Luzern', form: 'Staatenbund aus 22 Kantonen' },
  daenemark: { name: 'Dänemark', full: 'Königreich Dänemark', g: 'uebrige', cap: 'Kopenhagen', form: 'Königreich · Haus Oldenburg (Friedrich VI.)', note: 'Mit Island, den Färöern und Grönland.' },
  schleswig: { name: 'Schleswig', full: 'Herzogtum Schleswig', g: 'uebrige', cap: 'Schleswig', form: 'Herzogtum · dänischer König als Herzog', note: 'Gehörte NICHT zum Deutschen Bund (anders als Holstein).', end: '1864 an Preußen und Österreich, 1867 preußisch, 1920 Norden an Dänemark.' },
  schweden: { name: 'Schweden', full: 'Königreich Schweden', g: 'uebrige', cap: 'Stockholm', form: 'Königreich · Karl XIII. (Thronfolger: Bernadotte)', note: 'In Union mit Norwegen (1814–1905).' },
  norwegen: { name: 'Norwegen', full: 'Königreich Norwegen', g: 'uebrige', cap: 'Christiania (heute Oslo)', form: 'eigenes Königreich in Union mit Schweden (1814–1905)' },
  finnland: { name: 'Finnland', full: 'Großfürstentum Finnland', g: 'uebrige', cap: 'Helsinki (seit 1812, vorher Turku)', form: 'autonomes Großfürstentum · der russische Zar als Großfürst (seit 1809)' },
  osmanisches: { name: 'Osmanisches Reich', full: 'Osmanisches Reich', g: 'uebrige', cap: 'Konstantinopel', form: 'Sultanat · Mahmud II.', aliases: ['Türkei', 'Osmanen'] },
  krakau: { name: 'Krakau', full: 'Freie Stadt Krakau', g: 'uebrige', cap: 'Krakau', form: 'Republik unter dem Schutz von Österreich, Preußen und Russland', end: '1846 an Österreich.', aliases: ['Republik Krakau', 'Freie Stadt Krakau'] },
  'ionische-inseln': { name: 'Ionische Inseln', full: 'Vereinigte Staaten der Ionischen Inseln', g: 'uebrige', cap: 'Korfu', form: 'britisches Protektorat (1815–1864)', end: '1864 an Griechenland.' },
  malta: { name: 'Malta', full: 'Malta', g: 'uebrige', cap: 'Valletta', form: 'britische Kolonie (1814 bestätigt)' },
  andorra: { name: 'Andorra', full: 'Kofürstentum Andorra', g: 'uebrige', cap: 'Andorra la Vella', form: 'Kofürstentum (Bischof von Urgell und französisches Staatsoberhaupt)' },
  // Italien
  sardinien: { name: 'Sardinien', full: 'Königreich Sardinien (Piemont-Sardinien)', g: 'italien', haus: 'savoyen', cap: 'Turin', form: 'Königreich · Haus Savoyen (Viktor Emanuel I.)', note: 'Bekam 1815 die frühere Republik Genua dazu.', end: 'Wird 1861 zum Königreich Italien.', aliases: ['Piemont', 'Piemont-Sardinien', 'Königreich Sardinien'] },
  'lombardo-venetien': { name: 'Lombardo-Venetien', full: 'Königreich Lombardo-Venetien', g: 'italien', haus: 'habsburg', cap: 'Mailand und Venedig', form: 'Kronland des Kaisertums Österreich (1815–1866)', end: 'Lombardei 1859 an Sardinien, Venetien 1866 an Italien.', aliases: ['Lombardei-Venetien', 'Lombardo Venetien'] },
  parma: { name: 'Parma', full: 'Herzogtum Parma, Piacenza und Guastalla', g: 'italien', haus: 'habsburg', cap: 'Parma', form: 'Herzogtum · Marie-Louise von Österreich (Napoleons zweite Frau)', end: '1860 an Sardinien.' },
  modena: { name: 'Modena', full: 'Herzogtum Modena und Reggio', g: 'italien', haus: 'habsburg', cap: 'Modena', form: 'Herzogtum · Haus Österreich-Este (Franz IV.)', end: '1860 an Sardinien.' },
  massa: { name: 'Massa und Carrara', full: 'Herzogtum Massa und Carrara', g: 'italien', haus: 'habsburg', cap: 'Massa', form: 'Herzogtum · Maria Beatrice d’Este', end: '1829 an Modena.', aliases: ['Massa', 'Massa-Carrara'] },
  lucca: { name: 'Lucca', full: 'Herzogtum Lucca', g: 'italien', haus: 'bourbon', cap: 'Lucca', form: 'Herzogtum · Bourbon-Parma (Maria Luisa)', end: '1847 an die Toskana.' },
  toskana: { name: 'Toskana', full: 'Großherzogtum Toskana', g: 'italien', haus: 'habsburg', cap: 'Florenz', form: 'Großherzogtum · Habsburg-Lothringen (Ferdinand III.)', end: '1860 an Sardinien.' },
  kirchenstaat: { name: 'Kirchenstaat', full: 'Kirchenstaat', g: 'italien', haus: 'papst', cap: 'Rom', form: 'Wahlmonarchie des Papstes (Pius VII.)', end: '1860 großteils an Sardinien, Rom 1870 an Italien.', aliases: ['Päpstlicher Staat', 'Kirchenstaaten'] },
  'beide-sizilien': { name: 'Beide Sizilien', full: 'Königreich beider Sizilien', g: 'italien', haus: 'bourbon', cap: 'Neapel', form: 'Königreich · Bourbonen (Ferdinand I.)', note: 'Neapel und Sizilien wurden 1816 zum „Königreich beider Sizilien“ vereinigt.', end: '1860/61 an Italien (Zug der Tausend).', aliases: ['Königreich beider Sizilien', 'Neapel', 'Neapel-Sizilien', 'Zwei Sizilien'] },
  'san-marino': { name: 'San Marino', full: 'Republik San Marino', g: 'italien', haus: 'frei', cap: 'San Marino', form: 'Republik' },
  monaco: { name: 'Monaco', full: 'Fürstentum Monaco', g: 'italien', haus: 'frei', cap: 'Monaco', form: 'Fürstentum · Grimaldi', note: 'Stand 1815–1860 unter dem Schutz Sardiniens; bis 1848 gehörten Menton und Roquebrune dazu.' },
  // Deutscher Bund (ohne Österreich und Preußen, die oben stehen)
  bayern: { name: 'Bayern', full: 'Königreich Bayern', g: 'bund', cap: 'München', form: 'Königreich · Wittelsbach (Maximilian I. Joseph)', note: 'Die Pfalz (Rheinkreis) kam 1816 dazu.' },
  sachsen: { name: 'Sachsen', full: 'Königreich Sachsen', g: 'bund', cap: 'Dresden', form: 'Königreich · Wettiner (Friedrich August I.)', note: 'Musste 1815 mehr als die Hälfte seines Gebiets an Preußen abgeben.' },
  hannover: { name: 'Hannover', full: 'Königreich Hannover', g: 'bund', cap: 'Hannover', form: 'Königreich · Welfen, bis 1837 in Personalunion mit Großbritannien', end: '1866 an Preußen.' },
  wuerttemberg: { name: 'Württemberg', full: 'Königreich Württemberg', g: 'bund', cap: 'Stuttgart', form: 'Königreich · Haus Württemberg (Friedrich I.)' },
  baden: { name: 'Baden', full: 'Großherzogtum Baden', g: 'bund', cap: 'Karlsruhe', form: 'Großherzogtum · Zähringer (Karl)' },
  kurhessen: { name: 'Kurhessen', full: 'Kurfürstentum Hessen', g: 'bund', cap: 'Kassel', form: 'Kurfürstentum · Wilhelm I.', end: '1866 an Preußen.', aliases: ['Hessen-Kassel', 'Kurfürstentum Hessen'] },
  'hessen-darmstadt': { name: 'Hessen-Darmstadt', full: 'Großherzogtum Hessen', g: 'bund', cap: 'Darmstadt', form: 'Großherzogtum · Ludwig I.', note: 'Bekam 1816 Rheinhessen mit Mainz und Worms.', aliases: ['Großherzogtum Hessen', 'Hessen'] },
  'mecklenburg-schwerin': { name: 'Mecklenburg-Schwerin', full: 'Großherzogtum Mecklenburg-Schwerin', g: 'bund', cap: 'Schwerin', form: 'Großherzogtum (seit 1815) · Friedrich Franz I.' },
  'mecklenburg-strelitz': { name: 'Mecklenburg-Strelitz', full: 'Großherzogtum Mecklenburg-Strelitz', g: 'bund', cap: 'Neustrelitz', form: 'Großherzogtum (seit 1815) · Karl II.' },
  'sachsen-weimar': { name: 'Sachsen-Weimar-Eisenach', full: 'Großherzogtum Sachsen-Weimar-Eisenach', g: 'bund', cap: 'Weimar', form: 'Großherzogtum (seit 1815) · Carl August (Goethes Dienstherr)', aliases: ['Sachsen-Weimar', 'Weimar'] },
  oldenburg: { name: 'Oldenburg', full: 'Herzogtum Oldenburg', g: 'bund', cap: 'Oldenburg', form: 'Herzogtum · Peter Friedrich Ludwig (den Großherzogstitel von 1815 führte erst sein Sohn ab 1829)', note: 'Dazu gehörten das Fürstentum Lübeck (Eutin) und ab 1817 Birkenfeld an der Nahe.' },
  nassau: { name: 'Nassau', full: 'Herzogtum Nassau', g: 'bund', cap: 'Wiesbaden', form: 'Herzogtum', end: '1866 an Preußen.' },
  braunschweig: { name: 'Braunschweig', full: 'Herzogtum Braunschweig', g: 'bund', cap: 'Braunschweig', form: 'Herzogtum · Welfen', note: 'Herzog Friedrich Wilhelm fiel am 16. Juni 1815 bei Quatre-Bras.' },
  holstein: { name: 'Holstein', full: 'Herzogtum Holstein', g: 'bund', cap: 'Glückstadt', form: 'Herzogtum · der dänische König als Herzog', end: '1864 an Preußen und Österreich, 1867 preußisch.' },
  lauenburg: { name: 'Lauenburg', full: 'Herzogtum Lauenburg', g: 'bund', cap: 'Ratzeburg', form: 'Herzogtum · der dänische König als Herzog (seit 1815)', end: '1865 an Preußen.', aliases: ['Sachsen-Lauenburg'] },
  luxemburg: { name: 'Luxemburg', full: 'Großherzogtum Luxemburg', g: 'bund', cap: 'Luxemburg', form: 'Großherzogtum · in Personalunion mit den Niederlanden (Wilhelm I.)', note: 'Bis 1839 doppelt so groß wie heute – der Westen wurde dann belgisch.' },
  'sachsen-gotha': { name: 'Sachsen-Gotha-Altenburg', full: 'Herzogtum Sachsen-Gotha-Altenburg', g: 'bund', cap: 'Gotha', form: 'Herzogtum · Ernestiner', end: '1825 erloschen, 1826 aufgeteilt (Gotha an Coburg, Altenburg an Hildburghausen).', aliases: ['Sachsen-Gotha', 'Gotha'] },
  'sachsen-coburg': { name: 'Sachsen-Coburg-Saalfeld', full: 'Herzogtum Sachsen-Coburg-Saalfeld', g: 'bund', cap: 'Coburg', form: 'Herzogtum · Ernst I.', note: 'Besaß 1816–1834 auch das Fürstentum Lichtenberg um St. Wendel im Saarland.', end: '1826 → Sachsen-Coburg und Gotha.', aliases: ['Sachsen-Coburg', 'Coburg'] },
  'sachsen-meiningen': { name: 'Sachsen-Meiningen', full: 'Herzogtum Sachsen-Meiningen', g: 'bund', cap: 'Meiningen', form: 'Herzogtum · Bernhard II.', aliases: ['Meiningen'] },
  'sachsen-hildburghausen': { name: 'Sachsen-Hildburghausen', full: 'Herzogtum Sachsen-Hildburghausen', g: 'bund', cap: 'Hildburghausen', form: 'Herzogtum · Friedrich', end: '1826: der Herzog zieht nach Altenburg (→ Sachsen-Altenburg), Hildburghausen an Meiningen.', aliases: ['Hildburghausen'] },
  'anhalt-dessau': { name: 'Anhalt-Dessau', full: 'Herzogtum Anhalt-Dessau', g: 'bund', cap: 'Dessau', form: 'Herzogtum · Leopold III. Friedrich Franz', end: '1863 vereinigt zum Herzogtum Anhalt.' },
  'anhalt-koethen': { name: 'Anhalt-Köthen', full: 'Herzogtum Anhalt-Köthen', g: 'bund', cap: 'Köthen', form: 'Herzogtum', end: '1847 erloschen, 1853 an Anhalt-Dessau.' },
  'anhalt-bernburg': { name: 'Anhalt-Bernburg', full: 'Herzogtum Anhalt-Bernburg', g: 'bund', cap: 'Bernburg', form: 'Herzogtum', end: '1863 erloschen → Herzogtum Anhalt.' },
  'hohenzollern-hechingen': { name: 'Hohenzollern-Hechingen', full: 'Fürstentum Hohenzollern-Hechingen', g: 'bund', cap: 'Hechingen', form: 'Fürstentum · schwäbische Hohenzollern', end: '1850 an Preußen.' },
  'hohenzollern-sigmaringen': { name: 'Hohenzollern-Sigmaringen', full: 'Fürstentum Hohenzollern-Sigmaringen', g: 'bund', cap: 'Sigmaringen', form: 'Fürstentum · schwäbische Hohenzollern', end: '1850 an Preußen.' },
  liechtenstein: { name: 'Liechtenstein', full: 'Fürstentum Liechtenstein', g: 'bund', cap: 'Vaduz', form: 'Fürstentum · Johann I.', note: 'Neben Österreich und Luxemburg das einzige Mitglied des Deutschen Bundes, das bis heute ein eigener Staat ist.' },
  lippe: { name: 'Lippe', full: 'Fürstentum Lippe', g: 'bund', cap: 'Detmold', form: 'Fürstentum', aliases: ['Lippe-Detmold'] },
  'reuss-aelt': { name: 'Reuß ältere Linie', full: 'Fürstentum Reuß älterer Linie', g: 'bund', cap: 'Greiz', form: 'Fürstentum · alle männlichen Fürsten hießen Heinrich', aliases: ['Reuß-Greiz', 'Reuss ältere Linie', 'Reuß ä. L.'] },
  'reuss-juengere': { name: 'Reuß jüngere Linie', full: 'Fürstentum Reuß jüngerer Linie', g: 'bund', cap: 'Gera (bis 1848 mehrere Linien: Gera, Schleiz, Lobenstein-Ebersdorf)', form: 'Fürstentum · alle männlichen Fürsten hießen Heinrich', aliases: ['Reuß-Gera', 'Reuss jüngere Linie', 'Reuß j. L.'] },
  'schaumburg-lippe': { name: 'Schaumburg-Lippe', full: 'Fürstentum Schaumburg-Lippe', g: 'bund', cap: 'Bückeburg', form: 'Fürstentum' },
  'schwarzburg-rudolstadt': { name: 'Schwarzburg-Rudolstadt', full: 'Fürstentum Schwarzburg-Rudolstadt', g: 'bund', cap: 'Rudolstadt', form: 'Fürstentum' },
  'schwarzburg-sondershausen': { name: 'Schwarzburg-Sondershausen', full: 'Fürstentum Schwarzburg-Sondershausen', g: 'bund', cap: 'Sondershausen', form: 'Fürstentum' },
  waldeck: { name: 'Waldeck', full: 'Fürstentum Waldeck und Pyrmont', g: 'bund', cap: 'Arolsen', form: 'Fürstentum', aliases: ['Waldeck-Pyrmont'] },
  bremen: { name: 'Bremen', full: 'Freie Hansestadt Bremen', g: 'bund', cap: 'Bremen', form: 'Freie Stadt (Republik)' },
  frankfurt: { name: 'Frankfurt', full: 'Freie Stadt Frankfurt', g: 'bund', cap: 'Frankfurt am Main', form: 'Freie Stadt (Republik)', note: 'Sitz der Bundesversammlung des Deutschen Bundes – und 1848/49 der Nationalversammlung in der Paulskirche.', end: '1866 an Preußen.', aliases: ['Frankfurt am Main'] },
  hamburg: { name: 'Hamburg', full: 'Freie und Hansestadt Hamburg', g: 'bund', cap: 'Hamburg', form: 'Freie Stadt (Republik)', note: 'Mit dem Amt Ritzebüttel (Cuxhaven).' },
  luebeck: { name: 'Lübeck', full: 'Freie und Hansestadt Lübeck', g: 'bund', cap: 'Lübeck', form: 'Freie Stadt (Republik)', end: '1937 an Preußen.' },
  'hessen-homburg': { name: 'Hessen-Homburg', full: 'Landgrafschaft Hessen-Homburg', g: 'bund', cap: 'Homburg vor der Höhe', form: 'Landgrafschaft · seit 1817 im Deutschen Bund', note: 'Winzig: das Amt Homburg und ab 1816 das Oberamt Meisenheim an der Glan. Auf der Karte nur als Punkt.', end: '1866 an Hessen-Darmstadt, noch im selben Jahr an Preußen.', point: [8.6183, 50.2268] },
}
export const BUND_1815 = Object.entries(STAATEN_1815).filter(([, s]) => s.g === 'bund').map(([id]) => id).concat(['oesterreich', 'preussen'])

/** Europa 1815 (normal): nur die größeren Staaten – die kleinen deutschen und italienischen Staaten sind im Hintergrund */
export const EUROPA_1815_NORMAL = ['grossbritannien', 'frankreich', 'russland', 'preussen', 'oesterreich', 'spanien', 'portugal', 'niederlande', 'schweiz',
  'daenemark', 'schweden', 'norwegen', 'osmanisches', 'sardinien', 'kirchenstaat', 'beide-sizilien', 'toskana', 'bayern', 'sachsen', 'hannover', 'wuerttemberg', 'baden']
/** Gebiete, die im normalen Quiz zu einem größeren Staat gezählt werden */
export const EUROPA_1815_MIT = { daenemark: ['schleswig'], russland: ['finnland'], grossbritannien: ['malta', 'ionische-inseln'], oesterreich: ['lombardo-venetien'] }

/* ═══════════════════════ Europa 1914 ═══════════════════════ */

export const HB_1914 = {
  'German Empire': 'deutsches-reich', 'Austro-Hungarian Empire': 'oesterreich-ungarn', 'Russian Empire': 'russland', Georgia: 'russland',
  Armenia: 'russland', Azerbaijan: 'russland', Finland: 'finnland', 'Ottoman Empire': 'osmanisches', Belgium: 'belgien', Denmark: 'daenemark',
  Romania: 'rumaenien', Bulgaria: 'bulgarien', Serbia: 'serbien', Montenegro: 'montenegro', Albania: 'albanien', Greece: 'griechenland',
  Malta: 'malta', Norway: 'norwegen', 'Spanish Morocco': 'spanisch-marokko', Morocco: 'marokko', Algeria: 'algerien', Tunisia: 'tunesien',
  Libya: 'libyen', Egypt: 'aegypten', Persia: 'persien',
}
export const HB_1914_INSELN = [
  { box: [26, 35.3, 28.5, 37.6], id: 'dodekanes' }, // 1912 von Italien besetzt
  { box: [23.3, 34.7, 26.5, 35.8], id: 'griechenland' }, // Kreta (seit 1913 griechisch)
  { box: [32, 34.4, 34.7, 35.8], id: 'zypern' }, // britisch verwaltet
]

export const STAATEN_1914 = {
  'deutsches-reich': { name: 'Deutsches Reich', full: 'Deutsches Kaiserreich', g: 'mittel', cap: 'Berlin', form: 'Kaiserreich · Wilhelm II.', war: 'Mittelmächte · Kriegseintritt 1. August 1914 (Kriegserklärung an Russland)', aliases: ['Deutschland', 'Kaiserreich', 'Deutsches Kaiserreich'] },
  'oesterreich-ungarn': { name: 'Österreich-Ungarn', full: 'Österreichisch-Ungarische Monarchie', g: 'mittel', cap: 'Wien (Ungarn: Budapest)', form: 'Doppelmonarchie · Franz Joseph I.', war: 'Mittelmächte · 28. Juli 1914 Kriegserklärung an Serbien', aliases: ['Österreich', 'Donaumonarchie', 'k.u.k. Monarchie'] },
  osmanisches: { name: 'Osmanisches Reich', full: 'Osmanisches Reich', g: 'mittel', cap: 'Konstantinopel', form: 'Sultanat · Mehmed V.', war: 'Mittelmächte · ab Ende Oktober/November 1914', aliases: ['Türkei', 'Osmanen'] },
  bulgarien: { name: 'Bulgarien', full: 'Zarentum Bulgarien', g: 'mittel', cap: 'Sofia', form: 'Zarentum · Ferdinand I.', war: 'Mittelmächte · ab Oktober 1915' },
  frankreich: { name: 'Frankreich', full: 'Französische Republik', g: 'entente', cap: 'Paris', form: 'Republik (Dritte Republik) · Präsident Poincaré', war: 'Entente · 3. August 1914 (Kriegserklärung Deutschlands)' },
  grossbritannien: { name: 'Vereinigtes Königreich', full: 'Vereinigtes Königreich Großbritannien und Irland', g: 'entente', cap: 'London', form: 'Königreich · Georg V.', war: 'Entente · 4. August 1914 (nach dem deutschen Einmarsch in Belgien)', aliases: ['Großbritannien', 'England', 'UK'] },
  russland: { name: 'Russland', full: 'Russisches Kaiserreich', g: 'entente', cap: 'St. Petersburg (ab September 1914 Petrograd)', form: 'Kaiserreich · Nikolaus II.', war: 'Entente · 1. August 1914', aliases: ['Russisches Reich', 'Zarenreich'] },
  serbien: { name: 'Serbien', full: 'Königreich Serbien', g: 'entente', cap: 'Belgrad', form: 'Königreich · Peter I.', war: 'Entente · angegriffen am 28. Juli 1914' },
  montenegro: { name: 'Montenegro', full: 'Königreich Montenegro', g: 'entente', cap: 'Cetinje', form: 'Königreich · Nikola I.', war: 'Entente · August 1914' },
  belgien: { name: 'Belgien', full: 'Königreich Belgien', g: 'entente', cap: 'Brüssel', form: 'Königreich · Albert I.', war: 'eigentlich neutral – am 4. August 1914 von Deutschland überfallen' },
  italien: { name: 'Italien', full: 'Königreich Italien', g: 'entente', cap: 'Rom', form: 'Königreich · Viktor Emanuel III.', war: 'zuerst neutral (obwohl im Dreibund) · ab Mai 1915 auf Seiten der Entente' },
  rumaenien: { name: 'Rumänien', full: 'Königreich Rumänien', g: 'entente', cap: 'Bukarest', form: 'Königreich · Karl I. (ab Oktober 1914 Ferdinand I.)', war: 'zuerst neutral · ab August 1916 Entente' },
  portugal: { name: 'Portugal', full: 'Republik Portugal', g: 'entente', cap: 'Lissabon', form: 'Republik (seit 1910)', war: 'ab März 1916 im Krieg (Kriegserklärung Deutschlands)' },
  griechenland: { name: 'Griechenland', full: 'Königreich Griechenland', g: 'entente', cap: 'Athen', form: 'Königreich · Konstantin I.', war: 'zuerst neutral · ab Juni 1917 Entente' },
  spanien: { name: 'Spanien', full: 'Königreich Spanien', g: 'neutral', cap: 'Madrid', form: 'Königreich · Alfons XIII.', war: 'neutral' },
  niederlande: { name: 'Niederlande', full: 'Königreich der Niederlande', g: 'neutral', cap: 'Amsterdam', form: 'Königreich · Wilhelmina', war: 'neutral' },
  schweiz: { name: 'Schweiz', full: 'Schweizerische Eidgenossenschaft', g: 'neutral', cap: 'Bern', form: 'Bundesstaat', war: 'neutral' },
  daenemark: { name: 'Dänemark', full: 'Königreich Dänemark', g: 'neutral', cap: 'Kopenhagen', form: 'Königreich · Christian X.', war: 'neutral' },
  norwegen: { name: 'Norwegen', full: 'Königreich Norwegen', g: 'neutral', cap: 'Kristiania (heute Oslo)', form: 'Königreich · Haakon VII.', war: 'neutral' },
  schweden: { name: 'Schweden', full: 'Königreich Schweden', g: 'neutral', cap: 'Stockholm', form: 'Königreich · Gustav V.', war: 'neutral' },
  luxemburg: { name: 'Luxemburg', full: 'Großherzogtum Luxemburg', g: 'neutral', cap: 'Luxemburg', form: 'Großherzogtum · Marie-Adélaïde', war: 'neutral – trotzdem ab 2. August 1914 von Deutschland besetzt' },
  albanien: { name: 'Albanien', full: 'Fürstentum Albanien', g: 'neutral', cap: 'Durrës', form: 'Fürstentum · Wilhelm zu Wied (verließ das Land im September 1914)', war: 'neutral, aber von mehreren Kriegsparteien besetzt' },
  liechtenstein: { name: 'Liechtenstein', full: 'Fürstentum Liechtenstein', g: 'neutral', cap: 'Vaduz', form: 'Fürstentum · Johann II.', war: 'neutral' },
  monaco: { name: 'Monaco', full: 'Fürstentum Monaco', g: 'neutral', cap: 'Monaco', form: 'Fürstentum · Albert I.', war: 'neutral' },
  andorra: { name: 'Andorra', full: 'Kofürstentum Andorra', g: 'neutral', cap: 'Andorra la Vella', form: 'Kofürstentum', war: 'neutral' },
  'san-marino': { name: 'San Marino', full: 'Republik San Marino', g: 'neutral', cap: 'San Marino', form: 'Republik', war: 'umstritten – blieb wohl offiziell neutral, Freiwillige kämpften für Italien' },
  // nur schwer
  'elsass-lothringen': { name: 'Elsass-Lothringen', full: 'Reichsland Elsaß-Lothringen', g: 'mittel', cap: 'Straßburg', form: 'Reichsland des Deutschen Reichs (1871–1918)', war: 'Teil des Deutschen Reichs', schwer: true, end: '1918/19 zurück an Frankreich.' },
  bosnien: { name: 'Bosnien-Herzegowina', full: 'Kondominium Bosnien und Herzegowina', g: 'mittel', cap: 'Sarajevo', form: '1908 von Österreich-Ungarn annektiert', war: 'Hier wurde am 28. Juni 1914 Thronfolger Franz Ferdinand erschossen – der Auslöser des Kriegs.', schwer: true, aliases: ['Bosnien', 'Bosnien und Herzegowina'] },
  finnland: { name: 'Finnland', full: 'Großfürstentum Finnland', g: 'entente', cap: 'Helsinki', form: 'autonomes Großfürstentum im Russischen Reich', war: 'als Teil Russlands im Krieg', schwer: true, end: 'Unabhängig am 6. Dezember 1917.' },
  island: { name: 'Island', full: 'Island', g: 'neutral', cap: 'Reykjavík', form: 'Teil des dänischen Reichs (ab 1918 eigenes Königreich in Personalunion)', war: 'neutral', schwer: true },
  malta: { name: 'Malta', full: 'Malta', g: 'entente', cap: 'Valletta', form: 'britische Kolonie', war: 'Lazarett-Insel der Entente („Krankenschwester des Mittelmeers“)', schwer: true },
}
/** Normales Quiz: diese Flächen zählen zum Nachbarn */
export const EUROPA_1914_MIT = { 'deutsches-reich': ['elsass-lothringen'], 'oesterreich-ungarn': ['bosnien'], russland: ['finnland'], daenemark: ['island'], grossbritannien: ['malta'] }

/* ═══════════════════════ Kaiserreich 1871–1918 ═══════════════════════ */

export const STAATEN_1871 = {
  preussen: { name: 'Preußen', full: 'Königreich Preußen', art: 'Königreich', cap: 'Berlin', note: 'Größter Bundesstaat: fast zwei Drittel der Fläche des Reichs. Der preußische König war zugleich Deutscher Kaiser.' },
  bayern: { name: 'Bayern', full: 'Königreich Bayern', art: 'Königreich', cap: 'München', note: 'Hatte Sonderrechte: eigene Armee im Frieden, eigene Post und Eisenbahn.' },
  sachsen: { name: 'Sachsen', full: 'Königreich Sachsen', art: 'Königreich', cap: 'Dresden' },
  wuerttemberg: { name: 'Württemberg', full: 'Königreich Württemberg', art: 'Königreich', cap: 'Stuttgart' },
  baden: { name: 'Baden', full: 'Großherzogtum Baden', art: 'Großherzogtum', cap: 'Karlsruhe' },
  hessen: { name: 'Hessen', full: 'Großherzogtum Hessen', art: 'Großherzogtum', cap: 'Darmstadt', aliases: ['Hessen-Darmstadt', 'Großherzogtum Hessen'] },
  'mecklenburg-schwerin': { name: 'Mecklenburg-Schwerin', full: 'Großherzogtum Mecklenburg-Schwerin', art: 'Großherzogtum', cap: 'Schwerin' },
  'mecklenburg-strelitz': { name: 'Mecklenburg-Strelitz', full: 'Großherzogtum Mecklenburg-Strelitz', art: 'Großherzogtum', cap: 'Neustrelitz' },
  'sachsen-weimar': { name: 'Sachsen-Weimar-Eisenach', full: 'Großherzogtum Sachsen-Weimar-Eisenach', art: 'Großherzogtum', cap: 'Weimar', aliases: ['Sachsen-Weimar'] },
  oldenburg: { name: 'Oldenburg', full: 'Großherzogtum Oldenburg', art: 'Großherzogtum', cap: 'Oldenburg', note: 'Mit zwei weit entfernten Teilen: dem Fürstentum Lübeck (Eutin) und Birkenfeld an der Nahe.' },
  braunschweig: { name: 'Braunschweig', full: 'Herzogtum Braunschweig', art: 'Herzogtum', cap: 'Braunschweig' },
  'sachsen-meiningen': { name: 'Sachsen-Meiningen', full: 'Herzogtum Sachsen-Meiningen', art: 'Herzogtum', cap: 'Meiningen' },
  'sachsen-altenburg': { name: 'Sachsen-Altenburg', full: 'Herzogtum Sachsen-Altenburg', art: 'Herzogtum', cap: 'Altenburg' },
  'sachsen-coburg-gotha': { name: 'Sachsen-Coburg und Gotha', full: 'Herzogtum Sachsen-Coburg und Gotha', art: 'Herzogtum', cap: 'Coburg und Gotha', note: 'Stammhaus vieler europäischer Königsfamilien – auch des britischen Königshauses (bis 1917).', aliases: ['Sachsen-Coburg-Gotha', 'Coburg-Gotha'] },
  anhalt: { name: 'Anhalt', full: 'Herzogtum Anhalt', art: 'Herzogtum', cap: 'Dessau' },
  'schwarzburg-rudolstadt': { name: 'Schwarzburg-Rudolstadt', full: 'Fürstentum Schwarzburg-Rudolstadt', art: 'Fürstentum', cap: 'Rudolstadt' },
  'schwarzburg-sondershausen': { name: 'Schwarzburg-Sondershausen', full: 'Fürstentum Schwarzburg-Sondershausen', art: 'Fürstentum', cap: 'Sondershausen' },
  waldeck: { name: 'Waldeck-Pyrmont', full: 'Fürstentum Waldeck-Pyrmont', art: 'Fürstentum', cap: 'Arolsen', note: 'Wurde ab 1868 von Preußen verwaltet.', aliases: ['Waldeck'] },
  'reuss-aelt': { name: 'Reuß ältere Linie', full: 'Fürstentum Reuß älterer Linie', art: 'Fürstentum', cap: 'Greiz', note: 'Kleinster Flächenstaat des Reichs (gut 300 km²).', aliases: ['Reuß-Greiz', 'Reuß ä. L.'] },
  'reuss-juengere': { name: 'Reuß jüngere Linie', full: 'Fürstentum Reuß jüngerer Linie', art: 'Fürstentum', cap: 'Gera', aliases: ['Reuß-Gera', 'Reuß j. L.'] },
  'schaumburg-lippe': { name: 'Schaumburg-Lippe', full: 'Fürstentum Schaumburg-Lippe', art: 'Fürstentum', cap: 'Bückeburg', note: 'Zweitkleinster Flächenstaat des Reichs – nur Reuß ältere Linie war noch kleiner.' },
  lippe: { name: 'Lippe', full: 'Fürstentum Lippe', art: 'Fürstentum', cap: 'Detmold' },
  luebeck: { name: 'Lübeck', full: 'Freie und Hansestadt Lübeck', art: 'Freie Stadt', cap: 'Lübeck' },
  bremen: { name: 'Bremen', full: 'Freie Hansestadt Bremen', art: 'Freie Stadt', cap: 'Bremen' },
  hamburg: { name: 'Hamburg', full: 'Freie und Hansestadt Hamburg', art: 'Freie Stadt', cap: 'Hamburg' },
  'elsass-lothringen': { name: 'Elsass-Lothringen', full: 'Reichsland Elsaß-Lothringen', art: 'Reichsland', cap: 'Straßburg', note: 'Kein Bundesstaat, sondern „Reichsland“ – direkt dem Kaiser unterstellt (ab 1911 mit eigener Verfassung).' },
}

/* ═══════════════════════ Besatzungszonen 1945 ═══════════════════════ */

export const ZONEN_1945 = {
  us: { name: 'Amerikanische Zone', g: 'west', note: 'Bayern, Hessen, der Norden von Württemberg und Baden – dazu die Enklave Bremen.', aliases: ['US-Zone', 'Amerikanische Besatzungszone'] },
  uk: { name: 'Britische Zone', g: 'west', note: 'Nordrhein-Westfalen, Niedersachsen, Schleswig-Holstein und Hamburg.', aliases: ['Britische Besatzungszone'] },
  fr: { name: 'Französische Zone', g: 'west', note: 'Rheinland-Pfalz, der Süden von Baden und Württemberg mit Hohenzollern, dazu der Kreis Lindau.', aliases: ['Französische Besatzungszone'] },
  su: { name: 'Sowjetische Zone', g: 'ost', note: 'Mecklenburg-Vorpommern, Brandenburg, Sachsen, Sachsen-Anhalt und Thüringen – ab 1949 die DDR.', aliases: ['SBZ', 'Sowjetische Besatzungszone'] },
  saar: { name: 'Saarland', g: 'west', note: 'Zuerst Teil der französischen Zone, ab 1947 eigenes „Saarprotektorat“ unter französischer Kontrolle. Erst 1957 zu Deutschland.', aliases: ['Saarprotektorat', 'Saargebiet'] },
  bremen: { name: 'Bremen (US-Enklave)', g: 'west', note: 'Die Amerikaner brauchten einen Seehafen für den Nachschub – deshalb wurde Bremen mit Bremerhaven amerikanisch.', aliases: ['Bremen', 'Bremer Enklave'] },
  berlin: { name: 'Berlin', g: 'berlin', note: 'Viermächtestadt mitten in der sowjetischen Zone – geteilt in vier Sektoren.', aliases: ['Groß-Berlin'] },
  'ost-polen': { name: 'Gebiete unter polnischer Verwaltung', g: 'ost', note: 'Hinterpommern, Ostbrandenburg, Schlesien und das südliche Ostpreußen – heute Polen.', aliases: ['Ostgebiete', 'Polnische Verwaltung', 'Schlesien und Pommern'] },
  'ost-su': { name: 'Nördliches Ostpreußen', g: 'ost', note: 'Mit Königsberg unter sowjetischer Verwaltung – heute die russische Oblast Kaliningrad.', aliases: ['Königsberg', 'Kaliningrad', 'Ostpreußen'] },
}

/* ═══════════════════════ Berlin 1945–1990 ═══════════════════════ */

/** LOR-Bezirksregion (6-stellig) → alter Bezirk (Stand 1945–1979, 20 Bezirke) */
export function berlinBezirk(k6) {
  const bz = k6.slice(0, 2), pr = k6.slice(0, 4)
  switch (bz) {
    case '01': return pr === '0101' ? (k6 === '010111' ? 'tiergarten' : 'mitte') : pr === '0102' ? 'tiergarten' : 'wedding'
    case '02': return pr <= '0203' ? 'kreuzberg' : 'friedrichshain'
    case '03':
      if (pr === '0306' || pr === '0307') return 'prenzlauer-berg'
      if (pr === '0305' || pr === '0303') return 'weissensee'
      return 'pankow'
    case '04': return ['040310', '040411', '040412', '040413', '040514', '040515', '040516', '040617'].includes(k6) ? 'wilmersdorf' : 'charlottenburg'
    case '05': return 'spandau'
    case '06': return ['060305', '060407', '060408'].includes(k6) ? 'zehlendorf' : 'steglitz'
    case '07': return ['070101', '070202', '070303'].includes(k6) ? 'schoeneberg' : 'tempelhof'
    case '08': return 'neukoelln'
    case '09': return ['090101', '090102', '090103', '090104', '090206', '090207', '090309', '090310'].includes(k6) ? 'treptow' : 'koepenick'
    case '10': return 'lichtenberg'
    case '11': return pr === '1101' || pr === '1102' ? 'weissensee' : 'lichtenberg'
    case '12': return 'reinickendorf'
  }
  return null
}
export const BERLIN_BEZIRKE = {
  mitte: { name: 'Mitte', s: 'su' }, 'prenzlauer-berg': { name: 'Prenzlauer Berg', s: 'su' }, friedrichshain: { name: 'Friedrichshain', s: 'su' },
  pankow: { name: 'Pankow', s: 'su' }, weissensee: { name: 'Weißensee', s: 'su', note: 'Umfasste bis 1985 auch Hohenschönhausen.' }, lichtenberg: { name: 'Lichtenberg', s: 'su', note: 'Umfasste bis 1979 auch Marzahn und Hellersdorf.' },
  treptow: { name: 'Treptow', s: 'su' }, koepenick: { name: 'Köpenick', s: 'su' },
  kreuzberg: { name: 'Kreuzberg', s: 'us' }, neukoelln: { name: 'Neukölln', s: 'us' }, tempelhof: { name: 'Tempelhof', s: 'us', note: 'Mit dem Flughafen Tempelhof – Ziel der Luftbrücke 1948/49.' },
  schoeneberg: { name: 'Schöneberg', s: 'us', note: 'Im Rathaus Schöneberg saß der West-Berliner Senat. Hier sagte Kennedy 1963 „Ich bin ein Berliner“.' },
  steglitz: { name: 'Steglitz', s: 'us' }, zehlendorf: { name: 'Zehlendorf', s: 'us' },
  tiergarten: { name: 'Tiergarten', s: 'uk', note: 'Mit dem Reichstag direkt an der Mauer.' }, charlottenburg: { name: 'Charlottenburg', s: 'uk' }, wilmersdorf: { name: 'Wilmersdorf', s: 'uk' },
  spandau: { name: 'Spandau', s: 'uk', note: 'Mit dem Kriegsverbrechergefängnis Spandau (bis 1987).' },
  wedding: { name: 'Wedding', s: 'fr' }, reinickendorf: { name: 'Reinickendorf', s: 'fr', note: 'Mit dem Flughafen Tegel – während der Luftbrücke in nur 90 Tagen gebaut.' },
}
export const SEKTOREN = {
  us: { name: 'Amerikanischer Sektor', color: '#5b8fd1' }, uk: { name: 'Britischer Sektor', color: '#c9637a' },
  fr: { name: 'Französischer Sektor', color: '#5fb07a' }, su: { name: 'Sowjetischer Sektor (Ost-Berlin)', color: '#d9774b' },
}

/* ═══════════════════════ Afrika und die Welt 1914 (Kolonien) ═══════════════════════ */
// Jede Kolonie besteht aus heutigen Ländern (NE: ISO3) und Provinzen (NE1: [ISO3, [Namen]]).
// m = Kolonialmacht

export const MAECHTE = {
  gb: { name: 'Britisches Weltreich', color: '#d9534f' }, fr: { name: 'Frankreich', color: '#4f7fd9' }, de: { name: 'Deutsches Reich', color: '#7a7a7a' },
  pt: { name: 'Portugal', color: '#3fa36b' }, es: { name: 'Spanien', color: '#e6b422' }, it: { name: 'Italien', color: '#8fc45a' },
  be: { name: 'Belgien', color: '#b8860b' }, nl: { name: 'Niederlande', color: '#f08a24' }, us: { name: 'USA', color: '#6a5acd' },
  jp: { name: 'Japan', color: '#e377c2' }, ru: { name: 'Russland', color: '#8c564b' }, dk: { name: 'Dänemark', color: '#c76b98' },
  os: { name: 'Osmanisches Reich', color: '#a0522d' }, frei: { name: 'Unabhängig', color: '#e8d9a8' },
}

const NEUKAMERUN = [['GAB', ['Wouleu-Ntem']], ['COG', ['Likouala', 'Sangha']], ['CAF', ['Sangha-Mbaéré', 'Mambéré-Kadéï', 'Lobaye']]]
export const KOLONIEN_AFRIKA = {
  'deutsch-ostafrika': { name: 'Deutsch-Ostafrika', m: 'de', cap: 'Daressalam', parts: ['TZA', 'RWA', 'BDI'], note: 'Mit Ruanda und Urundi (Burundi). Sansibar war britisch.', aliases: ['DOA'] },
  'deutsch-suedwestafrika': { name: 'Deutsch-Südwestafrika', m: 'de', cap: 'Windhuk', parts: ['NAM'], note: 'Ohne die Walfischbucht (britisch). Hier verübte die Schutztruppe 1904–1908 den Völkermord an Herero und Nama.', aliases: ['DSWA', 'Südwestafrika'] },
  kamerun: { name: 'Kamerun', m: 'de', cap: 'Buea (Regierungssitz seit 1901)', parts: ['CMR'], ne1: NEUKAMERUN, note: 'Mit „Neukamerun“ (1911 von Frankreich abgetreten) – dessen Grenzen sind hier nach heutigen Provinzen angenähert.' },
  togo: { name: 'Togo', m: 'de', cap: 'Lome', parts: ['TGO'], ne1: [['GHA', ['Volta']]], note: 'Größer als das heutige Togo: Der Westteil (heute Volta-Region in Ghana) gehörte dazu.' },
  'franz-westafrika': { name: 'Französisch-Westafrika', m: 'fr', cap: 'Dakar', parts: ['SEN', 'MRT', 'MLI', 'BFA', 'GIN', 'CIV', 'BEN', 'NER'], aliases: ['AOF', 'Französisch Westafrika'] },
  'franz-aequatorialafrika': { name: 'Französisch-Äquatorialafrika', m: 'fr', cap: 'Brazzaville', parts: ['TCD'], ne1x: NEUKAMERUN.map(([c, n]) => [c, n]), note: 'Gabun, Mittlerer Kongo, Ubangi-Schari und Tschad.', aliases: ['AEF', 'Französisch Äquatorialafrika'] },
  algerien: { name: 'Algerien', m: 'fr', cap: 'Algier', parts: ['DZA'], note: 'Galt als Teil Frankreichs (drei Départements im Norden).' },
  tunesien: { name: 'Tunesien', m: 'fr', cap: 'Tunis', parts: ['TUN'], note: 'Französisches Protektorat seit 1881.' },
  marokko: { name: 'Französisch-Marokko', m: 'fr', cap: 'Rabat', parts: ['MAR'], minusHb: 'Spanish Morocco', note: 'Französisches Protektorat seit 1912.', aliases: ['Marokko'] },
  madagaskar: { name: 'Madagaskar', m: 'fr', cap: 'Tananarive (Antananarivo)', parts: ['MDG', 'COM'], note: 'Mit den Komoren (seit 1912 verbunden).' },
  dschibuti: { name: 'Französisch-Somaliküste', m: 'fr', cap: 'Dschibuti', parts: ['DJI'], aliases: ['Dschibuti', 'Französisch-Somaliland'] },
  aegypten: { name: 'Ägypten', m: 'gb', cap: 'Kairo', parts: ['EGY'], note: 'Seit 1882 britisch besetzt, formal bis Dezember 1914 osmanisch – dann britisches Protektorat.' },
  sudan: { name: 'Anglo-Ägyptischer Sudan', m: 'gb', cap: 'Khartum', parts: ['SDN', 'SDS'], note: 'Gemeinsam von Großbritannien und Ägypten verwaltet – heute Sudan und Südsudan.', aliases: ['Sudan'] },
  'britisch-ostafrika': { name: 'Britisch-Ostafrika', m: 'gb', cap: 'Nairobi', parts: ['KEN'], ne1: [['SOM', ['Jubbada Hoose', 'Jubbada Dhexe', 'Gedo']]], note: 'Heute Kenia. Jubaland im Norden kam 1925 an Italienisch-Somaliland.', aliases: ['Kenia'] },
  uganda: { name: 'Uganda', m: 'gb', cap: 'Entebbe', parts: ['UGA'] },
  'britisch-somaliland': { name: 'Britisch-Somaliland', m: 'gb', cap: 'Berbera', parts: [], ne1: [['SOL', ['Somaliland']]], aliases: ['Somaliland'] },
  njassaland: { name: 'Njassaland', m: 'gb', cap: 'Zomba', parts: ['MWI'], note: 'Heute Malawi.', aliases: ['Nyassaland', 'Malawi'] },
  nordrhodesien: { name: 'Nordrhodesien', m: 'gb', cap: 'Livingstone', parts: ['ZMB'], note: 'Von der British South Africa Company verwaltet – heute Sambia.', aliases: ['Sambia'] },
  suedrhodesien: { name: 'Südrhodesien', m: 'gb', cap: 'Salisbury (heute Harare)', parts: ['ZWE'], note: 'Von der British South Africa Company verwaltet – heute Simbabwe.', aliases: ['Rhodesien', 'Simbabwe'] },
  betschuanaland: { name: 'Betschuanaland', m: 'gb', cap: 'Mafeking (lag außerhalb, in Südafrika!)', parts: ['BWA'], note: 'Heute Botswana.', aliases: ['Botswana'] },
  basutoland: { name: 'Basutoland', m: 'gb', cap: 'Maseru', parts: ['LSO'], note: 'Heute Lesotho.', aliases: ['Lesotho'] },
  swasiland: { name: 'Swasiland', m: 'gb', cap: 'Mbabane', parts: ['SWZ'], note: 'Heute Eswatini.', aliases: ['Eswatini'] },
  suedafrika: { name: 'Südafrikanische Union', m: 'gb', cap: 'Pretoria · Kapstadt · Bloemfontein', parts: ['ZAF'], note: 'Britisches Dominion seit 1910 – mit drei Hauptstädten.', aliases: ['Südafrika'] },
  nigeria: { name: 'Nigeria', m: 'gb', cap: 'Lagos', parts: ['NGA'], note: 'Am 1. Januar 1914 aus Nord- und Südnigeria vereinigt.' },
  goldkueste: { name: 'Goldküste', m: 'gb', cap: 'Accra', parts: [], ne1x: [['GHA', ['Volta']]], note: 'Heute Ghana.', aliases: ['Ghana'] },
  'sierra-leone': { name: 'Sierra Leone', m: 'gb', cap: 'Freetown', parts: ['SLE'] },
  gambia: { name: 'Gambia', m: 'gb', cap: 'Bathurst (heute Banjul)', parts: ['GMB'] },
  angola: { name: 'Angola', m: 'pt', cap: 'Luanda', parts: ['AGO'] },
  mosambik: { name: 'Mosambik', m: 'pt', cap: 'Lourenço Marques (heute Maputo)', parts: ['MOZ'], aliases: ['Portugiesisch-Ostafrika'] },
  'portugiesisch-guinea': { name: 'Portugiesisch-Guinea', m: 'pt', cap: 'Bolama', parts: ['GNB'], note: 'Heute Guinea-Bissau.', aliases: ['Guinea-Bissau'] },
  kapverden: { name: 'Kapverden', m: 'pt', cap: 'Praia', parts: ['CPV'] },
  'sao-tome': { name: 'São Tomé und Príncipe', m: 'pt', cap: 'São Tomé', parts: ['STP'] },
  'spanisch-sahara': { name: 'Spanisch-Sahara', m: 'es', cap: 'Villa Cisneros (heute Dakhla)', parts: ['SAH'], note: 'Río de Oro und Saguia el-Hamra – heute Westsahara.', aliases: ['Westsahara', 'Rio de Oro'] },
  'spanisch-guinea': { name: 'Spanisch-Guinea', m: 'es', cap: 'Santa Isabel (heute Malabo)', parts: ['GNQ'], note: 'Heute Äquatorialguinea.', aliases: ['Äquatorialguinea'] },
  'spanisch-marokko': { name: 'Spanisch-Marokko', m: 'es', cap: 'Tetuan', hb: 'Spanish Morocco', note: 'Spanisches Protektorat im Norden Marokkos (seit 1912).' },
  libyen: { name: 'Libyen', m: 'it', cap: 'Tripolis', parts: ['LBY'], note: '1912 dem Osmanischen Reich abgenommen – kontrolliert waren 1914 aber fast nur die Küstenorte.', aliases: ['Tripolitanien'] },
  eritrea: { name: 'Eritrea', m: 'it', cap: 'Asmara', parts: ['ERI'] },
  'italienisch-somaliland': { name: 'Italienisch-Somaliland', m: 'it', cap: 'Mogadischu', parts: [], ne1x: [['SOM', ['Jubbada Hoose', 'Jubbada Dhexe', 'Gedo']]], aliases: ['Somalia'] },
  'belgisch-kongo': { name: 'Belgisch-Kongo', m: 'be', cap: 'Boma', parts: ['COD'], note: 'Bis 1908 Privatbesitz von König Leopold II. („Kongogräuel“).', aliases: ['Kongo'] },
  abessinien: { name: 'Abessinien', m: 'frei', cap: 'Addis Abeba', parts: ['ETH'], note: 'Unabhängiges Kaiserreich – schlug Italien 1896 bei Adua.', aliases: ['Äthiopien'] },
  liberia: { name: 'Liberia', m: 'frei', cap: 'Monrovia', parts: ['LBR'], note: 'Unabhängige Republik, 1847 von freigelassenen Sklaven aus den USA gegründet.' },
}

/** Kolonien außerhalb Afrikas (für die Weltkarte 1914) */
const PAPUA = ['Western', 'Gulf', 'Central', 'National Capital District', 'Northern', 'Milne Bay', 'Southern Highlands']
export const KOLONIEN_WELT = {
  'britisch-indien': { name: 'Britisch-Indien', m: 'gb', cap: 'Delhi (seit 1911, vorher Kalkutta)', parts: ['IND', 'PAK', 'BGD', 'MMR'], note: 'Mit Birma (Myanmar) bis 1937. Heute Indien, Pakistan, Bangladesch und Myanmar.', aliases: ['Indien', 'Britisch Indien'] },
  ceylon: { name: 'Ceylon', m: 'gb', cap: 'Colombo', parts: ['LKA'], note: 'Heute Sri Lanka.', aliases: ['Sri Lanka'] },
  malaya: { name: 'Britisch-Malaya', m: 'gb', cap: 'Singapur und Kuala Lumpur', parts: ['SGP'], ne1x: [['MYS', ['Sabah', 'Sarawak', 'Labuan']]], note: 'Straits Settlements (Singapur, Penang, Malakka) und malaiische Sultanate unter britischem Schutz.', aliases: ['Malaya', 'Malaysia'] },
  'britisch-borneo': { name: 'Britisch-Borneo', m: 'gb', cap: 'Kuching und Sandakan', parts: ['BRN'], ne1: [['MYS', ['Sabah', 'Sarawak', 'Labuan']]], note: 'Sarawak (von den „weißen Rajas“ der Familie Brooke regiert), Nord-Borneo und Brunei.' },
  hongkong: { name: 'Hongkong', m: 'gb', cap: 'Victoria', parts: ['HKG'], note: 'Britische Kolonie bis 1997.' },
  kanada: { name: 'Kanada', m: 'gb', cap: 'Ottawa', parts: [], ne1x: [['CAN', ['Newfoundland and Labrador']]], note: 'Dominion – sich selbst regierend, aber Teil des Britischen Weltreichs.' },
  neufundland: { name: 'Neufundland', m: 'gb', cap: 'St. John’s', parts: [], ne1: [['CAN', ['Newfoundland and Labrador']]], note: 'Eigenes Dominion, erst 1949 zu Kanada.' },
  australien: { name: 'Australien', m: 'gb', cap: 'Melbourne (Regierungssitz bis 1927)', parts: ['AUS'], note: 'Dominion seit 1901 – Canberra wurde erst gebaut.' },
  neuseeland: { name: 'Neuseeland', m: 'gb', cap: 'Wellington', parts: ['NZL'], note: 'Dominion seit 1907.' },
  papua: { name: 'Papua', m: 'gb', cap: 'Port Moresby', parts: [], ne1: [['PNG', PAPUA]], note: 'Britisch, aber von Australien verwaltet – der Süden des heutigen Papua-Neuguinea.' },
  'britisch-guayana': { name: 'Britisch-Guayana', m: 'gb', cap: 'Georgetown', parts: ['GUY'], aliases: ['Guyana'] },
  'britisch-honduras': { name: 'Britisch-Honduras', m: 'gb', cap: 'Belize', parts: ['BLZ'], aliases: ['Belize'] },
  jamaika: { name: 'Jamaika', m: 'gb', cap: 'Kingston', parts: ['JAM'] },
  trinidad: { name: 'Trinidad und Tobago', m: 'gb', cap: 'Port of Spain', parts: ['TTO'] },
  bahamas: { name: 'Bahamas', m: 'gb', cap: 'Nassau', parts: ['BHS'] },
  fidschi: { name: 'Fidschi', m: 'gb', cap: 'Suva', parts: ['FJI'] },
  salomonen: { name: 'Salomonen', m: 'gb', cap: 'Tulagi', parts: ['SLB'], aliases: ['Britische Salomonen'] },
  indochina: { name: 'Französisch-Indochina', m: 'fr', cap: 'Hanoi', parts: ['VNM', 'LAO', 'KHM'], note: 'Heute Vietnam, Laos und Kambodscha.', aliases: ['Indochina'] },
  'franz-guayana': { name: 'Französisch-Guayana', m: 'fr', cap: 'Cayenne', parts: [], ne1: [['FRA', ['Guyane française']]], note: 'Mit der berüchtigten Strafkolonie (Teufelsinsel).' },
  neukaledonien: { name: 'Neukaledonien', m: 'fr', cap: 'Nouméa', parts: ['NCL'] },
  'franz-polynesien': { name: 'Französisch-Ozeanien', m: 'fr', cap: 'Papeete', parts: ['PYF'], note: 'Heute Französisch-Polynesien (Tahiti).', aliases: ['Französisch-Polynesien', 'Tahiti'] },
  'neue-hebriden': { name: 'Neue Hebriden', m: 'fr', cap: 'Port Vila', parts: ['VUT'], note: 'Britisch-französisches Kondominium – heute Vanuatu.', aliases: ['Vanuatu'] },
  'niederlaendisch-indien': { name: 'Niederländisch-Indien', m: 'nl', cap: 'Batavia (heute Jakarta)', parts: ['IDN'], note: 'Heute Indonesien.', aliases: ['Indonesien', 'Niederländisch Indien'] },
  suriname: { name: 'Niederländisch-Guayana', m: 'nl', cap: 'Paramaribo', parts: ['SUR'], aliases: ['Suriname', 'Surinam'] },
  curacao: { name: 'Curaçao', m: 'nl', cap: 'Willemstad', parts: ['CUW', 'ABW'], note: 'Niederländische Antillen.' },
  'portugiesisch-timor': { name: 'Portugiesisch-Timor', m: 'pt', cap: 'Dili', parts: ['TLS'], aliases: ['Osttimor', 'Timor'] },
  macau: { name: 'Macau', m: 'pt', cap: 'Macau', parts: ['MAC'] },
  philippinen: { name: 'Philippinen', m: 'us', cap: 'Manila', parts: ['PHL'], note: '1898 von Spanien an die USA.' },
  'puerto-rico': { name: 'Puerto Rico', m: 'us', cap: 'San Juan', parts: ['PRI'], note: '1898 von Spanien an die USA.' },
  hawaii: { name: 'Hawaii', m: 'us', cap: 'Honolulu', parts: [], ne1: [['USA', ['Hawaii']]], note: '1898 von den USA annektiert, Bundesstaat erst 1959.' },
  guam: { name: 'Guam', m: 'us', cap: 'Hagåtña', parts: ['GUM'] },
  'amerikanisch-samoa': { name: 'Amerikanisch-Samoa', m: 'us', cap: 'Pago Pago', parts: ['ASM'] },
  korea: { name: 'Korea', m: 'jp', cap: 'Keijō (heute Seoul)', parts: ['KOR', 'PRK'], note: '1910 von Japan annektiert.', aliases: ['Chōsen'] },
  taiwan: { name: 'Taiwan', m: 'jp', cap: 'Taihoku (heute Taipeh)', parts: ['TWN'], note: '1895 von China an Japan.', aliases: ['Formosa'] },
  'deutsch-neuguinea': { name: 'Deutsch-Neuguinea', m: 'de', cap: 'Rabaul', parts: ['NRU', 'MHL', 'FSM', 'PLW', 'MNP'], ne1x: [['PNG', PAPUA]], note: 'Kaiser-Wilhelmsland, Bismarck-Archipel, Bougainville, Marshallinseln, Karolinen, Marianen, Palau und Nauru.' },
  'deutsch-samoa': { name: 'Deutsch-Samoa', m: 'de', cap: 'Apia', parts: ['WSM'], aliases: ['Samoa'] },
  kiautschou: { name: 'Kiautschou', m: 'de', cap: 'Tsingtau', point: [120.33, 36.07], note: 'Pachtgebiet in China (1898–1914) – berühmt fürs Tsingtao-Bier.', aliases: ['Tsingtau', 'Kiautschou-Bucht'] },
  groenland: { name: 'Grönland', m: 'dk', cap: 'Godthåb (heute Nuuk)', parts: ['GRL'] },
  'daenisch-westindien': { name: 'Dänisch-Westindien', m: 'dk', cap: 'Charlotte Amalie', parts: ['VIR'], note: '1917 an die USA verkauft – heute Amerikanische Jungferninseln.', aliases: ['Jungferninseln'] },
}
/** Mutterländer in historical-basemaps 1914 (für das Imperien-Quiz) */
export const HB_1914_WELT = {
  'United Kingdom of Great Britain and Ireland': 'grossbritannien', France: 'frankreich', 'Kingdom of Italy': 'italien', Netherlands: 'niederlande',
  Portugal: 'portugal', Spain: 'spanien', 'United States': 'usa', 'Empire of Japan': 'japan', 'Manchu Empire': 'china', Xinjiang: 'china',
  Tibet: 'tibet', Mongolia: 'mongolei', 'Rattanakosin Kingdom': 'siam', Abyssinia: 'abessinien', Liberia: 'liberia',
}
export const MUTTERLAND = { gb: ['grossbritannien'], fr: ['frankreich'], de: ['deutsches-reich'], pt: ['portugal'], es: ['spanien'], it: ['italien', 'dodekanes'], be: ['belgien'], nl: ['niederlande'], us: ['usa'], jp: ['japan'], ru: ['russland', 'finnland'], dk: ['daenemark', 'island'], os: ['osmanisches'] }

/* ═══════════════════════ Sowjetunion ═══════════════════════ */

export const SSR = {
  RUS: { ssr: 'Russische SFSR', cap: 'Moskau', capThen: 'Moskau', ind: '25. Dezember 1991 (Umbenennung in Russische Föderation)', g: 'russland', note: 'Größte Republik – rund drei Viertel der Fläche der Sowjetunion.' },
  UKR: { ssr: 'Ukrainische SSR', cap: 'Kiew', capThen: 'Kiew', ind: '24. August 1991', g: 'osteuropa', note: 'Hauptstadt war bis 1934 Charkiw.' },
  BLR: { ssr: 'Weißrussische SSR', cap: 'Minsk', capThen: 'Minsk', ind: '25. August 1991', g: 'osteuropa', aliases: ['Weißrussland'] },
  MDA: { ssr: 'Moldauische SSR', cap: 'Chișinău', capThen: 'Kischinjow', ind: '27. August 1991', g: 'osteuropa', aliases: ['Moldawien', 'Moldova'] },
  EST: { ssr: 'Estnische SSR', cap: 'Tallinn', capThen: 'Tallinn', ind: '20. August 1991', g: 'baltikum', note: 'Die baltischen Staaten waren 1918–1940 schon einmal unabhängig.' },
  LVA: { ssr: 'Lettische SSR', cap: 'Riga', capThen: 'Riga', ind: '21. August 1991', g: 'baltikum' },
  LTU: { ssr: 'Litauische SSR', cap: 'Vilnius', capThen: 'Vilnius', ind: '11. März 1990', g: 'baltikum', note: 'Erklärte als erste Sowjetrepublik ihre Unabhängigkeit.' },
  GEO: { ssr: 'Georgische SSR', cap: 'Tiflis (Tbilissi)', capThen: 'Tiflis', ind: '9. April 1991', g: 'kaukasus', note: 'Heimat von Josef Stalin (geboren in Gori).' },
  ARM: { ssr: 'Armenische SSR', cap: 'Jerewan', capThen: 'Jerewan', ind: '21. September 1991', g: 'kaukasus' },
  AZE: { ssr: 'Aserbaidschanische SSR', cap: 'Baku', capThen: 'Baku', ind: '30. August 1991 (Erklärung)', g: 'kaukasus' },
  KAZ: { ssr: 'Kasachische SSR', cap: 'Astana', capThen: 'Alma-Ata', ind: '16. Dezember 1991', g: 'zentralasien', note: 'Erklärte als letzte Republik ihre Unabhängigkeit. Hauptstadt seit 1997 Astana (2019–2022 „Nur-Sultan“).' },
  UZB: { ssr: 'Usbekische SSR', cap: 'Taschkent', capThen: 'Taschkent', ind: '31. August 1991', g: 'zentralasien', note: 'Hauptstadt war bis 1930 Samarkand.' },
  TKM: { ssr: 'Turkmenische SSR', cap: 'Aşgabat', capThen: 'Aschchabad', ind: '27. Oktober 1991', g: 'zentralasien' },
  KGZ: { ssr: 'Kirgisische SSR', cap: 'Bischkek', capThen: 'Frunse', ind: '31. August 1991', g: 'zentralasien', note: 'Die Hauptstadt hieß 1926–1991 Frunse.' },
  TJK: { ssr: 'Tadschikische SSR', cap: 'Duschanbe', capThen: 'Stalinabad (bis 1961), dann Duschanbe', ind: '9. September 1991', g: 'zentralasien' },
}

/* ═══════════════════════ Jugoslawien ═══════════════════════ */
// su = Natural-Earth-Teilgebiet (map_subunits SU_A3)
export const JUGOSLAWIEN = {
  slowenien: { name: 'Slowenien', su: ['SVN'], cap: 'Ljubljana', ind: '25. Juni 1991', g: 'republik', today: 'Slowenien' },
  kroatien: { name: 'Kroatien', su: ['HRV'], cap: 'Zagreb', ind: '25. Juni 1991', g: 'republik', today: 'Kroatien' },
  bosnien: { name: 'Bosnien und Herzegowina', su: ['BHF', 'BIS', 'BHB'], cap: 'Sarajevo', ind: '3. März 1992', g: 'republik', today: 'Bosnien und Herzegowina', aliases: ['Bosnien-Herzegowina', 'Bosnien'] },
  serbien: { name: 'Serbien', su: ['SRS'], cap: 'Belgrad', ind: '5. Juni 2006 (als Nachfolgestaat)', g: 'republik', today: 'Serbien', note: 'Belgrad war auch die Hauptstadt ganz Jugoslawiens.' },
  montenegro: { name: 'Montenegro', su: ['MNE'], cap: 'Titograd (heute Podgorica)', ind: '3. Juni 2006', g: 'republik', today: 'Montenegro', capThen: 'Titograd' },
  mazedonien: { name: 'Mazedonien', su: ['MKD'], cap: 'Skopje', ind: '8. September 1991', g: 'republik', today: 'Nordmazedonien (seit 2019)', aliases: ['Nordmazedonien', 'Makedonien'] },
  vojvodina: { name: 'Vojvodina', su: ['SRV'], cap: 'Novi Sad', ind: '– (bis heute autonome Provinz Serbiens)', g: 'provinz', today: 'Serbien' },
  kosovo: { name: 'Kosovo', su: ['KOS'], cap: 'Priština', ind: '17. Februar 2008 (nicht von allen Staaten anerkannt)', g: 'provinz', today: 'Kosovo' },
}

/* ═══════════════════════ Europa 1989 ═══════════════════════ */

export const EUROPA_1989 = {
  // world: heutiges Land mit gleichen Grenzen · hist: eigene Fläche
  brd: { name: 'Bundesrepublik Deutschland', hist: true, g: 'nato', cap: 'Bonn', join: 'NATO seit 1955', note: 'Am 3. Oktober 1990 trat die DDR der Bundesrepublik bei.', aliases: ['BRD', 'Westdeutschland'], today: 'Deutschland (westliche Bundesländer)' },
  'west-berlin': { name: 'West-Berlin', hist: true, g: 'sonder', cap: '–', join: 'Sonderstatus: von den USA, Großbritannien und Frankreich besetzt, eng mit der BRD verbunden', note: 'Am 9. November 1989 fiel die Mauer.', aliases: ['Westberlin'], today: 'Deutschland (Berlin)' },
  ddr: { name: 'DDR', hist: true, g: 'wp', cap: 'Ost-Berlin', join: 'Warschauer Pakt seit 1955/56', note: 'Mauerfall am 9. November 1989, Beitritt zur Bundesrepublik am 3. Oktober 1990.', aliases: ['Deutsche Demokratische Republik', 'Ostdeutschland'], today: 'Deutschland (östliche Bundesländer)' },
  cssr: { name: 'Tschechoslowakei', hist: true, g: 'wp', cap: 'Prag', join: 'Warschauer Pakt seit 1955', note: 'Samtene Revolution im November 1989. Am 1. Januar 1993 friedlich geteilt.', aliases: ['ČSSR', 'CSSR', 'Tschecho-Slowakei'], today: 'Tschechien, Slowakei' },
  jugoslawien: { name: 'Jugoslawien', hist: true, g: 'neutral', cap: 'Belgrad', join: 'blockfrei – Mitgründer der Bewegung der Blockfreien Staaten (1961)', note: 'Zerfiel ab 1991 in mehreren Kriegen.', aliases: ['SFRJ'], today: 'Slowenien, Kroatien, Bosnien und Herzegowina, Serbien, Montenegro, Kosovo, Nordmazedonien' },
  sowjetunion: { name: 'Sowjetunion', hist: true, g: 'wp', cap: 'Moskau', join: 'Führungsmacht des Warschauer Pakts', note: 'Am 26. Dezember 1991 aufgelöst – 15 Nachfolgestaaten.', aliases: ['UdSSR', 'SU'], today: '15 Staaten von Estland bis Kasachstan' },
  POL: { name: 'Polen', g: 'wp', cap: 'Warschau', join: 'Warschauer Pakt seit 1955', note: 'Im Juni 1989 fanden die ersten halbfreien Wahlen statt – die Solidarność gewann.', aliases: ['Volksrepublik Polen'] },
  HUN: { name: 'Ungarn', g: 'wp', cap: 'Budapest', join: 'Warschauer Pakt seit 1955', note: 'Baute ab Mai 1989 den Grenzzaun zu Österreich ab – beim „Paneuropäischen Picknick“ im August flohen Hunderte DDR-Bürger.' },
  ROU: { name: 'Rumänien', g: 'wp', cap: 'Bukarest', join: 'Warschauer Pakt seit 1955', note: 'Revolution im Dezember 1989 – Diktator Ceaușescu wurde am 25. Dezember hingerichtet.' },
  BGR: { name: 'Bulgarien', g: 'wp', cap: 'Sofia', join: 'Warschauer Pakt seit 1955', note: 'Staatschef Schiwkow wurde am 10. November 1989 gestürzt.' },
  ALB: { name: 'Albanien', g: 'neutral', cap: 'Tirana', join: '1968 aus dem Warschauer Pakt ausgetreten – völlig abgeschottet' },
  GBR: { name: 'Vereinigtes Königreich', g: 'nato', cap: 'London', join: 'NATO-Gründungsmitglied (1949)', aliases: ['Großbritannien', 'England'] },
  FRA: { name: 'Frankreich', g: 'nato', cap: 'Paris', join: 'NATO-Gründungsmitglied (1949) – aber 1966 aus der Militärstruktur ausgetreten' },
  BEL: { name: 'Belgien', g: 'nato', cap: 'Brüssel', join: 'NATO-Gründungsmitglied (1949), Sitz des NATO-Hauptquartiers' },
  NLD: { name: 'Niederlande', g: 'nato', cap: 'Amsterdam', join: 'NATO-Gründungsmitglied (1949)' },
  LUX: { name: 'Luxemburg', g: 'nato', cap: 'Luxemburg', join: 'NATO-Gründungsmitglied (1949)' },
  DNK: { name: 'Dänemark', g: 'nato', cap: 'Kopenhagen', join: 'NATO-Gründungsmitglied (1949)' },
  NOR: { name: 'Norwegen', g: 'nato', cap: 'Oslo', join: 'NATO-Gründungsmitglied (1949) – grenzte an die Sowjetunion' },
  ISL: { name: 'Island', g: 'nato', cap: 'Reykjavík', join: 'NATO-Gründungsmitglied (1949) – ohne eigene Armee' },
  PRT: { name: 'Portugal', g: 'nato', cap: 'Lissabon', join: 'NATO-Gründungsmitglied (1949)' },
  ITA: { name: 'Italien', g: 'nato', cap: 'Rom', join: 'NATO-Gründungsmitglied (1949)' },
  GRC: { name: 'Griechenland', g: 'nato', cap: 'Athen', join: 'NATO seit 1952' },
  TUR: { name: 'Türkei', g: 'nato', cap: 'Ankara', join: 'NATO seit 1952 – grenzte an die Sowjetunion' },
  ESP: { name: 'Spanien', g: 'nato', cap: 'Madrid', join: 'NATO seit 1982' },
  AUT: { name: 'Österreich', g: 'neutral', cap: 'Wien', join: 'neutral (seit 1955)' },
  CHE: { name: 'Schweiz', g: 'neutral', cap: 'Bern', join: 'neutral' },
  SWE: { name: 'Schweden', g: 'neutral', cap: 'Stockholm', join: 'neutral' },
  FIN: { name: 'Finnland', g: 'neutral', cap: 'Helsinki', join: 'neutral – mit Rücksicht auf die Sowjetunion („Finnlandisierung“)' },
  IRL: { name: 'Irland', g: 'neutral', cap: 'Dublin', join: 'neutral' },
  CYP: { name: 'Zypern', g: 'neutral', cap: 'Nikosia', join: 'blockfrei' },
  MLT: { name: 'Malta', g: 'neutral', cap: 'Valletta', join: 'blockfrei' },
  LIE: { name: 'Liechtenstein', g: 'neutral', cap: 'Vaduz', join: 'neutral' },
  AND: { name: 'Andorra', g: 'neutral', cap: 'Andorra la Vella', join: 'neutral' },
  MCO: { name: 'Monaco', g: 'neutral', cap: 'Monaco', join: 'neutral' },
  SMR: { name: 'San Marino', g: 'neutral', cap: 'San Marino', join: 'neutral' },
}

/* ═══════════════════════ Neue Staaten seit 1990 ═══════════════════════ */

export const NEUE_STAATEN = {
  NAM: { y: 1990, d: '21. März 1990', from: 'Südafrika', g: 'afrika' },
  YEM: { y: 1990, d: '22. Mai 1990', from: 'Vereinigung von Nord- und Südjemen', g: 'vereinigt' },
  DEU: { y: 1990, d: '3. Oktober 1990', from: 'Beitritt der DDR zur Bundesrepublik', g: 'vereinigt' },
  LTU: { y: 1990, d: '11. März 1990', from: 'Sowjetunion', g: 'sowjet' },
  EST: { y: 1991, d: '20. August 1991', from: 'Sowjetunion', g: 'sowjet' },
  LVA: { y: 1991, d: '21. August 1991', from: 'Sowjetunion', g: 'sowjet' },
  UKR: { y: 1991, d: '24. August 1991', from: 'Sowjetunion', g: 'sowjet' },
  BLR: { y: 1991, d: '25. August 1991', from: 'Sowjetunion', g: 'sowjet' },
  MDA: { y: 1991, d: '27. August 1991', from: 'Sowjetunion', g: 'sowjet' },
  GEO: { y: 1991, d: '9. April 1991', from: 'Sowjetunion', g: 'sowjet' },
  ARM: { y: 1991, d: '21. September 1991', from: 'Sowjetunion', g: 'sowjet' },
  AZE: { y: 1991, d: '30. August 1991', from: 'Sowjetunion', g: 'sowjet' },
  KAZ: { y: 1991, d: '16. Dezember 1991', from: 'Sowjetunion', g: 'sowjet' },
  UZB: { y: 1991, d: '31. August 1991', from: 'Sowjetunion', g: 'sowjet' },
  TKM: { y: 1991, d: '27. Oktober 1991', from: 'Sowjetunion', g: 'sowjet' },
  KGZ: { y: 1991, d: '31. August 1991', from: 'Sowjetunion', g: 'sowjet' },
  TJK: { y: 1991, d: '9. September 1991', from: 'Sowjetunion', g: 'sowjet' },
  RUS: { y: 1991, d: '25. Dezember 1991', from: 'Sowjetunion (als Nachfolgestaat)', g: 'sowjet' },
  SVN: { y: 1991, d: '25. Juni 1991', from: 'Jugoslawien', g: 'jugo' },
  HRV: { y: 1991, d: '25. Juni 1991', from: 'Jugoslawien', g: 'jugo' },
  MKD: { y: 1991, d: '8. September 1991', from: 'Jugoslawien', g: 'jugo' },
  BIH: { y: 1992, d: '3. März 1992', from: 'Jugoslawien', g: 'jugo' },
  CZE: { y: 1993, d: '1. Januar 1993', from: 'Tschechoslowakei', g: 'europa' },
  SVK: { y: 1993, d: '1. Januar 1993', from: 'Tschechoslowakei', g: 'europa' },
  ERI: { y: 1993, d: '24. Mai 1993', from: 'Äthiopien', g: 'afrika' },
  PLW: { y: 1994, d: '1. Oktober 1994', from: 'UN-Treuhandgebiet der USA', g: 'ozeanien' },
  TLS: { y: 2002, d: '20. Mai 2002', from: 'Indonesien (besetzt seit 1975)', g: 'asien' },
  MNE: { y: 2006, d: '3. Juni 2006', from: 'Serbien und Montenegro', g: 'jugo' },
  SRB: { y: 2006, d: '5. Juni 2006', from: 'Serbien und Montenegro (als Nachfolgestaat)', g: 'jugo' },
  KOS: { y: 2008, d: '17. Februar 2008', from: 'Serbien (nicht von allen Staaten anerkannt)', g: 'jugo' },
  SDS: { y: 2011, d: '9. Juli 2011', from: 'Sudan', g: 'afrika' },
}

/* ═══════════════════════ Punkte-Quizzes ═══════════════════════ */
// Koordinaten [Länge, Breite]

export const WELTWUNDER = [
  { id: 'cheops', name: 'Cheops-Pyramide', p: [31.1342, 29.9792], g: 'antik', where: 'Gizeh, Ägypten', note: 'Das einzige der sieben antiken Weltwunder, das heute noch steht – rund 4.500 Jahre alt.', aliases: ['Pyramiden von Gizeh', 'Große Pyramide'] },
  { id: 'babylon', name: 'Hängende Gärten der Semiramis', p: [44.4209, 32.5364], g: 'antik', where: 'Babylon, Irak', note: 'Ob es sie wirklich gab, ist bis heute umstritten – Spuren wurden nie gefunden.', aliases: ['Hängende Gärten von Babylon', 'Hängende Gärten'] },
  { id: 'zeus', name: 'Zeusstatue des Phidias', p: [21.6300, 37.6379], g: 'antik', where: 'Olympia, Griechenland', aliases: ['Zeusstatue', 'Zeus von Olympia'] },
  { id: 'artemis', name: 'Tempel der Artemis', p: [27.3639, 37.9497], g: 'antik', where: 'Ephesos, Türkei', note: '356 v. Chr. von Herostratos angezündet – er wollte damit berühmt werden.', aliases: ['Artemistempel', 'Artemision'] },
  { id: 'mausoleum', name: 'Mausoleum von Halikarnassos', p: [27.4241, 37.0379], g: 'antik', where: 'Bodrum, Türkei', note: 'Das Grab von König Mausolos – daher das Wort „Mausoleum“.', aliases: ['Mausoleum'] },
  { id: 'koloss', name: 'Koloss von Rhodos', p: [28.2278, 36.4510], g: 'antik', where: 'Rhodos, Griechenland', note: 'Stand nur gut 50 Jahre (um 280 bis 226 v. Chr.), dann stürzte er bei einem Erdbeben um.', aliases: ['Koloss'] },
  { id: 'pharos', name: 'Leuchtturm von Alexandria', p: [29.8853, 31.2140], g: 'antik', where: 'Alexandria, Ägypten', note: 'Auf der Insel Pharos – „Pharos“ heißt Leuchtturm bis heute in vielen Sprachen.', aliases: ['Pharos', 'Pharos von Alexandria'] },
  { id: 'mauer', name: 'Chinesische Mauer', p: [116.0170, 40.3580], g: 'neu', where: 'China (Punkt: Badaling bei Peking)', note: 'Mit allen Abschnitten über 20.000 km lang.', aliases: ['Große Mauer'] },
  { id: 'petra', name: 'Petra', p: [35.4444, 30.3285], g: 'neu', where: 'Jordanien', note: 'Felsenstadt der Nabatäer – bekannt aus „Indiana Jones und der letzte Kreuzzug“.' },
  { id: 'cristo', name: 'Cristo Redentor', p: [-43.2105, -22.9519], g: 'neu', where: 'Rio de Janeiro, Brasilien', note: '30 Meter hohe Christusstatue auf dem Corcovado, eingeweiht 1931.', aliases: ['Christusstatue', 'Christus der Erlöser'] },
  { id: 'machu', name: 'Machu Picchu', p: [-72.5450, -13.1631], g: 'neu', where: 'Peru', note: 'Inka-Stadt auf rund 2.400 m Höhe.' },
  { id: 'chichen', name: 'Chichén Itzá', p: [-88.5678, 20.6843], g: 'neu', where: 'Yucatán, Mexiko', note: 'Maya-Stadt mit der Stufenpyramide El Castillo.', aliases: ['Chichen Itza'] },
  { id: 'kolosseum', name: 'Kolosseum', p: [12.4922, 41.8902], g: 'neu', where: 'Rom, Italien', note: 'Größtes Amphitheater der Antike – für rund 50.000 Zuschauer.' },
  { id: 'taj', name: 'Taj Mahal', p: [78.0421, 27.1751], g: 'neu', where: 'Agra, Indien', note: 'Grabmal, das Großmogul Shah Jahan für seine Frau Mumtaz Mahal bauen ließ.', aliases: ['Tadsch Mahal'] },
]

export const EHEMALIGE_HAUPTSTAEDTE = [
  { name: 'Bonn', p: [7.0982, 50.7374], g: 'europa', of: 'Bundesrepublik Deutschland', when: '1949–1990', now: 'Berlin', note: 'Regierungssitz noch bis 1999.' },
  { name: 'Sankt Petersburg', p: [30.3351, 59.9343], g: 'europa', of: 'Russland', when: '1712–1918', now: 'Moskau', aliases: ['St. Petersburg', 'Petersburg', 'Petrograd'] },
  { name: 'Turin', p: [7.6869, 45.0703], g: 'europa', of: 'Italien', when: '1861–1865', now: 'Rom' },
  { name: 'Florenz', p: [11.2558, 43.7696], g: 'europa', of: 'Italien', when: '1865–1871', now: 'Rom' },
  { name: 'Krakau', p: [19.9450, 50.0647], g: 'europa', of: 'Polen', when: 'bis 1596', now: 'Warschau' },
  { name: 'Toledo', p: [-4.0273, 39.8628], g: 'europa', of: 'Spanien (Königshof)', when: 'bis 1561', now: 'Madrid' },
  { name: 'Coimbra', p: [-8.4196, 40.2033], g: 'europa', of: 'Portugal', when: '1131–1255', now: 'Lissabon' },
  { name: 'Turku', p: [22.2666, 60.4518], g: 'europa', of: 'Finnland', when: 'bis 1812', now: 'Helsinki', aliases: ['Åbo'] },
  { name: 'Roskilde', p: [12.0803, 55.6415], g: 'europa', of: 'Dänemark', when: 'bis 1443', now: 'Kopenhagen' },
  { name: 'Kaunas', p: [23.9036, 54.8985], g: 'europa', of: 'Litauen', when: '1920–1939', now: 'Vilnius', note: 'Nur „vorläufige“ Hauptstadt – Vilnius gehörte damals zu Polen.' },
  { name: 'Nafplio', p: [22.8028, 37.5673], g: 'europa', of: 'Griechenland', when: '1829–1834', now: 'Athen', aliases: ['Nauplia'] },
  { name: 'Cetinje', p: [18.9233, 42.3906], g: 'europa', of: 'Montenegro', when: 'bis 1918', now: 'Podgorica', note: 'Gilt bis heute als „Alte Königshauptstadt“.' },
  { name: 'Kragujevac', p: [20.9114, 44.0128], g: 'europa', of: 'Serbien', when: '1818–1841', now: 'Belgrad' },
  { name: 'Istanbul', p: [28.9784, 41.0082], g: 'asien', of: 'Osmanisches Reich', when: 'bis 1922', now: 'Ankara (Türkei)', aliases: ['Konstantinopel'] },
  { name: 'Kyoto', p: [135.7681, 35.0116], g: 'asien', of: 'Japan', when: '794–1869', now: 'Tokio' },
  { name: 'Nara', p: [135.8048, 34.6851], g: 'asien', of: 'Japan', when: '710–784', now: 'Tokio' },
  { name: 'Xi’an', p: [108.9398, 34.3416], g: 'asien', of: 'China (als Chang’an)', when: 'u. a. unter den Han und Tang', now: 'Peking', aliases: ['Xian', 'Changan', 'Chang’an'] },
  { name: 'Nanjing', p: [118.7969, 32.0603], g: 'asien', of: 'Republik China', when: '1927–1949', now: 'Peking', aliases: ['Nanking'] },
  { name: 'Kalkutta', p: [88.3639, 22.5726], g: 'asien', of: 'Britisch-Indien', when: 'bis 1911', now: 'Neu-Delhi', aliases: ['Kolkata'] },
  { name: 'Karatschi', p: [67.0011, 24.8607], g: 'asien', of: 'Pakistan', when: '1947–1959', now: 'Islamabad', aliases: ['Karachi'] },
  { name: 'Almaty', p: [76.8512, 43.2220], g: 'asien', of: 'Kasachstan', when: 'bis 1997', now: 'Astana', aliases: ['Alma-Ata'] },
  { name: 'Yangon', p: [96.1951, 16.8661], g: 'asien', of: 'Myanmar', when: 'bis 2005', now: 'Naypyidaw', aliases: ['Rangun'] },
  { name: 'Quezon City', p: [121.0437, 14.6760], g: 'asien', of: 'Philippinen', when: '1948–1976', now: 'Manila' },
  { name: 'Huế', p: [107.5909, 16.4637], g: 'asien', of: 'Vietnam (Nguyễn-Dynastie)', when: '1802–1945', now: 'Hanoi', aliases: ['Hue'] },
  { name: 'Mandalay', p: [96.0891, 21.9588], g: 'asien', of: 'Königreich Birma', when: '1857–1885', now: 'Naypyidaw' },
  { name: 'Ayutthaya', p: [100.5877, 14.3532], g: 'asien', of: 'Siam', when: '1351–1767', now: 'Bangkok' },
  { name: 'Isfahan', p: [51.6680, 32.6546], g: 'asien', of: 'Persien', when: '1598–1722', now: 'Teheran' },
  { name: 'Lagos', p: [3.3792, 6.5244], g: 'afrika', of: 'Nigeria', when: 'bis 1991', now: 'Abuja' },
  { name: 'Abidjan', p: [-4.0083, 5.3600], g: 'afrika', of: 'Elfenbeinküste', when: 'bis 1983', now: 'Yamoussoukro' },
  { name: 'Zomba', p: [35.3188, -15.3850], g: 'afrika', of: 'Malawi', when: 'bis 1975', now: 'Lilongwe' },
  { name: 'Fès', p: [-4.9998, 34.0181], g: 'afrika', of: 'Marokko', when: 'bis 1912', now: 'Rabat', aliases: ['Fez'] },
  { name: 'Rio de Janeiro', p: [-43.1729, -22.9068], g: 'amerika', of: 'Brasilien', when: '1763–1960', now: 'Brasília' },
  { name: 'Salvador', p: [-38.5016, -12.9777], g: 'amerika', of: 'Brasilien (Kolonie)', when: '1549–1763', now: 'Brasília', aliases: ['Salvador da Bahia'] },
  { name: 'Philadelphia', p: [-75.1652, 39.9526], g: 'amerika', of: 'USA', when: '1790–1800', now: 'Washington' },
  { name: 'New York', p: [-74.0060, 40.7128], g: 'amerika', of: 'USA', when: '1789–1790', now: 'Washington' },
  { name: 'Belize City', p: [-88.1976, 17.5046], g: 'amerika', of: 'Belize', when: 'bis 1970', now: 'Belmopan', note: 'Nach dem Hurrikan Hattie (1961) wurde eine neue Hauptstadt im Landesinneren gebaut.' },
  { name: 'Cusco', p: [-71.9675, -13.5320], g: 'amerika', of: 'Inkareich', when: 'bis 1533', now: 'Lima (Peru)', aliases: ['Cuzco'] },
  { name: 'Kingston (Ontario)', p: [-76.4860, 44.2312], g: 'amerika', of: 'Provinz Kanada', when: '1841–1844', now: 'Ottawa', aliases: ['Kingston'] },
  { name: 'Melbourne', p: [144.9631, -37.8136], g: 'ozeanien', of: 'Australien', when: '1901–1927', now: 'Canberra' },
  { name: 'Auckland', p: [174.7633, -36.8485], g: 'ozeanien', of: 'Neuseeland', when: '1841–1865', now: 'Wellington' },
]

export const ALTE_NAMEN = [
  // Antike
  { old: 'Londinium', now: 'London', p: [-0.0918, 51.5130], g: 'antike' },
  { old: 'Lutetia', now: 'Paris', p: [2.3470, 48.8530], g: 'antike' },
  { old: 'Vindobona', now: 'Wien', p: [16.3738, 48.2082], g: 'antike' },
  { old: 'Colonia Agrippina', now: 'Köln', p: [6.9603, 50.9375], g: 'antike', aliases: ['Colonia', 'Colonia Claudia Ara Agrippinensium', 'CCAA'] },
  { old: 'Mogontiacum', now: 'Mainz', p: [8.2711, 49.9929], g: 'antike' },
  { old: 'Augusta Treverorum', now: 'Trier', p: [6.6371, 49.7499], g: 'antike' },
  { old: 'Castra Regina', now: 'Regensburg', p: [12.1016, 49.0134], g: 'antike' },
  { old: 'Augusta Vindelicorum', now: 'Augsburg', p: [10.8978, 48.3705], g: 'antike' },
  { old: 'Aquincum', now: 'Budapest', p: [19.0402, 47.4979], g: 'antike' },
  { old: 'Eboracum', now: 'York', p: [-1.0815, 53.9600], g: 'antike' },
  { old: 'Massalia', now: 'Marseille', p: [5.3698, 43.2965], g: 'antike', aliases: ['Massilia'] },
  { old: 'Olisipo', now: 'Lissabon', p: [-9.1393, 38.7223], g: 'antike' },
  { old: 'Hispalis', now: 'Sevilla', p: [-5.9845, 37.3891], g: 'antike' },
  { old: 'Tingis', now: 'Tanger', p: [-5.8340, 35.7595], g: 'antike' },
  // Europa
  { old: 'Konstantinopel', now: 'Istanbul', p: [28.9784, 41.0082], g: 'europa', since: '1930 offiziell', aliases: ['Byzanz', 'Konstantinopol'] },
  { old: 'Königsberg', now: 'Kaliningrad', p: [20.5103, 54.7104], g: 'europa', since: '1946' },
  { old: 'Breslau', now: 'Wrocław', p: [17.0385, 51.1079], g: 'europa', since: '1945', aliases: ['Wroclaw'] },
  { old: 'Danzig', now: 'Gdańsk', p: [18.6466, 54.3520], g: 'europa', since: '1945', aliases: ['Gdansk'] },
  { old: 'Stettin', now: 'Szczecin', p: [14.5528, 53.4285], g: 'europa', since: '1945' },
  { old: 'Posen', now: 'Poznań', p: [16.9252, 52.4064], g: 'europa', aliases: ['Poznan'] },
  { old: 'Pressburg', now: 'Bratislava', p: [17.1077, 48.1486], g: 'europa', since: '1919' },
  { old: 'Lemberg', now: 'Lwiw', p: [24.0297, 49.8397], g: 'europa', aliases: ['Lviv', 'Lwów'] },
  { old: 'Memel', now: 'Klaipėda', p: [21.1443, 55.7033], g: 'europa', aliases: ['Klaipeda'] },
  { old: 'Tilsit', now: 'Sowjetsk', p: [21.8869, 55.0817], g: 'europa', since: '1946' },
  { old: 'Reval', now: 'Tallinn', p: [24.7536, 59.4370], g: 'europa' },
  { old: 'Dorpat', now: 'Tartu', p: [26.7290, 58.3780], g: 'europa' },
  { old: 'Agram', now: 'Zagreb', p: [15.9819, 45.8150], g: 'europa' },
  { old: 'Laibach', now: 'Ljubljana', p: [14.5058, 46.0569], g: 'europa' },
  { old: 'Christiania', now: 'Oslo', p: [10.7522, 59.9139], g: 'europa', since: '1925', aliases: ['Kristiania'] },
  { old: 'Smyrna', now: 'İzmir', p: [27.1428, 38.4237], g: 'europa', aliases: ['Izmir'] },
  { old: 'Angora', now: 'Ankara', p: [32.8597, 39.9334], g: 'europa' },
  { old: 'Karl-Marx-Stadt', now: 'Chemnitz', p: [12.9214, 50.8278], g: 'sowjet', since: '1990 (hieß 1953–1990 so)' },
  // Sowjetunion
  { old: 'Leningrad', now: 'Sankt Petersburg', p: [30.3351, 59.9343], g: 'sowjet', since: '1991 (hieß 1924–1991 so)', aliases: ['St. Petersburg', 'Petersburg'] },
  { old: 'Stalingrad', now: 'Wolgograd', p: [44.5133, 48.7080], g: 'sowjet', since: '1961 (hieß 1925–1961 so)' },
  { old: 'Swerdlowsk', now: 'Jekaterinburg', p: [60.6122, 56.8389], g: 'sowjet', since: '1991' },
  { old: 'Gorki', now: 'Nischni Nowgorod', p: [44.0059, 56.2965], g: 'sowjet', since: '1990' },
  { old: 'Kuibyschew', now: 'Samara', p: [50.1006, 53.1959], g: 'sowjet', since: '1991' },
  { old: 'Stalino', now: 'Donezk', p: [37.8028, 48.0159], g: 'sowjet', since: '1961' },
  { old: 'Dnipropetrowsk', now: 'Dnipro', p: [35.0462, 48.4647], g: 'sowjet', since: '2016' },
  { old: 'Frunse', now: 'Bischkek', p: [74.5698, 42.8746], g: 'sowjet', since: '1991' },
  { old: 'Alma-Ata', now: 'Almaty', p: [76.8512, 43.2220], g: 'sowjet', since: '1993' },
  { old: 'Zelinograd', now: 'Astana', p: [71.4704, 51.1605], g: 'sowjet', since: '1992 (danach Akmola, Astana, Nur-Sultan, wieder Astana)', aliases: ['Akmolinsk', 'Akmola'] },
  { old: 'Tiflis', now: 'Tbilissi', p: [44.7930, 41.7151], g: 'sowjet', aliases: ['Tbilisi'] },
  // Asien
  { old: 'Bombay', now: 'Mumbai', p: [72.8777, 19.0760], g: 'asien', since: '1995' },
  { old: 'Madras', now: 'Chennai', p: [80.2707, 13.0827], g: 'asien', since: '1996' },
  { old: 'Kalkutta', now: 'Kolkata', p: [88.3639, 22.5726], g: 'asien', since: '2001', aliases: ['Calcutta'] },
  { old: 'Saigon', now: 'Ho-Chi-Minh-Stadt', p: [106.6297, 10.8231], g: 'asien', since: '1976', aliases: ['Ho Chi Minh City'] },
  { old: 'Batavia', now: 'Jakarta', p: [106.8456, -6.2088], g: 'asien', since: '1942' },
  { old: 'Edo', now: 'Tokio', p: [139.6917, 35.6895], g: 'asien', since: '1868', aliases: ['Yedo'] },
  { old: 'Kanton', now: 'Guangzhou', p: [113.2644, 23.1291], g: 'asien' },
  { old: 'Tsingtau', now: 'Qingdao', p: [120.3826, 36.0671], g: 'asien' },
  { old: 'Port Arthur', now: 'Lüshunkou (Dalian)', p: [121.2510, 38.8124], g: 'asien', aliases: ['Lüshun'] },
  // Afrika & Amerika
  { old: 'Léopoldville', now: 'Kinshasa', p: [15.2663, -4.4419], g: 'kolonial', since: '1966', aliases: ['Leopoldville'] },
  { old: 'Élisabethville', now: 'Lubumbashi', p: [27.4794, -11.6876], g: 'kolonial', since: '1966', aliases: ['Elisabethville'] },
  { old: 'Stanleyville', now: 'Kisangani', p: [25.1911, 0.5153], g: 'kolonial', since: '1966' },
  { old: 'Salisbury', now: 'Harare', p: [31.0335, -17.8292], g: 'kolonial', since: '1982' },
  { old: 'Lourenço Marques', now: 'Maputo', p: [32.5732, -25.9692], g: 'kolonial', since: '1976', aliases: ['Lourenco Marques'] },
  { old: 'Fort-Lamy', now: 'N’Djamena', p: [15.0444, 12.1348], g: 'kolonial', since: '1973', aliases: ['Fort Lamy'] },
  { old: 'Bathurst', now: 'Banjul', p: [-16.5780, 13.4549], g: 'kolonial', since: '1973' },
  { old: 'Santa Isabel', now: 'Malabo', p: [8.7832, 3.7504], g: 'kolonial', since: '1973' },
  { old: 'Neu-Amsterdam', now: 'New York', p: [-74.0060, 40.7128], g: 'kolonial', since: '1664', aliases: ['Nieuw Amsterdam', 'New Amsterdam'] },
]

export const HANSE = [
  { name: 'London', note: 'Kontor „Stalhof“ (Steelyard)', p: [-0.0918, 51.5098], g: 'kontor' },
  { name: 'Brügge', note: 'Kontor', p: [3.2247, 51.2093], g: 'kontor' },
  { name: 'Bergen', note: 'Kontor „Deutsche Brücke“ (Bryggen)', p: [5.3242, 60.3975], g: 'kontor' },
  { name: 'Nowgorod', note: 'Kontor „Peterhof“', p: [31.2742, 58.5213], g: 'kontor', aliases: ['Weliki Nowgorod'] },
  { name: 'Lübeck', note: '„Königin der Hanse“ – Ort der Hansetage', p: [10.6866, 53.8655], g: 'wendisch' },
  { name: 'Hamburg', p: [9.9937, 53.5511], g: 'wendisch' },
  { name: 'Lüneburg', note: 'Reich durch Salz', p: [10.4115, 53.2464], g: 'wendisch' },
  { name: 'Wismar', p: [11.4651, 53.8925], g: 'wendisch' },
  { name: 'Rostock', p: [12.0991, 54.0924], g: 'wendisch' },
  { name: 'Stralsund', note: 'Frieden von Stralsund 1370 – Höhepunkt der Hanse-Macht', p: [13.0812, 54.3091], g: 'wendisch' },
  { name: 'Greifswald', p: [13.3815, 54.0865], g: 'wendisch' },
  { name: 'Stettin', p: [14.5528, 53.4285], g: 'preussen', aliases: ['Szczecin'] },
  { name: 'Kolberg', p: [15.5767, 54.1757], g: 'preussen', aliases: ['Kołobrzeg'] },
  { name: 'Danzig', p: [18.6466, 54.3520], g: 'preussen', aliases: ['Gdańsk'] },
  { name: 'Elbing', p: [19.4044, 54.1522], g: 'preussen', aliases: ['Elbląg'] },
  { name: 'Thorn', p: [18.5984, 53.0138], g: 'preussen', aliases: ['Toruń'] },
  { name: 'Königsberg', p: [20.5103, 54.7104], g: 'preussen', aliases: ['Kaliningrad'] },
  { name: 'Krakau', p: [19.9450, 50.0647], g: 'preussen', aliases: ['Kraków'] },
  { name: 'Breslau', p: [17.0385, 51.1079], g: 'preussen', aliases: ['Wrocław'] },
  { name: 'Riga', p: [24.1052, 56.9496], g: 'livland' },
  { name: 'Reval', p: [24.7536, 59.4370], g: 'livland', aliases: ['Tallinn'] },
  { name: 'Dorpat', p: [26.7290, 58.3780], g: 'livland', aliases: ['Tartu'] },
  { name: 'Visby', note: 'Auf Gotland – frühes Zentrum des Ostseehandels', p: [18.2948, 57.6348], g: 'livland' },
  { name: 'Bremen', p: [8.8017, 53.0793], g: 'westfalen' },
  { name: 'Köln', note: 'Größte Stadt der Hanse', p: [6.9603, 50.9375], g: 'westfalen' },
  { name: 'Dortmund', p: [7.4653, 51.5136], g: 'westfalen' },
  { name: 'Soest', p: [8.1061, 51.5710], g: 'westfalen' },
  { name: 'Münster', p: [7.6261, 51.9607], g: 'westfalen' },
  { name: 'Duisburg', p: [6.7623, 51.4344], g: 'westfalen' },
  { name: 'Braunschweig', p: [10.5268, 52.2689], g: 'sachsen' },
  { name: 'Magdeburg', p: [11.6276, 52.1205], g: 'sachsen' },
  { name: 'Goslar', p: [10.4286, 51.9060], g: 'sachsen' },
  { name: 'Hildesheim', p: [9.9580, 52.1548], g: 'sachsen' },
  { name: 'Halle', p: [11.9688, 51.4969], g: 'sachsen' },
  { name: 'Berlin-Cölln', p: [13.4050, 52.5200], g: 'sachsen', aliases: ['Berlin'] },
  { name: 'Frankfurt (Oder)', p: [14.5506, 52.3471], g: 'sachsen', aliases: ['Frankfurt an der Oder'] },
  { name: 'Deventer', p: [6.1552, 52.2551], g: 'niederlande' },
  { name: 'Kampen', p: [5.9112, 52.5551], g: 'niederlande' },
  { name: 'Zwolle', p: [6.0830, 52.5168], g: 'niederlande' },
  { name: 'Groningen', p: [6.5665, 53.2194], g: 'niederlande' },
]

/* ═══════════════════════ Deutscher Bund um 1860 (für die Flaggen) ═══════════════════════ */
// Stichjahr 1860: die thüringischen Herzogtümer nach der Neuordnung von 1826, Hohenzollern seit 1850 preußisch,
// Luxemburg ohne den 1839 an Belgien gefallenen Westen.

export function kreis1860(land, rb, k) {
  if (land === 'Thüringen') return THUERINGEN_1871[k] ?? null
  if (land === 'Bayern' && (k === 'Coburg' || k === 'Coburg*')) return 'sachsen-coburg-gotha'
  if (land === 'Saarland' && k === 'Sankt Wendel') return 'preussen'
  if (land === 'Baden-Württemberg' && (k === 'Sigmaringen' || k === 'Zollernalbkreis')) return 'preussen'
  if (land === 'Sachsen-Anhalt' && ['Dessau*', 'Anhalt-Zerbst', 'Köthen'].includes(k)) return 'anhalt-dessau-koethen'
  return kreis1815(land, rb, k)
}

/** Namen der Staaten um 1860, die es 1815 so noch nicht gab */
export const STAATEN_1860_EXTRA = {
  'sachsen-altenburg': 'Sachsen-Altenburg', 'sachsen-coburg-gotha': 'Sachsen-Coburg und Gotha', 'anhalt-dessau-koethen': 'Anhalt-Dessau-Köthen',
}

/**
 * Flaggen im Deutschen Bund (Stichjahr um 1860). Staaten mit gleicher Flagge sind EIN Eintrag.
 * s: Streifen von oben nach unten · draw: besondere Zeichnung · sicher: sicher / wahrscheinlich / unsicher
 * Quellen: flaggenlexikon.de, crwflags.com (Flags of the World), Wikipedia – geprüft im Oktober 2026.
 * Weggelassen: Holstein und Lauenburg (unter dem dänischen König ohne eigene Flagge), Limburg (unbekannt),
 * Hohenzollern (seit 1850 preußisch).
 */
export const FLAGGEN_1860 = [
  { id: 'oesterreich', states: ['oesterreich'], s: ['#000000', '#ffcc00'], farben: 'Schwarz-Gelb', sicher: 'sicher', note: 'Die Farben des Hauses Habsburg – bis 1918.' },
  { id: 'preussen', states: ['preussen'], s: ['#000000', '#ffffff'], farben: 'Schwarz-Weiß', sicher: 'sicher' },
  { id: 'bayern', states: ['bayern'], draw: 'rauten', farben: 'Weiß-blaue Rauten', sicher: 'wahrscheinlich', note: 'Die weiß-blauen Landesfarben wurden erst 1878 amtlich festgelegt.' },
  { id: 'weiss-gruen', states: ['sachsen', 'sachsen-altenburg', 'sachsen-meiningen'], s: ['#ffffff', '#009b3a'], farben: 'Weiß-Grün', sicher: 'wahrscheinlich', note: 'Gleiche Flagge in drei wettinischen Staaten: Sachsen (seit 1815), Sachsen-Altenburg (seit 1832) und Sachsen-Meiningen (amtlich seit 1818, im Alltag oft Grün-Weiß).' },
  { id: 'gruen-weiss', states: ['sachsen-coburg-gotha', 'anhalt-dessau-koethen', 'anhalt-bernburg'], s: ['#009b3a', '#ffffff'], farben: 'Grün-Weiß', sicher: 'unsicher', note: 'Sachsen-Coburg und Gotha (seit 1832) – und auch die anhaltischen Herzogtümer nutzten meist Grün-Weiß. Für Anhalt sind Reihenfolge und Form nicht sicher belegt.' },
  { id: 'hannover', states: ['hannover'], s: ['#ffd700', '#ffffff'], farben: 'Gelb-Weiß', sicher: 'sicher', note: 'Seit 1837 – vorher (in Personalunion mit Großbritannien) wurde oft die britische Flagge benutzt.' },
  { id: 'wuerttemberg', states: ['wuerttemberg'], s: ['#000000', '#b22222'], farben: 'Schwarz-Rot', sicher: 'wahrscheinlich', note: 'Bis etwa 1817 Schwarz-Gelb.' },
  { id: 'kurhessen', states: ['kurhessen'], s: ['#e30613', '#ffffff'], farben: 'Rot-Weiß', sicher: 'sicher' },
  { id: 'hessen-darmstadt', states: ['hessen-darmstadt'], s: ['#e30613', '#ffffff', '#ffffff', '#e30613'], farben: 'Rot-Weiß-Rot (mit Wappen)', sicher: 'sicher', note: 'Seit 1839, eigentlich mit dem hessischen Löwen in der Mitte (hier vereinfacht).' },
  { id: 'rot-gelb', states: ['baden', 'lippe'], s: ['#e30613', '#ffd700'], farben: 'Rot-Gelb', sicher: 'wahrscheinlich', note: 'Baden (seit 1855) und Lippe (etwa 1856–1880) hatten die gleiche Flagge.' },
  { id: 'luxemburg', states: ['luxemburg'], s: ['#ed2939', '#ffffff', '#00a1de'], farben: 'Rot-Weiß-Hellblau', sicher: 'sicher', note: 'Seit 1845 – fast so wie heute.' },
  { id: 'mecklenburg', states: ['mecklenburg-schwerin', 'mecklenburg-strelitz'], s: ['#0047ab', '#ffd700', '#e30613'], farben: 'Blau-Gelb-Rot', sicher: 'wahrscheinlich', note: 'Beide Mecklenburg hatten dieselbe Flagge (ab 1863/64 auch amtlich).' },
  { id: 'sachsen-weimar', states: ['sachsen-weimar'], s: ['#000000', '#009b3a', '#ffd700'], farben: 'Schwarz-Grün-Gelb', sicher: 'sicher', note: 'Erst 1897 umgestellt auf Schwarz-Gelb-Grün.' },
  { id: 'oldenburg', states: ['oldenburg'], draw: 'kreuz', farben: 'Blau mit rotem Kreuz', sicher: 'sicher' },
  { id: 'nassau', states: ['nassau'], s: ['#ff8c00', '#1e3a8a', '#ff8c00'], farben: 'Orange-Blau-Orange', sicher: 'wahrscheinlich', note: 'Orange wie das Haus Oranien-Nassau.' },
  { id: 'braunschweig', states: ['braunschweig'], s: ['#0047ab', '#ffd700'], farben: 'Blau-Gelb', sicher: 'sicher', note: 'Seit 1830, vorher Blau-Weiß.' },
  { id: 'liechtenstein', states: ['liechtenstein'], s: ['#002b7f', '#ce1126'], farben: 'Blau-Rot', sicher: 'wahrscheinlich', note: 'Seit 1852 – vorher Gold-Rot. Die Krone kam erst 1937 dazu.' },
  { id: 'schwarz-rot-gold', states: ['reuss-aelt', 'reuss-juengere', 'waldeck'], s: ['#000000', '#dd0000', '#ffce00'], farben: 'Schwarz-Rot-Gold', sicher: 'wahrscheinlich', note: 'Die Farben der deutschen Einheitsbewegung – und zugleich die Landesfarben von Reuß (beide Linien) und Waldeck (seit 1848/49).' },
  { id: 'schaumburg-lippe', states: ['schaumburg-lippe'], s: ['#ffd700', '#e30613'], farben: 'Gelb-Rot', sicher: 'wahrscheinlich', note: 'Ab etwa 1880 Weiß-Rot-Blau.' },
  { id: 'schwarzburg-rudolstadt', states: ['schwarzburg-rudolstadt'], s: ['#ffffff', '#1e90ff'], farben: 'Weiß-Blau', sicher: 'sicher', note: 'Genau umgekehrt wie Schwarzburg-Sondershausen!' },
  { id: 'schwarzburg-sondershausen', states: ['schwarzburg-sondershausen'], s: ['#1e90ff', '#ffffff'], farben: 'Blau-Weiß', sicher: 'sicher', note: 'Genau umgekehrt wie Schwarzburg-Rudolstadt!' },
  { id: 'weiss-rot', states: ['luebeck', 'hessen-homburg'], s: ['#ffffff', '#e30613'], farben: 'Weiß-Rot', sicher: 'wahrscheinlich', note: 'Lübeck und die Landgrafschaft Hessen-Homburg hatten die gleichen Farben.' },
  { id: 'bremen', states: ['bremen'], draw: 'speck', farben: 'Rot-weiße Streifen, geschachter Rand', sicher: 'sicher', note: 'Die „Speckflagge“ – bis heute die Flagge Bremens.' },
  { id: 'frankfurt', states: ['frankfurt'], draw: 'frankfurt', farben: 'Rot-Weiß gestreift mit Adler-Wappen', sicher: 'sicher', note: 'Seit den 1830er-Jahren. Das Wappen im Obereck ist hier vereinfacht.' },
  { id: 'hamburg', states: ['hamburg'], draw: 'burg', farben: 'Rot mit weißer Burg', sicher: 'sicher', note: 'Bis heute die Flagge Hamburgs.' },
]

/* ═══════════════════════ Antike Welt 117 n. Chr. ═══════════════════════ */
// Römisches Reich: größte Ausdehnung unter Trajan (AWMC), Nachbarn aus historical-basemaps (Jahr 100) – grob!

export const HB_100 = {
  'Parthian Empire': 'parther', 'Kushan Empire': 'kuschana', Han: 'han', Axum: 'aksum', Meroe: 'meroe',
  'Himyarite Kingdom': 'himjar', Hadramaut: 'hadramaut', Alans: 'alanen', Scythians: 'skythen', 'Bosporian Kingdom': 'bosporus',
  Satavahanihara: 'satavahana', 'Saka Kingdom': 'saka', 'Southern Xiongnu': 'xiongnu', Blemmyes: 'blemmyer', 'Roman Empire': 'rom',
}
/** Namenlose Flächen um 100 n. Chr.: nur diese bekommen einen Namen, der Rest bleibt „unbekannt“ */
export const HB_100_FLAECHEN = [
  { box: [5, 49, 19, 56.5], id: 'germanen' },
  { box: [-7.5, 55.5, -1.5, 59], id: 'kaledonier' },
  { box: [-10.5, 51.3, -5.5, 55.5], id: 'hibernia' },
]
export const ANTIKE = {
  rom: { name: 'Römisches Reich', cap: 'Rom', form: 'Kaiserreich · Trajan (98–117)', g: 'rom', note: 'Unter Trajan erreichte das Reich 117 n. Chr. seine größte Ausdehnung – vom Hadrianswall bis nach Mesopotamien.', aliases: ['Rom', 'Imperium Romanum', 'Römisches Imperium'] },
  bosporus: { name: 'Bosporanisches Reich', cap: 'Pantikapaion (heute Kertsch)', form: 'Königreich unter römischem Schutz', g: 'rom', aliases: ['Bosporus'] },
  parther: { name: 'Partherreich', cap: 'Ktesiphon', form: 'Großreich der Arsakiden', g: 'asien', note: 'Der große Rivale Roms im Osten.', aliases: ['Parther', 'Parthien'] },
  kuschana: { name: 'Kuschana-Reich', cap: 'Purushapura (heute Peschawar) u. a.', form: 'Großreich zwischen Zentralasien und Indien', g: 'asien', aliases: ['Kuschan', 'Kushana'] },
  han: { name: 'Han-China', cap: 'Luoyang', form: 'Kaiserreich der Östlichen Han-Dynastie', g: 'asien', note: 'Über die Seidenstraße wussten Rom und China voneinander.', aliases: ['Han', 'Han-Dynastie', 'China'] },
  xiongnu: { name: 'Südliche Xiongnu', cap: '–', form: 'Reitervolk, mit den Han verbündet', g: 'asien', aliases: ['Xiongnu', 'Hunnen'] },
  satavahana: { name: 'Satavahana-Reich', cap: 'Pratishthana (heute Paithan)', form: 'Königreich in Südindien', g: 'asien', aliases: ['Satavahana'] },
  saka: { name: 'Westliche Satrapen', cap: '–', form: 'Reich der Saka (Skythen) in Westindien', g: 'asien', aliases: ['Saka'] },
  aksum: { name: 'Aksum', cap: 'Aksum', form: 'Königreich (heute Äthiopien/Eritrea)', g: 'afrika', note: 'Wurde später eine der ersten christlichen Großmächte.', aliases: ['Axum', 'Aksumitisches Reich'] },
  meroe: { name: 'Meroe', cap: 'Meroe', form: 'Königreich Kusch (heute Sudan)', g: 'afrika', note: 'Hier stehen mehr Pyramiden als in Ägypten.', aliases: ['Kusch', 'Reich von Kusch'] },
  blemmyer: { name: 'Blemmyer', cap: '–', form: 'Nomadenvolk in der Ostwüste', g: 'afrika' },
  himjar: { name: 'Himjar', cap: 'Zafar', form: 'Königreich im Süden Arabiens', g: 'afrika', aliases: ['Himyar', 'Himjariten'] },
  hadramaut: { name: 'Hadramaut', cap: 'Schabwa', form: 'Königreich im Süden Arabiens – reich durch Weihrauch', g: 'afrika' },
  alanen: { name: 'Alanen', cap: '–', form: 'Reitervolk nördlich des Kaukasus', g: 'europa' },
  skythen: { name: 'Skythen', cap: 'Neapolis (auf der Krim)', form: 'Reste des einst großen Reitervolks', g: 'europa' },
  germanen: { name: 'Germanien', cap: '–', form: 'viele Stämme, kein gemeinsamer Staat', g: 'europa', note: 'Die Römer nannten das Land östlich des Rheins „Germania magna“.', aliases: ['Germanen', 'Germania', 'Germania magna'] },
  kaledonier: { name: 'Kaledonien', cap: '–', form: 'Stämme der Kaledonier (später Pikten)', g: 'europa', note: 'Gegen sie baute Hadrian ab 122 den Hadrianswall.', aliases: ['Kaledonier', 'Caledonia', 'Schottland'] },
  hibernia: { name: 'Hibernia', cap: '–', form: 'irische Stämme – nie von Rom erobert', g: 'europa', aliases: ['Irland'] },
}

/* ═══════════════════════ Zeitmaschine: Europa in verschiedenen Jahren ═══════════════════════ */

export const ZEITEN = [
  { year: 1715, hint: 'Schweden besitzt noch Finnland und Teile Pommerns (das Baltikum hat Russland gerade erobert). Polen-Litauen ist riesig.' },
  { year: 1783, hint: 'Polen-Litauen hat bei der ersten Teilung (1772) schon Land verloren. Russland hat gerade die Krim übernommen.' },
  { year: 1815, hint: 'Wiener Kongress: Polen ist aufgeteilt, Norwegen gehört zu Schweden, Italien und Deutschland sind zersplittert.' },
  { year: 1880, hint: 'Deutschland und Italien sind geeint. Serbien, Rumänien und Montenegro sind seit 1878 unabhängig.' },
  { year: 1914, hint: 'Kurz vor dem Ersten Weltkrieg: Österreich-Ungarn, das Deutsche Kaiserreich und das Russische Reich grenzen aneinander.' },
  { year: 1920, hint: 'Nach dem Ersten Weltkrieg: Polen, die Tschechoslowakei und Jugoslawien sind neu entstanden.' },
  { year: 1938, hint: 'Zwischen den Weltkriegen: Polen und das Baltikum sind unabhängig, im Osten liegt die Sowjetunion.' },
  { year: 1945, hint: 'Kriegsende: Deutschland ist in Besatzungszonen aufgeteilt.' },
  { year: 1960, hint: 'Kalter Krieg: zwei deutsche Staaten, die Sowjetunion reicht bis an die Ostsee.' },
  { year: 1994, hint: 'Nach dem Kalten Krieg: Deutschland ist wiedervereinigt, Sowjetunion und Jugoslawien sind zerfallen.' },
]
