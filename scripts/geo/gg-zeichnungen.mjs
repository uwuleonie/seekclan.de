// Eigene Zeichnungen für „GeoGuessr Europa“ (seekclan.de/geo): Poller, Wegweiser und Fahrbahn-Linien je Land.
//
// Die Angaben (Farben, Formen) stammen aus den Hinweisen in scripts/geo/gg/laender.json – also aus Plonk It
// (plonkit.net, CC BY-NC-SA 4.0) und dem älteren GeoGuessr-Guide. Was dort nicht steht, ist vereinfacht:
//  - Poller: Umriss von vorne, Maße frei gewählt
//  - Wegweiser: Ortsnamen sind echte Orte im Land, Entfernungen sind Beispiele
//  - Linien: Wo die Quelle nur „Randlinie“ ohne Farbe nennt, ist sie weiß gezeichnet – „Most European countries
//    reserve white for routine lane markings“ (Wikipedia: Road surface marking). Irland, Niederlande, Norwegen,
//    Finnland und das Vereinigte Königreich zusätzlich nach demselben Wikipedia-Artikel.
// Wird von scripts/geo/build-gg.mjs benutzt (schreibt die SVG-Dateien nach public/geo/gg/poller|wegweiser|linien/).

/* ───────────── Farben ───────────── */

const W = '#f4f2ec', S = '#1c1c1c', ROT = '#d3262c', DROT = '#86171c', HROT = '#ff5a52', OR = '#f28a17', DOR = '#c8611a'
const GE = '#f2c230', GOR = '#f5a623', GRAU = '#a9a9a9', HGRAU = '#dcdcdc', BL = '#2459c2', GN = '#1f7a45', BR = '#4e3322', HOLZ = '#c99b5c'

/* ───────────── Poller ─────────────
 * form:   keil | flach | rund | spitz | dreieck | duenn | stab | stein
 * koerper Farbe des Pollers
 * kopf    { farbe, bis, schraeg }   farbiger Kopf oben (bis = y, Boden = 140, Oberkante ≈ 28)
 * band    { farbe, von, bis, schraeg }   farbiges Band (z. B. schwarzes Feld um den Reflektor)
 * streifen [{ farbe, von, bis }]   weitere waagrechte Streifen
 * unten   { farbe, ab }   unterer Teil in anderer Farbe
 * refl    { farbe, form, y, x }   form: rechteck | hoch | quadrat | breit | zwei | ring | streifen
 * noppe, aufsatz (Farbe des seitlichen Aufsatzes)
 */
