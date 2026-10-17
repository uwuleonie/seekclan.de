import type { Metadata } from 'next'
import Link from 'next/link'
import { HL_KATEGORIEN } from '../_data/hl'

// /geo/quellen: woher alle Daten, Karten, Bilder und Texte im Atlas kommen – mit Lizenz.
// Neue Quelle dazu? Hier eintragen (und im jeweiligen Build-Skript unter scripts/geo/ im Kopf).

export const metadata: Metadata = {
  title: 'Quellen',
  description: 'Woher die Karten, Zahlen, Bilder und Texte im Geo-Atlas von seekclan.de kommen – mit Lizenzen.',
}

type Q = { name: string; url: string; lizenz: string; wofuer: string }

const ABSCHNITTE: { titel: string; text?: string; quellen: Q[] }[] = [
  {
    titel: 'Karten',
    quellen: [
      { name: 'Natural Earth', url: 'https://www.naturalearthdata.com', lizenz: 'gemeinfrei', wofuer: 'Länder (in deutscher Sicht), Provinzen, Meere, Flüsse, Seen, Gebirge, Wüsten, Inseln, Orte, Relief, Lagekarten der Länderseiten' },
      { name: 'geoBoundaries (gbOpen)', url: 'https://www.geoboundaries.org', lizenz: 'CC BY 4.0', wofuer: 'Provinzen und Bezirke in Afrika' },
      { name: 'OpenStreetMap', url: 'https://www.openstreetmap.org/copyright', lizenz: 'ODbL, © OpenStreetMap-Mitwirkende', wofuer: 'Autobahnen, Bahnstrecken, Stadtbezirke, Postleitzahlen (über yetzt/postleitzahlen)' },
      { name: 'deutschlandGeoJSON (isellsoap, aus GADM)', url: 'https://github.com/isellsoap/deutschlandGeoJSON', lizenz: 'gemeinfrei', wofuer: 'Landkreise und Bundesländer' },
      { name: 'Amt für Statistik Berlin-Brandenburg (LOR)', url: 'https://daten.berlin.de', lizenz: 'CC BY 3.0 DE', wofuer: 'Berliner Bezirksregionen (Sektoren 1945)' },
      { name: 'Stadtteil-Grenzen: click_that_hood, Berlin-Geodaten, KoelnAPI, bcn-geodata', url: 'https://github.com/codeforgermany/click_that_hood', lizenz: 'je nach Stadt offen (siehe Repositorien)', wofuer: 'Stadtteile und Bezirke' },
      { name: 'IBGE über tbrugz/geodata-br, kelvins/municipios-brasileiros', url: 'https://github.com/tbrugz/geodata-br', lizenz: 'offen (siehe Repositorien)', wofuer: 'Gemeinden und Vorwahlen in Brasilien' },
      { name: 'Sentinel-2 cloudless (EOX IT Services)', url: 'https://s2maps.eu', lizenz: 'CC BY 4.0 (enthält veränderte Copernicus-Sentinel-Daten 2016)', wofuer: 'Kartenansicht „Satellit“' },
      { name: 'NASA Earth Observatory – Black Marble / NASA GIBS', url: 'https://earthobservatory.nasa.gov/features/NightLights', lizenz: 'gemeinfrei (NASA)', wofuer: 'Kartenansicht „Nacht“' },
      { name: 'Terrain Tiles (AWS Open Data)', url: 'https://github.com/tilezen/joerd/blob/master/docs/attribution.md', lizenz: 'siehe Liste der Quellen', wofuer: 'Höhendaten für das Relief beim Hineinzoomen' },
    ],
  },
  {
    titel: 'Länder, Orte und Codes',
    quellen: [
      { name: 'CIA World Factbook (über factbook/factbook.json)', url: 'https://github.com/factbook/factbook.json', lizenz: 'gemeinfrei', wofuer: 'Länderseiten: Wirtschaft nach Sektoren und Verwendung, Exporte, Importe, Handelspartner, Landwirtschaft, Bodenschätze, Staatsform, Sprachen, Grenzen und Nachbarländer, Zeitzone; Fläche; viele Zahlen in Higher Lower. Ins Deutsche übersetzt von uns.' },
      { name: 'datasets/country-codes', url: 'https://github.com/datasets/country-codes', lizenz: 'ODC-PDDL', wofuer: 'ISO-Codes, Vorwahlen, Länderdomains, Währungen' },
      { name: 'mledoze/countries', url: 'https://github.com/mledoze/countries', lizenz: 'ODbL', wofuer: 'Binnenstaaten, Nachbarländer, Amtssprachen' },
      { name: 'GeoNames', url: 'https://www.geonames.org', lizenz: 'CC BY 4.0', wofuer: 'Lage und Einwohner der Städte' },
      { name: 'Wikidata', url: 'https://www.wikidata.org', lizenz: 'CC0', wofuer: 'Deutsche Namen, Provinz-Codes, Hauptorte, Ortsnamen in Landessprache, Regionsflaggen' },
      { name: 'Wikipedia', url: 'https://de.wikipedia.org', lizenz: 'CC BY-SA 4.0', wofuer: 'Städtelisten (z. B. „List of cities in Africa by population“), Tabellen für Higher Lower' },
      { name: 'OurAirports', url: 'https://ourairports.com/data/', lizenz: 'gemeinfrei', wofuer: 'Flughäfen' },
      { name: 'Deutsche Bahn (db-stations)', url: 'https://data.deutschebahn.com', lizenz: 'CC BY 4.0', wofuer: 'Bahnhöfe' },
      { name: 'Unicode CLDR (über den Browser/Node)', url: 'https://cldr.unicode.org', lizenz: 'Unicode License', wofuer: 'Deutsche Namen von Sprachen und Währungen auf den Länderseiten' },
    ],
  },
  {
    titel: 'Flaggen und Bilder',
    quellen: [
      { name: 'flag-icons', url: 'https://github.com/lipis/flag-icons', lizenz: 'MIT', wofuer: 'Flaggen aller Länder' },
      { name: 'Wikimedia Commons', url: 'https://commons.wikimedia.org', lizenz: 'je Datei (meist gemeinfrei oder CC BY-SA) – Liste in den QUELLEN.txt unten', wofuer: 'Regionsflaggen, historische Flaggen, Verkehrsschilder, Pflanzen-Fotos, Laut-Aufnahmen' },
      { name: 'Eigene Zeichnungen', url: '/geo', lizenz: 'seekclan.de', wofuer: 'Poller, Wegweiser, Fahrbahnlinien, Kennzeichen, Masten, Umrisse der Länder' },
    ],
  },
  {
    titel: 'GeoGuessr',
    text: 'Die Hinweise sind auf Deutsch neu formuliert und gekürzt und stehen wie das Original unter CC BY-NC-SA 4.0.',
    quellen: [
      { name: 'Plonk It', url: 'https://www.plonkit.net/guide', lizenz: 'CC BY-NC-SA 4.0', wofuer: 'Hinweise je Land (Europa, Südamerika, Afrika)' },
      { name: 'GeoGuessr – The Top Tips, Tricks and Techniques', url: 'https://somerandomstuff1.wordpress.com', lizenz: 'mit Quellenangabe', wofuer: 'ältere Hinweise (Europa)' },
      { name: 'Geometas – GeoGuessr Country Coverage', url: 'https://geometas.com/learn/geoguessr_country_coverage', lizenz: 'Fakten', wofuer: 'Liste der Länder mit Street View (Stand Oktober 2026, im Adminpanel änderbar)' },
    ],
  },
]