export const POLLER = {
  'albania': [{ titel: 'Dreieckig, schwarze Kappe, roter Reflektor – wie in Italien', form: 'dreieck', koerper: W, kopf: { farbe: S, bis: 64, schraeg: true }, refl: { farbe: ROT, form: 'rechteck', y: 50 } }],
  'andorra': [{ titel: 'Poller mit orangem Reflektor', form: 'keil', koerper: W, refl: { farbe: OR, form: 'rechteck', y: 46 } }],
  'austria': [{ titel: 'Weiß mit schwarzem Kopf, dunkelroter Reflektor, kleine Noppe', form: 'keil', koerper: W, kopf: { farbe: S, bis: 58 }, refl: { farbe: DROT, form: 'rechteck', y: 47 }, noppe: true }],
  'azores': [{ titel: 'Portugiesischer Poller mit weißem Reflektor', form: 'keil', koerper: W, refl: { farbe: W, form: 'rechteck', y: 46 } }],
  'belgium': [
    { titel: 'Weiß mit gelbem rechteckigem Reflektor', form: 'keil', koerper: W, refl: { farbe: GE, form: 'rechteck', y: 46 } },
    { titel: 'Dunkelbraun mit zwei roten Streifen', form: 'keil', koerper: BR, streifen: [{ farbe: ROT, von: 36, bis: 42 }, { farbe: ROT, von: 48, bis: 54 }] },
  ],
  'bosnia-and-herzegovina': [{ titel: 'Schwarze Kappe, roter Streifen seitlich versetzt', form: 'keil', koerper: W, kopf: { farbe: S, bis: 54 }, refl: { farbe: ROT, form: 'streifen', y: 66, x: 46 } }],
  'bulgaria': [{ titel: 'Schlicht weiß mit rotem Reflektor (selten)', form: 'keil', koerper: W, refl: { farbe: ROT, form: 'rechteck', y: 46 } }],
  'croatia': [
    { titel: 'Dreieckig, schwarzes Feld, roter Reflektor', form: 'dreieck', koerper: W, band: { farbe: S, von: 40, bis: 64 }, refl: { farbe: ROT, form: 'rechteck', y: 52 } },
    { titel: 'Variante mit weißem Reflektor', form: 'dreieck', koerper: W, band: { farbe: S, von: 40, bis: 64 }, refl: { farbe: W, form: 'rechteck', y: 52 } },
  ],
  'cyprus': [{ titel: 'Dreieckig mit schräger Oberseite, roter Reflektor', form: 'keil', koerper: W, refl: { farbe: ROT, form: 'rechteck', y: 44 } }],
  'czechia': [{ titel: 'Schwarz-weiß mit zwei orangen Reflektoren', form: 'keil', koerper: W, band: { farbe: S, von: 34, bis: 72 }, refl: { farbe: OR, form: 'zwei', y: 53 } }],
  'denmark': [
    { titel: 'Weiß, gelber Reflektor, dunkeloranger Streifen oben', form: 'keil', koerper: W, streifen: [{ farbe: DOR, von: 26, bis: 38 }], refl: { farbe: GE, form: 'rechteck', y: 50 } },
  ],
  'estonia': [{ titel: 'Rund wie ein Stab, rechteckiger Reflektor (weiß oder orange)', form: 'rund', koerper: W, band: { farbe: S, von: 36, bis: 58, schraeg: true }, refl: { farbe: W, form: 'rechteck', y: 47 } }],
  'faroe-islands': [{ titel: 'Kleiner gelber Holzstab, manchmal mit roter Spitze', form: 'stab', koerper: GE, kopf: { farbe: ROT, bis: 44 } }],
  'finland': [{ titel: 'Lang, schwarz-weiß, schräges Band, weißer Reflektor', form: 'rund', koerper: W, band: { farbe: S, von: 36, bis: 60, schraeg: true }, refl: { farbe: W, form: 'rechteck', y: 48 } }],
  'france': [
    { titel: 'Rund, spitze Kappe, Reflektorband rundherum (rot)', form: 'spitz', koerper: W, refl: { farbe: ROT, form: 'ring', y: 54 } },
    { titel: 'Gleiche Form mit grauem Reflektorband', form: 'spitz', koerper: W, refl: { farbe: GRAU, form: 'ring', y: 54 } },
  ],
  'germany': [
    { titel: 'Weiß mit schwarzem Band, weißer Reflektor', form: 'keil', koerper: W, band: { farbe: S, von: 36, bis: 62, schraeg: true }, refl: { farbe: W, form: 'hoch', y: 49 } },
    { titel: 'An Kreuzungen: oranger Reflektor', form: 'keil', koerper: W, band: { farbe: S, von: 36, bis: 62, schraeg: true }, refl: { farbe: OR, form: 'hoch', y: 49 } },
  ],
  'greece': [{ titel: 'Keilförmig, fast quadratischer roter Reflektor', form: 'keil', koerper: W, refl: { farbe: ROT, form: 'quadrat', y: 46 } }],
  'hungary': [
    { titel: 'Schwarz-weißer Keilpoller, roter Reflektor', form: 'keil', koerper: W, band: { farbe: S, von: 46, bis: 70 }, refl: { farbe: ROT, form: 'rechteck', y: 58 } },
    { titel: 'Variante mit blauem Reflektor', form: 'keil', koerper: W, band: { farbe: S, von: 46, bis: 70 }, refl: { farbe: BL, form: 'rechteck', y: 58 } },
  ],
  'iceland': [{ titel: 'Gelb mit weißem Reflektor', form: 'keil', koerper: GE, refl: { farbe: W, form: 'rechteck', y: 46 } }],
  'ireland': [{ titel: 'Grün-weißer Poller', form: 'keil', koerper: W, kopf: { farbe: GN, bis: 56 } }],
  'isle-of-man': [
    { titel: 'Wie im Vereinigten Königreich: schwarz-weiß, roter Reflektor', form: 'rund', koerper: W, kopf: { farbe: S, bis: 46 }, unten: { farbe: S, ab: 110 }, refl: { farbe: ROT, form: 'rechteck', y: 58 } },
    { titel: 'In Orten: blaue Poller', form: 'rund', koerper: BL },
  ],
  'italy': [{ titel: 'Dreieckig, schwarze Spitze schräg, roter Reflektor', form: 'dreieck', koerper: W, kopf: { farbe: S, bis: 64, schraeg: true }, refl: { farbe: ROT, form: 'rechteck', y: 50 } }],
  'latvia': [{ titel: 'Dünn, leicht gebogen, schräges Band, rechteckiger Reflektor', form: 'duenn', koerper: W, band: { farbe: S, von: 38, bis: 58, schraeg: true }, refl: { farbe: W, form: 'rechteck', y: 48 } }],
  'liechtenstein': [{ titel: 'Rund, abgerundete Kappe, blauer Aufsatz an der Seite', form: 'rund', koerper: W, kopf: { farbe: S, bis: 54 }, refl: { farbe: HGRAU, form: 'rechteck', y: 45 }, aufsatz: BL }],
  'lithuania': [{ titel: 'Keilförmig, oranger rechteckiger Reflektor', form: 'keil', koerper: W, band: { farbe: S, von: 40, bis: 62 }, refl: { farbe: OR, form: 'rechteck', y: 51 } }],
  'luxembourg': [{ titel: 'Schwarz-weißer Keilpoller, grauer Reflektor (drei Schrauben)', form: 'keil', koerper: W, band: { farbe: S, von: 36, bis: 62, schraeg: true }, refl: { farbe: GRAU, form: 'hoch', y: 49 } }],
  'madeira': [{ titel: 'Kleiner Steinpoller mit rotem Reflektor', form: 'stein', koerper: '#b9b4aa', refl: { farbe: ROT, form: 'rechteck', y: 118 } }],
  'montenegro': [{ titel: 'Weiß mit schwarzer Kappe, roter Reflektor', form: 'keil', koerper: W, kopf: { farbe: S, bis: 54 }, refl: { farbe: ROT, form: 'rechteck', y: 62 } }],
  'netherlands': [{ titel: 'Schlicht weiß, roter länglicher Reflektor', form: 'keil', koerper: W, refl: { farbe: ROT, form: 'hoch', y: 48 } }],
  'north-macedonia': [{ titel: 'Weiß, roter Reflektor auf schwarzer Fläche', form: 'keil', koerper: W, band: { farbe: S, von: 40, bis: 62 }, refl: { farbe: ROT, form: 'rechteck', y: 51 } }],
  'norway': [{ titel: 'Dünn, leicht gebogen, Reflektor in schwarzem Parallelogramm', form: 'duenn', koerper: W, band: { farbe: S, von: 38, bis: 60, schraeg: true }, refl: { farbe: HGRAU, form: 'rechteck', y: 49 } }],
  'poland': [{ titel: 'Rotes Band rundherum mit rotem Reflektor', form: 'keil', koerper: W, band: { farbe: ROT, von: 40, bis: 54 }, refl: { farbe: DROT, form: 'rechteck', y: 47 } }],
  'portugal': [{ titel: 'Keilförmig, weißer Reflektor (selten dunkelorange)', form: 'keil', koerper: W, refl: { farbe: W, form: 'rechteck', y: 46 } }],
  'romania': [{ titel: 'Dünn und weiß, oben roter senkrechter Streifen', form: 'duenn', koerper: W, refl: { farbe: ROT, form: 'streifen', y: 50 } }],
  'russia': [{ titel: 'Schwarzer Kopf, darunter senkrechter roter Reflektor', form: 'keil', koerper: W, kopf: { farbe: S, bis: 46 }, refl: { farbe: ROT, form: 'hoch', y: 62 } }],
  'san-marino': [{ titel: 'Wie in Italien: dreieckig, schwarze Spitze', form: 'dreieck', koerper: W, kopf: { farbe: S, bis: 64, schraeg: true }, refl: { farbe: ROT, form: 'rechteck', y: 50 } }],
  'serbia': [{ titel: 'Flach, roter Reflektor seitlich versetzt', form: 'flach', koerper: W, kopf: { farbe: S, bis: 62 }, refl: { farbe: ROT, form: 'streifen', y: 76, x: 48 } }],
  'slovakia': [
    { titel: 'Wie Tschechien: zwei orange Reflektoren', form: 'keil', koerper: W, band: { farbe: S, von: 34, bis: 72 }, refl: { farbe: OR, form: 'zwei', y: 53 } },
    { titel: 'Neu und noch selten: Keilpoller mit rotem Reflektor', form: 'keil', koerper: W, band: { farbe: S, von: 46, bis: 70 }, refl: { farbe: ROT, form: 'rechteck', y: 58 } },
  ],
  'slovenia': [{ titel: 'Weiß mit schwarzem Kopf, hellroter Reflektor mit Abstand', form: 'keil', koerper: W, kopf: { farbe: S, bis: 50 }, refl: { farbe: HROT, form: 'rechteck', y: 64 } }],
  'spain': [{ titel: 'Hohl, gelb-oranger Reflektor', form: 'keil', koerper: W, refl: { farbe: GOR, form: 'rechteck', y: 46 } }],
  'sweden': [
    { titel: 'Schwarz-weiß, grauer Reflektor', form: 'keil', koerper: W, band: { farbe: S, von: 36, bis: 60 }, refl: { farbe: GRAU, form: 'rechteck', y: 48 } },
    { titel: 'An Kreuzungen: oranger Reflektor', form: 'keil', koerper: W, band: { farbe: S, von: 36, bis: 60 }, refl: { farbe: OR, form: 'rechteck', y: 48 } },
  ],
  'switzerland': [{ titel: 'Rund mit abgerundeter Kappe, weißer oder grauer Reflektor', form: 'rund', koerper: W, kopf: { farbe: S, bis: 54 }, refl: { farbe: HGRAU, form: 'rechteck', y: 45 } }],
  'turkey': [{ titel: 'Rechteckig, flach, schlicht weiß, roter Reflektor', form: 'flach', koerper: W, refl: { farbe: ROT, form: 'rechteck', y: 62 } }],
  'ukraine': [{ titel: 'Breites rotes Rechteck, oft beschädigt', form: 'keil', koerper: W, refl: { farbe: ROT, form: 'breit', y: 48 } }],
  'united-kingdom': [{ titel: 'Abgerundet, oben und unten schwarz, roter Reflektor', form: 'rund', koerper: W, kopf: { farbe: S, bis: 46 }, unten: { farbe: S, ab: 110 }, refl: { farbe: ROT, form: 'rechteck', y: 58 } }],
}

const BODY = {
  keil: 'M28 140V34L52 27V140Z',
  flach: 'M24 140V56L56 49V140Z',
  rund: 'M28 140V40A12 12 0 0 1 52 40V140Z',
  spitz: 'M28 140V46L40 22L52 46V140Z',
  dreieck: 'M29 140V36L40 27L51 36V140Z',
  duenn: 'M32 140C32 110 31 70 33 34L48 29C46 70 47 110 47 140Z',
  stab: 'M37 140V30H43V140Z',
  stein: 'M25 140V106Q25 100 31 100H49Q55 100 55 106V140Z',
}

function reflSvg(r, form) {
  const x = r.x ?? (form === 'duenn' ? 40 : 40)
  const { farbe: f, y } = r
  const st = `stroke="#00000033" stroke-width="0.8"`
  switch (r.form) {
    case 'hoch': return `<rect x="${x - 3.5}" y="${y - 9}" width="7" height="18" rx="1" fill="${f}" ${st}/>`
    case 'quadrat': return `<rect x="${x - 6}" y="${y - 6}" width="12" height="12" rx="1" fill="${f}" ${st}/>`
    case 'breit': return `<rect x="${x - 10}" y="${y - 5}" width="20" height="10" rx="1" fill="${f}" ${st}/>`
    case 'zwei': return `<rect x="${x - 5}" y="${y - 12}" width="10" height="9" rx="1.5" fill="${f}" ${st}/><rect x="${x - 5}" y="${y + 3}" width="10" height="9" rx="1.5" fill="${f}" ${st}/>`
    case 'ring': return `<rect x="0" y="${y - 5}" width="80" height="10" fill="${f}"/>`
    case 'streifen': return `<rect x="${x - 2.5}" y="${y - 10}" width="5" height="20" rx="1" fill="${f}" ${st}/>`
    default: return `<rect x="${x - 6.5}" y="${y - 4.5}" width="13" height="9" rx="1.2" fill="${f}" ${st}/>`
  }
}