export default function QuellenPage() {
  // Higher Lower: je Quelle die Kategorien
  const hl = new Map<string, { name: string; url: string }[]>()
  for (const k of HL_KATEGORIEN) hl.set(k.quelle, [...(hl.get(k.quelle) ?? []), { name: k.name, url: k.url }])
  return (
    <div className="ga-page ga-quellen" style={{ maxWidth: 980 }}>
      <p className="ga-eyebrow">Geo-Atlas</p>
      <h1 className="ga-title" style={{ margin: '2px 0 8px' }}>Quellen</h1>
      <p className="ga-lead">
        Woher Karten, Zahlen, Bilder und Texte kommen. Alles stammt aus freien Quellen. Übersetzungen ins Deutsche, Zeichnungen und Zusammenstellung: seekclan.de.
      </p>
      {ABSCHNITTE.map(a => (
        <section key={a.titel} className="ga-land-sek">
          <h2 className="ga-h3">{a.titel}</h2>
          {a.text && <p className="ga-muted" style={{ margin: '6px 0 0', fontSize: 13.5 }}>{a.text}</p>}
          <ul className="ga-quellen-liste">
            {a.quellen.map(q => (
              <li key={q.name}>
                <a href={q.url} target={q.url.startsWith('/') ? undefined : '_blank'} rel="noopener noreferrer"><b>{q.name}</b></a>
                <span className="ga-badge kind">{q.lizenz}</span>
                <p>{q.wofuer}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <section className="ga-land-sek">
        <h2 className="ga-h3">Higher Lower und „Alle Zahlen“ auf den Länderseiten</h2>
        <p className="ga-muted" style={{ margin: '6px 0 0', fontSize: 13.5 }}>Je Kategorie der neueste Wert, Stand Oktober 2026. Korrekturen trägt das Team im Adminpanel ein.</p>
        <ul className="ga-quellen-liste">
          {[...hl].map(([quelle, kat]) => (
            <li key={quelle}>
              <b>{quelle}</b>
              <p>{kat.map((k, i) => <span key={k.name}>{i > 0 && ', '}<a href={k.url} target="_blank" rel="noopener noreferrer">{k.name}</a></span>)}</p>
            </li>
          ))}
        </ul>
      </section>
      <section className="ga-land-sek">
        <h2 className="ga-h3">Listen mit jeder einzelnen Datei</h2>
        <ul className="ga-quellen-liste">
          <li><a href="/geo/gg/QUELLEN.txt" target="_blank" rel="noopener"><b>GeoGuessr Europa</b></a><p>Schilder, Fotos und Lizenzen je Datei</p></li>
          <li><a href="/geo/gg-sa/QUELLEN.txt" target="_blank" rel="noopener"><b>GeoGuessr Südamerika</b></a><p>Pflanzen-Fotos, Zeichnungen</p></li>
          <li><a href="/geo/gg-af/QUELLEN.txt" target="_blank" rel="noopener"><b>GeoGuessr Afrika</b></a><p>Hinweise je Land</p></li>
        </ul>
      </section>
      <p className="ga-muted" style={{ fontSize: 13, marginTop: 24 }}><Link href="/geo/laender">Alle Länder</Link> · <Link href="/geo">Zurück zum Atlas</Link></p>
    </div>
  )
}