/** Ein Poller als SVG (von vorne) */
export function pollerSvg(p, id) {
  const clip = `pc-${id}`
  const parts = []
  if (p.kopf) parts.push(p.kopf.schraeg
    ? `<polygon points="0,0 80,0 80,${p.kopf.bis - 10} 0,${p.kopf.bis + 6}" fill="${p.kopf.farbe}"/>`
    : `<rect x="0" y="0" width="80" height="${p.kopf.bis}" fill="${p.kopf.farbe}"/>`)
  if (p.unten) parts.push(`<rect x="0" y="${p.unten.ab}" width="80" height="${150 - p.unten.ab}" fill="${p.unten.farbe}"/>`)
  for (const s of p.streifen ?? []) parts.push(`<rect x="0" y="${s.von}" width="80" height="${s.bis - s.von}" fill="${s.farbe}"/>`)
  if (p.band) parts.push(p.band.schraeg
    ? `<polygon points="0,${p.band.von + 5} 80,${p.band.von - 5} 80,${p.band.bis - 5} 0,${p.band.bis + 5}" fill="${p.band.farbe}"/>`
    : `<rect x="0" y="${p.band.von}" width="80" height="${p.band.bis - p.band.von}" fill="${p.band.farbe}"/>`)
  if (p.refl) parts.push(reflSvg(p.refl, p.form))
  const d = BODY[p.form] ?? BODY.keil
  const dark = ['#1c1c1c', BR, BL, GN].includes(p.koerper)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 150" width="160" height="300">` +
    `<defs><clipPath id="${clip}"><path d="${d}"/></clipPath><linearGradient id="${clip}-g" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity="0.16"/><stop offset="0.45" stop-color="#fff" stop-opacity="0.12"/><stop offset="1" stop-color="#000" stop-opacity="0.22"/></linearGradient></defs>` +
    `<ellipse cx="40" cy="141" rx="26" ry="4" fill="#00000040"/>` +
    (p.aufsatz ? `<rect x="51" y="62" width="6" height="22" rx="2" fill="${p.aufsatz}"/>` : '') +
    `<path d="${d}" fill="${p.koerper}"/>` +
    `<g clip-path="url(#${clip})">${parts.join('')}<rect x="0" y="0" width="80" height="150" fill="url(#${clip}-g)"/></g>` +
    `<path d="${d}" fill="none" stroke="${dark ? '#00000080' : '#55555599'}" stroke-width="1.2"/>` +
    (p.noppe ? `<circle cx="40" cy="${p.form === 'keil' ? 27 : 26}" r="3.2" fill="${S}"/>` : '') +
    `</svg>`
}

/* ───────────── Wegweiser ─────────────
 * form: pfeil | rechteck | bleistift
 * grund, schrift, rand (äußerer Rand), innen (Linie etwas innerhalb des Randes)
 * pfeil: voll | duenn | schwarz (Pfeil-Symbol, nur bei rechteck)
 * zeilen: [Zeile 1, Zeile 2?, Farbe Zeile 1?, Farbe Zeile 2?] · km: Beispiel-Entfernung
 * nummer: { grund, schrift, text }
 */
export const WEGWEISER = {
  'austria': [{ titel: 'Weiß mit blauem Rand', form: 'pfeil', grund: '#ffffff', schrift: S, rand: BL, zeilen: ['Salzburg'], km: 24 }],
  'belgium': [
    { titel: 'Blau mit weißer Schrift', form: 'rechteck', grund: BL, schrift: '#fff', rand: '#fff', pfeil: 'voll', zeilen: ['Namur'], km: 31 },
    { titel: 'Oder weiß', form: 'rechteck', grund: '#fff', schrift: S, rand: S, pfeil: 'voll', zeilen: ['Brugge'], km: 12 },
  ],
  'bulgaria': [{ titel: 'Blau, pfeilförmig, Kyrillisch und Latein', form: 'pfeil', grund: BL, schrift: '#fff', rand: '#fff', zeilen: ['София', 'Sofia'], km: 48 }],
  'croatia': [
    { titel: 'Gelb mit schwarzem Rand und Bleistift-Spitze', form: 'bleistift', grund: GE, schrift: S, rand: S, zeilen: ['Zagreb'], km: 18 },
    { titel: 'Große Wegweiser: grün mit weißer Schrift', form: 'rechteck', grund: GN, schrift: '#fff', rand: '#fff', pfeil: 'voll', zeilen: ['Split'], km: 62 },
  ],
  'cyprus': [{ titel: 'Wie Griechenland, Griechisch in Großbuchstaben', form: 'pfeil', grund: BL, schrift: '#fff', rand: '#fff', zeilen: ['ΛΕΥΚΩΣΙΑ', 'Nicosia', GE, '#fff'], km: 35 }],
  'czechia': [{ titel: 'Blau, Pfeilform mit gefüllter Spitze', form: 'pfeil', grund: BL, schrift: '#fff', rand: '#fff', zeilen: ['Praha'], km: 25 }],
  'estonia': [{ titel: 'Blau mit weißer Schrift und weißem Rand', form: 'rechteck', grund: BL, schrift: '#fff', rand: '#fff', pfeil: 'voll', zeilen: ['Tallinn'], km: 32 }],
  'faroe-islands': [{ titel: 'Gelb mit dünnem schwarzem Rand', form: 'rechteck', grund: GE, schrift: S, rand: S, pfeil: 'voll', zeilen: ['Tórshavn'], km: 12 }],
  'finland': [{ titel: 'Blau, Pfeil als Teil des Randes', form: 'pfeil', grund: BL, schrift: '#fff', rand: '#fff', zeilen: ['Helsinki'], km: 40 }],
  'france': [{ titel: 'Weiß, pfeilförmig, schwarze Linie innen', form: 'pfeil', grund: '#fff', schrift: S, innen: S, zeilen: ['Lyon'], km: 12 }],
  'germany': [{ titel: 'Gelb mit schwarzer Schrift', form: 'pfeil', grund: GE, schrift: S, rand: S, zeilen: ['Kassel'], km: 23 }],
  'greece': [{ titel: 'Blau: Griechisch in Gelb, darunter Englisch in Weiß', form: 'pfeil', grund: BL, schrift: '#fff', rand: '#fff', zeilen: ['Αθήνα', 'Athina', GE, '#fff'], km: 54 }],
  'hungary': [{ titel: 'Grün mit weißem Innenrand', form: 'rechteck', grund: GN, schrift: '#fff', innen: '#fff', pfeil: 'voll', zeilen: ['Budapest'], km: 54 }],
  'iceland': [{ titel: 'Gelb, weißer Kasten für die Straßennummer', form: 'rechteck', grund: GE, schrift: S, rand: S, pfeil: 'voll', zeilen: ['Reykjavík'], km: 45, nummer: { grund: '#fff', schrift: S, text: '1' } }],
  'isle-of-man': [{ titel: 'Grün mit Straßennummer', form: 'rechteck', grund: GN, schrift: '#fff', rand: '#fff', pfeil: 'voll', zeilen: ['Douglas'], km: 8, nummer: { grund: GN, schrift: GE, text: 'A1' } }],
  'italy': [
    { titel: 'Blau mit weißem Pfeil, Großbuchstaben', form: 'pfeil', grund: BL, schrift: '#fff', innen: '#fff', gross: true, zeilen: ['Roma'], km: 15 },
    { titel: 'Autobahnen: grün', form: 'pfeil', grund: GN, schrift: '#fff', innen: '#fff', gross: true, zeilen: ['Milano'], km: 40 },
  ],
  'latvia': [{ titel: 'Blau mit weißer Schrift', form: 'rechteck', grund: BL, schrift: '#fff', rand: '#fff', pfeil: 'duenn', zeilen: ['Rīga'], km: 50 }],
  'liechtenstein': [
    { titel: 'Blau für größere Straßen', form: 'pfeil', grund: BL, schrift: '#fff', rand: '#fff', zeilen: ['Vaduz'], km: 4 },
    { titel: 'Weiß für kleinere Straßen', form: 'pfeil', grund: '#fff', schrift: S, rand: S, zeilen: ['Malbun'], km: 9 },
  ],
  'lithuania': [{ titel: 'Blau mit weißer Schrift, einfacher Pfeil', form: 'rechteck', grund: BL, schrift: '#fff', rand: '#fff', pfeil: 'voll', zeilen: ['Vilnius'], km: 30 }],
  'luxembourg': [{ titel: 'Gelb, dünne schwarze Linie, Großbuchstaben, roter Nummernkasten', form: 'pfeil', grund: GE, schrift: S, innen: S, gross: true, zeilen: ['Ettelbruck'], km: 12, nummer: { grund: ROT, schrift: '#fff', text: 'N7' } }],
  'montenegro': [{ titel: 'Gelb mit schwarzer Schrift', form: 'pfeil', grund: GE, schrift: S, rand: S, zeilen: ['Podgorica'], km: 20 }],
  'netherlands': [{ titel: 'Blau mit weißer Schrift', form: 'rechteck', grund: BL, schrift: '#fff', rand: '#fff', pfeil: 'voll', zeilen: ['Utrecht'], km: 18 }],
  'north-macedonia': [{ titel: 'Gelb, oben Kyrillisch, darunter Latein', form: 'pfeil', grund: GE, schrift: S, rand: S, zeilen: ['Скопје', 'Skopje'], km: 36 }],
  'norway': [{ titel: 'Gelb mit schwarzem Rand, grünes Nummernkästchen', form: 'rechteck', grund: GE, schrift: S, rand: S, pfeil: 'voll', zeilen: ['Trondheim'], km: 54, nummer: { grund: GN, schrift: '#fff', text: 'E6' } }],
  'poland': [{ titel: 'Grün mit weißer Schrift', form: 'rechteck', grund: GN, schrift: '#fff', rand: '#fff', pfeil: 'voll', zeilen: ['Kraków'], km: 45 }],
  'portugal': [{ titel: 'Weiß, schwarze Pfeile berühren den Rand nicht', form: 'rechteck', grund: '#fff', schrift: S, rand: '#fff', pfeil: 'schwarz', zeilen: ['Porto'], km: 30 }],
  'romania': [{ titel: 'Blau, pfeilförmig, weiß umrandet, rote Straßennummer', form: 'pfeil', grund: BL, schrift: '#fff', rand: '#fff', zeilen: ['Brașov'], km: 40, nummer: { grund: ROT, schrift: '#fff', text: 'DN1' } }],
  'russia': [{ titel: 'Blau mit weißer Schrift, meist nur Kyrillisch', form: 'rechteck', grund: BL, schrift: '#fff', rand: '#fff', pfeil: 'voll', zeilen: ['Москва'], km: 35 }],
  'serbia': [{ titel: 'Gelb, Kyrillisch und/oder Latein', form: 'pfeil', grund: GE, schrift: S, rand: S, zeilen: ['Београд', 'Beograd'], km: 28 }],
  'slovakia': [{ titel: 'Blau mit kleinen weißen Pfeilen', form: 'rechteck', grund: BL, schrift: '#fff', rand: '#fff', pfeil: 'duenn', zeilen: ['Bratislava'], km: 20 }],
  'slovenia': [{ titel: 'Gelb mit schwarzem Rand', form: 'bleistift', grund: GE, schrift: S, rand: S, zeilen: ['Ljubljana'], km: 25 }],
  'spain': [{ titel: 'Weiß, dünner schwarzer Rand, buntes Nummernkästchen', form: 'rechteck', grund: '#fff', schrift: S, rand: S, zeilen: ['Madrid'], km: 45, nummer: { grund: ROT, schrift: '#fff', text: 'N-340' } }],
  'sweden': [
    { titel: 'Blau mit weißem Rand und dünnem Pfeil', form: 'rechteck', grund: BL, schrift: '#fff', rand: '#fff', pfeil: 'duenn', zeilen: ['Uppsala'], km: 32 },
    { titel: 'Für kleine Orte: gelb mit rotem Rand', form: 'rechteck', grund: GE, schrift: S, rand: ROT, pfeil: 'duenn', zeilen: ['Björkby'], km: 3 },
  ],
  'switzerland': [
    { titel: 'Hauptstraßen: blau', form: 'pfeil', grund: BL, schrift: '#fff', rand: '#fff', zeilen: ['Bern'], km: 25 },
    { titel: 'Nebenstraßen: weiß', form: 'pfeil', grund: '#fff', schrift: S, rand: S, zeilen: ['Thun'], km: 11 },
  ],
  'ukraine': [{ titel: 'Blau, oben Kyrillisch, darunter Latein', form: 'rechteck', grund: BL, schrift: '#fff', rand: '#fff', pfeil: 'voll', zeilen: ['Київ', 'Kyiv'], km: 42 }],
  'united-kingdom': [{ titel: 'Grün, blau oder weiß – hier grün mit A-Straße', form: 'rechteck', grund: GN, schrift: '#fff', rand: '#fff', pfeil: 'voll', zeilen: ['Leeds'], km: 24, nummer: { grund: GN, schrift: GE, text: 'A1' } }],
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')

/** Ein Wegweiser als SVG. anonym = Ortsnamen als Balken (für Lernkarten, damit der Name das Land nicht verrät) */
export function wegweiserSvg(w, anonym = false) {
  const W0 = 10, W1 = 250, Y0 = 14, Y1 = 86, M = 50
  let outline
  if (w.form === 'pfeil') outline = `M${W0} ${Y0}H${W1 - 30}L${W1} ${M}L${W1 - 30} ${Y1}H${W0}Z`
  else if (w.form === 'bleistift') outline = `M${W0} ${Y0}H${W1 - 40}L${W1} ${M}L${W1 - 40} ${Y1}H${W0}Z`
  else outline = `M${W0 + 4} ${Y0}H${W1 - 4}Q${W1} ${Y0} ${W1} ${Y0 + 4}V${Y1 - 4}Q${W1} ${Y1} ${W1 - 4} ${Y1}H${W0 + 4}Q${W0} ${Y1} ${W0} ${Y1 - 4}V${Y0 + 4}Q${W0} ${Y0} ${W0 + 4} ${Y0}Z`
  const parts = [`<path d="${outline}" fill="${w.grund}" ${w.rand ? `stroke="${w.rand}" stroke-width="4"` : 'stroke="#00000055" stroke-width="1"'} stroke-linejoin="round"/>`]
  if (w.innen) {
    const inset = w.form === 'rechteck'
      ? `M${W0 + 6} ${Y0 + 6}H${W1 - 6}V${Y1 - 6}H${W0 + 6}Z`
      : `M${W0 + 6} ${Y0 + 6}H${W1 - (w.form === 'bleistift' ? 43 : 33)}L${W1 - 9} ${M}L${W1 - (w.form === 'bleistift' ? 43 : 33)} ${Y1 - 6}H${W0 + 6}Z`
    parts.push(`<path d="${inset}" fill="none" stroke="${w.innen}" stroke-width="${w.form === 'pfeil' ? 3 : 2}" stroke-linejoin="round"/>`)
  }
  if (w.form === 'bleistift') parts.push(`<path d="M${W1 - 40} ${Y0 + 2}V${Y1 - 2}" stroke="${w.rand ?? S}" stroke-width="2.5"/>`)
  // Nummernkasten links
  let tx = W0 + 14
  if (w.nummer) {
    const nw = 16 + w.nummer.text.length * 11
    parts.push(`<rect x="${tx}" y="${M - 13}" width="${nw}" height="26" rx="3" fill="${w.nummer.grund}" stroke="${w.nummer.grund === w.grund ? w.schrift : '#00000040'}" stroke-width="1.5"/>`)
    parts.push(`<text x="${tx + nw / 2}" y="${M + 6.5}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="17" fill="${w.nummer.schrift}">${esc(w.nummer.text)}</text>`)
    tx += nw + 10
  }
  const [z1, z2, c1, c2] = w.zeilen
  const t1 = w.gross ? z1.toUpperCase() : z1
  const right = w.form === 'rechteck' ? W1 - (w.pfeil ? 46 : 14) : W1 - (w.form === 'bleistift' ? 46 : 36)
  const kmX = right
  // Schrift so groß wie möglich, ohne in die Entfernung zu laufen (Breite grob geschätzt)
  const avail = kmX - 34 - tx
  const fit = (t, max) => Math.max(12, Math.min(max, avail / (t.length * (w.gross ? 0.7 : 0.6))))
  const bar = (y, t, size, col) => `<rect x="${tx}" y="${y - size * 0.72}" width="${Math.min(avail, t.length * size * 0.56).toFixed(1)}" height="${(size * 0.72).toFixed(1)}" rx="2.5" fill="${col}" opacity="0.85"/>`
  if (anonym) {
    if (z2) { parts.push(bar(M - 4, t1, fit(t1, 20), c1 ?? w.schrift)); parts.push(bar(M + 20, z2, fit(z2, 17), c2 ?? w.schrift)) }
    else parts.push(bar(M + 8, t1, fit(t1, 23), w.schrift))
  } else if (z2) {
    parts.push(`<text x="${tx}" y="${M - 4}" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${fit(t1, 20).toFixed(1)}" fill="${c1 ?? w.schrift}">${esc(t1)}</text>`)
    parts.push(`<text x="${tx}" y="${M + 20}" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${fit(z2, 17).toFixed(1)}" fill="${c2 ?? w.schrift}">${esc(w.gross ? z2.toUpperCase() : z2)}</text>`)
  } else {
    parts.push(`<text x="${tx}" y="${M + 8}" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${fit(t1, 23).toFixed(1)}" fill="${w.schrift}">${esc(t1)}</text>`)
  }
  parts.push(`<text x="${kmX}" y="${M + 8}" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="21" fill="${c2 && !z2 ? c2 : w.schrift}">${w.km}</text>`)
  if (w.form === 'rechteck' && w.pfeil) {
    const ax = W1 - 38, col = w.pfeil === 'schwarz' ? S : w.schrift
    if (w.pfeil === 'duenn') parts.push(`<path d="M${ax} ${M}H${ax + 24}M${ax + 16} ${M - 8}L${ax + 24} ${M}L${ax + 16} ${M + 8}" fill="none" stroke="${col}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`)
    else parts.push(`<path d="M${ax} ${M - 5}H${ax + 12}V${M - 12}L${ax + 26} ${M}L${ax + 12} ${M + 12}V${M + 5}H${ax}Z" fill="${col}"/>`)
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 100" width="520" height="200">${parts.join('')}</svg>`
}

/* ───────────── Fahrbahn-Linien ─────────────
 * mitte: { farbe, art }  art: strich | lang | doppelt | durch | durch+strich (farbe2 = Strichfarbe) | bloecke | dick | duenn
 * rand:  { farbe, art }  art: durch | kurz | lang | weit | quadrate | doppelt
 */
const LW = '#f3f3f0', LG = '#f2c230', LGO = '#f3a51c'
export const LINIEN = {
  'belgium': [{ titel: 'Alles weiß', mitte: { farbe: LW, art: 'strich' }, rand: { farbe: LW, art: 'durch' } }],
  'bulgaria': [{ titel: 'Meist dünne Linien', mitte: { farbe: LW, art: 'duenn' } }],
  'czechia': [{ titel: 'Oft nur Randlinien, keine Mittellinie', rand: { farbe: LW, art: 'durch' } }],
  'denmark': [{ titel: 'Doppelte weiße Mittellinie, Rand aus kleinen Quadraten', mitte: { farbe: LW, art: 'doppelt' }, rand: { farbe: LW, art: 'quadrate' } }],
  'estonia': [{ titel: 'Weiß, Randlinie manchmal aus kurzen Strichen', mitte: { farbe: LW, art: 'strich' }, rand: { farbe: LW, art: 'kurz' } }],
  'faroe-islands': [{ titel: 'Lange weiße Randstriche', rand: { farbe: LW, art: 'lang' } }],
  'finland': [
    { titel: 'Weiße Mittelstriche, Rand immer durchgehend', mitte: { farbe: LW, art: 'strich' }, rand: { farbe: LW, art: 'durch' } },
    { titel: 'Seltener: gelbe Linie neben weißen Strichen', mitte: { farbe: LG, farbe2: LW, art: 'durch+strich' }, rand: { farbe: LW, art: 'durch' } },
  ],
  'france': [
    { titel: 'Lange Mittelstriche, weit auseinanderliegende Randstriche', mitte: { farbe: LW, art: 'lang' }, rand: { farbe: LW, art: 'weit' } },
    { titel: 'Nur in Frankreich: Mittellinie aus versetzten Blöcken', mitte: { farbe: LW, art: 'bloecke' }, rand: { farbe: LW, art: 'weit' } },
  ],
  'greece': [{ titel: 'Durchgehende doppelte weiße Mittellinie', mitte: { farbe: LW, art: 'doppelt' } }],
  'iceland': [{ titel: 'Nur weiße Linien', mitte: { farbe: LW, art: 'strich' }, rand: { farbe: LW, art: 'durch' } }],
  'ireland': [{ titel: 'Weiße Mitte, gelbe gestrichelte Randlinie', mitte: { farbe: LW, art: 'strich' }, rand: { farbe: LG, art: 'kurz' } }],
  'italy': [{ titel: 'Weiße Randlinien, oft ohne Mittellinie', rand: { farbe: LW, art: 'durch' } }],
  'jersey': [{ titel: 'Gelbe Randlinie, weiße gestrichelte Mitte', mitte: { farbe: LW, art: 'strich' }, rand: { farbe: LG, art: 'durch' } }],
  'lithuania': [{ titel: 'Randlinie manchmal aus kurzen Strichen', rand: { farbe: LW, art: 'kurz' } }],
  'malta': [{ titel: 'Doppelte gelbe Linie am Rand (Parkverbot)', rand: { farbe: LG, art: 'doppelt' } }],
  'netherlands': [{ titel: 'Alles weiß, Ränder oft gestrichelt', mitte: { farbe: LW, art: 'strich' }, rand: { farbe: LW, art: 'kurz' } }],
  'norway': [
    { titel: 'Gelbe Mittellinie (wirkt orange), weißer Rand', mitte: { farbe: LGO, art: 'strich' }, rand: { farbe: LW, art: 'durch' } },
    { titel: 'Kleine Straßen: lange weiße Randstriche', rand: { farbe: LW, art: 'lang' } },
  ],
  'poland': [{ titel: 'Weiß, oft doppelte Mittellinie', mitte: { farbe: LW, art: 'doppelt' } }],
  'romania': [{ titel: 'Dicke Mittellinie, Rand aus kurzen Strichen', mitte: { farbe: LW, art: 'dick' }, rand: { farbe: LW, art: 'kurz' } }],
  'slovenia': [{ titel: 'Lang gestrichelte Randlinien', rand: { farbe: LW, art: 'lang' } }],
  'spain': [{ titel: 'Landstraßen: manchmal gestrichelte Randlinien', mitte: { farbe: LW, art: 'strich' }, rand: { farbe: LW, art: 'kurz' } }],
  'sweden': [{ titel: 'Alles weiß, kurze Randstriche mit langen Lücken', mitte: { farbe: LW, art: 'strich' }, rand: { farbe: LW, art: 'kurz' } }],
  'turkey': [
    { titel: 'Meist weiß', mitte: { farbe: LW, art: 'strich' } },
    { titel: 'Nicht selten: gelb', mitte: { farbe: LG, art: 'strich' } },
  ],
  'united-kingdom': [{ titel: 'Lange weiße Mittelstriche mit Katzenaugen', mitte: { farbe: LW, art: 'lang', katzenaugen: true }, rand: { farbe: LW, art: 'durch' } }],
}

/** Merkmal „Linienfarben“ für die Karte (Quelle: Hinweise + Wikipedia „Road surface marking“) */
export const LINIENFARBE = {
  'belgium': 'weiß', 'denmark': 'weiß', 'estonia': 'weiß', 'hungary': 'weiß', 'iceland': 'weiß', 'netherlands': 'weiß',
  'poland': 'weiß', 'sweden': 'weiß', 'united-kingdom': 'weiß',
  'norway': 'gelb-mitte',
  'finland': 'weiß+gelb', 'greece': 'weiß+gelb', 'turkey': 'weiß+gelb', 'switzerland': 'weiß+gelb',
  'ireland': 'gelb-rand', 'jersey': 'gelb-rand',
}

const DASH = { kurz: '7 11', lang: '22 5', weit: '20 22', quadrate: '3.2 2.6', strich: '15 15', lang_m: '30 10', duenn: '15 15' }

/** Ein Stück Landstraße von oben als SVG */
export function linienSvg(l) {
  const L = 24, R = 96, C = 60, H = 160
  const p = [
    `<rect x="0" y="0" width="120" height="${H}" fill="#6f8a4c"/>`,
    `<rect x="${L - 8}" y="0" width="${R - L + 16}" height="${H}" fill="#55585c"/>`,
    `<rect x="${L - 8}" y="0" width="${R - L + 16}" height="${H}" fill="url(#asph)"/>`,
  ]
  const line = (x, farbe, art, w = 2.6) => {
    if (art === 'durch') return `<path d="M${x} 0V${H}" stroke="${farbe}" stroke-width="${w}"/>`
    if (art === 'doppelt') return `<path d="M${x - 2.4} 0V${H}M${x + 2.4} 0V${H}" stroke="${farbe}" stroke-width="2"/>`
    return `<path d="M${x} 0V${H}" stroke="${farbe}" stroke-width="${w}" stroke-dasharray="${DASH[art] ?? '15 15'}"/>`
  }
  if (l.rand) { p.push(line(L, l.rand.farbe, l.rand.art)); p.push(line(R, l.rand.farbe, l.rand.art)) }
  if (l.mitte) {
    const m = l.mitte
    if (m.art === 'doppelt') p.push(`<path d="M${C - 3} 0V${H}M${C + 3} 0V${H}" stroke="${m.farbe}" stroke-width="2.4"/>`)
    else if (m.art === 'durch') p.push(line(C, m.farbe, 'durch', 3))
    else if (m.art === 'durch+strich') p.push(`<path d="M${C - 3} 0V${H}" stroke="${m.farbe}" stroke-width="2.6"/><path d="M${C + 3} 0V${H}" stroke="${m.farbe2 ?? LW}" stroke-width="2.6" stroke-dasharray="15 15"/>`)
    else if (m.art === 'bloecke') {
      for (let y = -6; y < H; y += 36) p.push(`<rect x="${C - 3.4}" y="${y}" width="3.4" height="10" fill="${m.farbe}"/><rect x="${C}" y="${y + 10}" width="3.4" height="10" fill="${m.farbe}"/>`)
    } else p.push(line(C, m.farbe, m.art === 'lang' ? 'lang_m' : m.art === 'dick' ? 'strich' : m.art, m.art === 'dick' ? 5 : m.art === 'duenn' ? 1.4 : 3))
    if (m.katzenaugen) for (let y = 35; y < H; y += 40) p.push(`<circle cx="${C}" cy="${y}" r="1.6" fill="#ffffffcc" stroke="#888" stroke-width="0.5"/>`)
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 ${H}" width="240" height="${H * 2}">` +
    `<defs><linearGradient id="asph" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity="0.18"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.05"/><stop offset="1" stop-color="#000" stop-opacity="0.18"/></linearGradient></defs>` +
    p.join('') + `</svg>`
}
