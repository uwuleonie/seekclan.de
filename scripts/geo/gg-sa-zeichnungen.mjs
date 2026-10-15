// Eigene Zeichnungen für „GeoGuessr Südamerika“ (seekclan.de/geo): Kennzeichen, Taxis, Poller, Kilometersteine,
// Strommasten, Chevrons, Leitplanken, Zäune und Fahrbahn-Linien.
//
// Farben und Formen stammen aus den Hinweisen in scripts/geo/gg-sa/<land>.json – also aus Plonk It
// (plonkit.net, CC BY-NC-SA 4.0). Was dort nicht steht, ist vereinfacht und frei gezeichnet:
//  - Kennzeichen: Buchstaben/Zahlen sind ausgedachte Beispiele im üblichen Format; Schriftart, Maße und Siegel vereinfacht.
//    Mercosur-Kennzeichen (weiß, blauer Balken mit Landesname und Flagge) und die alten Kennzeichen Argentiniens (schwarz)
//    und Brasiliens (grau) nach allgemein bekanntem Aussehen.
//  - Taxis: Seitenansicht eines beliebigen Autos, nur die Farben stimmen.
//  - Masten, Poller, Steine, Zäune: Umriss von vorne, Maße frei gewählt.
// Wird von scripts/geo/build-gg-sa.mjs benutzt (schreibt die SVG-Dateien nach public/geo/gg-sa/<art>/).

import { pollerSvg as pollerSvgEU, linienSvg as linienSvgEU } from './gg-zeichnungen.mjs'

const W = '#f4f2ec', S = '#1c1c1c', ROT = '#d3262c', OR = '#f28a17', GE = '#f2c230', BL = '#2459c2', GN = '#1f7a45'
const GRAU = '#a9a9a9', BETON = '#b9b5ad', HOLZ = '#9b6b3e', DHOLZ = '#6e4a2a'
const FONT = `font-family="Arial Narrow, Arial, Helvetica, sans-serif" font-weight="700"`
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')

/* ═══════════════════════ Kennzeichen ═══════════════════════
 * typ: mercosur | schild
 *  mercosur: land (Name im Balken), flagge (ar|br|uy|py), text
 *  schild:   grund, schrift, rand, text, oben {text, grund?, schrift?}, unten {text, schrift?}, kurz (kurzes Schild)
 */
export const KENNZEICHEN = {
  'argentina': [
    { titel: 'Neu (Mercosur): weiß, blauer Balken oben – Format AB 123 CD', typ: 'mercosur', land: 'ARGENTINA', flagge: 'ar', text: 'AF 381 KD' },
    { titel: 'Alt: schwarz mit weißer Schrift – im Street View ein schwarzer Punkt', typ: 'schild', grund: '#151515', schrift: '#f4f4f4', rand: '#f4f4f4', text: 'KMW 572', oben: { text: 'REPUBLICA ARGENTINA', schrift: '#f4f4f4' } },
  ],
  'brazil': [
    { titel: 'Neu (Mercosur, seit 2018): weiß, blauer Balken oben', typ: 'mercosur', land: 'BRASIL', flagge: 'br', text: 'RTB 4E27' },
    { titel: 'Alt (bis 2018): ganz hell mit Stadt und Bundesstaat oben', typ: 'schild', grund: '#d9dadb', schrift: '#1b1b1b', rand: '#1b1b1b', text: 'FKD-4821', oben: { text: 'SP · CAMPINAS', schrift: '#1b1b1b' } },
    { titel: 'Nutzfahrzeuge: rot', typ: 'schild', grund: '#b91d22', schrift: '#f4f4f4', rand: '#f4f4f4', text: 'GHT-3092', oben: { text: 'MG · BELO HORIZONTE', schrift: '#f4f4f4' } },
  ],
  'uruguay': [
    { titel: 'Mercosur: weiß, blauer Balken oben', typ: 'mercosur', land: 'URUGUAY', flagge: 'uy', text: 'SBN 4517' },
  ],
  'chile': [
    { titel: 'Normale Autos: weiß', typ: 'schild', grund: '#f6f6f2', schrift: '#1b1b1b', rand: '#1b1b1b', text: 'HK·LS·27', unten: { text: 'CHILE' } },
    { titel: 'Taxis und Nutzfahrzeuge: orange', typ: 'schild', grund: '#f08a24', schrift: '#1b1b1b', rand: '#1b1b1b', text: 'DR·TX·41', unten: { text: 'CHILE' } },
  ],
  'colombia': [
    { titel: 'Normale Autos: gelb, Stadt unten', typ: 'schild', grund: '#f3c623', schrift: '#151515', rand: '#151515', text: 'HTR 528', unten: { text: 'BOGOTÁ D.C.' } },
    { titel: 'Taxis (öffentlicher Dienst): weiß', typ: 'schild', grund: '#f6f6f2', schrift: '#151515', rand: '#151515', text: 'WMK 306', unten: { text: 'MEDELLÍN' } },
  ],
  'ecuador': [
    { titel: 'Normale Autos: weiß, lang – erster Buchstabe = Provinz (P = Pichincha)', typ: 'schild', grund: '#f6f6f2', schrift: '#151515', rand: '#151515', text: 'PCB-2815', oben: { text: 'ECUADOR', schrift: '#151515' } },
    { titel: 'Auch kurze weiße Schilder', typ: 'schild', grund: '#f6f6f2', schrift: '#151515', rand: '#151515', text: 'GSL-0472', kurz: true, oben: { text: 'ECUADOR', schrift: '#151515' } },
    { titel: 'Taxis und Busse: oranger Balken oben (ältere ganz orange)', typ: 'schild', grund: '#f6f6f2', schrift: '#151515', rand: '#151515', text: 'ABF-1193', oben: { text: 'ECUADOR', grund: '#f08a24', schrift: '#151515' } },
  ],
  'peru': [
    { titel: 'Meist weiß', typ: 'schild', grund: '#f6f6f2', schrift: '#151515', rand: '#151515', text: 'BKF-617', oben: { text: 'PERÚ', grund: '#3d74d0', schrift: '#ffffff' } },
    { titel: 'Seltener gelb', typ: 'schild', grund: '#f3c623', schrift: '#151515', rand: '#151515', text: 'C4T-208', oben: { text: 'PERÚ', grund: '#3d74d0', schrift: '#ffffff' } },
    { titel: 'Taxis: oben gelb, unten weiß', typ: 'schild', grund: '#f6f6f2', schrift: '#151515', rand: '#151515', text: 'T3L-841', oben: { text: 'PERÚ', grund: '#f3c623', schrift: '#151515' } },
  ],
  'bolivia': [
    { titel: 'Kurz und weiß mit blauer Schrift – wirkt verschwommen ganz weiß', typ: 'schild', grund: '#f6f6f2', schrift: '#1f4fa8', rand: '#1f4fa8', text: '3417 KLD', kurz: true, oben: { text: 'BOLIVIA', schrift: '#1f4fa8' } },
  ],
}

function flaggeSvg(code, x, y, w, h) {
  const r = (fx, fy, fw, fh, c) => `<rect x="${x + fx * w}" y="${y + fy * h}" width="${fw * w}" height="${fh * h}" fill="${c}"/>`
  switch (code) {
    case 'ar': return r(0, 0, 1, 1, '#74acdf') + r(0, 1 / 3, 1, 1 / 3, '#fff') + `<circle cx="${x + w / 2}" cy="${y + h / 2}" r="${h * 0.11}" fill="#f6b40e"/>`
    case 'br': return r(0, 0, 1, 1, '#009b3a') + `<polygon points="${x + w * 0.08},${y + h / 2} ${x + w / 2},${y + h * 0.1} ${x + w * 0.92},${y + h / 2} ${x + w / 2},${y + h * 0.9}" fill="#fedf00"/><circle cx="${x + w / 2}" cy="${y + h / 2}" r="${h * 0.22}" fill="#002776"/>`
    case 'uy': return r(0, 0, 1, 1, '#fff') + [1, 3, 5, 7].map(i => r(0, i / 9, 1, 1 / 9, '#0038a8')).join('') + r(0, 0, 0.4, 5 / 9, '#fff') + `<circle cx="${x + w * 0.2}" cy="${y + h * 0.27}" r="${h * 0.15}" fill="#fcd116"/>`
    case 'py': return r(0, 0, 1, 1 / 3, '#d52b1e') + r(0, 1 / 3, 1, 1 / 3, '#fff') + r(0, 2 / 3, 1, 1 / 3, '#0038a8')
    default: return ''
  }
}

export function kennzeichenSvg(k) {
  const w = k.kurz ? 330 : 520, h = 170
  const parts = []
  if (k.typ === 'mercosur') {
    parts.push(`<rect x="3" y="3" width="${w - 6}" height="${h - 6}" rx="14" fill="#f8f8f6" stroke="#1b1b1b" stroke-width="4"/>`)
    parts.push(`<path d="M5 17Q5 5 17 5H${w - 17}Q${w - 5} 5 ${w - 5} 17V44H5Z" fill="#1f4fa8"/>`)
    parts.push(`<text x="18" y="33" ${FONT} font-size="15" fill="#fff" letter-spacing="0.5">MERCOSUR</text>`)
    parts.push(`<text x="${w / 2}" y="35" text-anchor="middle" ${FONT} font-size="25" fill="#fff" letter-spacing="2">${esc(k.land)}</text>`)
    parts.push(flaggeSvg(k.flagge, w - 62, 13, 42, 26))
    parts.push(`<text x="${w / 2}" y="138" text-anchor="middle" ${FONT} font-size="92" fill="#111" letter-spacing="4" textLength="${w - 70}" lengthAdjust="spacingAndGlyphs">${esc(k.text)}</text>`)
  } else {
    parts.push(`<rect x="3" y="3" width="${w - 6}" height="${h - 6}" rx="10" fill="${k.grund}"/>`)
    parts.push(`<rect x="11" y="11" width="${w - 22}" height="${h - 22}" rx="7" fill="none" stroke="${k.rand}" stroke-width="4"/>`)
    let ty = 120
    if (k.oben) {
      if (k.oben.grund) parts.push(`<path d="M13 21Q13 13 21 13H${w - 21}Q${w - 13} 13 ${w - 13} 21V46H13Z" fill="${k.oben.grund}"/>`)
      parts.push(`<text x="${w / 2}" y="39" text-anchor="middle" ${FONT} font-size="21" fill="${k.oben.schrift ?? k.schrift}" letter-spacing="2">${esc(k.oben.text)}</text>`)
      ty = 132
    }
    if (k.unten) {
      parts.push(`<text x="${w / 2}" y="${h - 22}" text-anchor="middle" ${FONT} font-size="20" fill="${k.unten.schrift ?? k.schrift}" letter-spacing="2">${esc(k.unten.text)}</text>`)
      ty = 114
    }
    parts.push(`<text x="${w / 2}" y="${ty}" text-anchor="middle" ${FONT} font-size="${k.kurz ? 70 : 84}" fill="${k.schrift}" letter-spacing="3" textLength="${w - 64}" lengthAdjust="spacingAndGlyphs">${esc(k.text)}</text>`)
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${parts.join('')}</svg>`
}

/* ═══════════════════════ Taxis (Seitenansicht) ═══════════════════════
 * body (Grundfarbe), roof (Dach), lower (untere Hälfte), stripe (Streifen auf Türhöhe), stripe2 (zweiter Streifen), checker (karierter Streifen),
 * sign (Taxi-Schild auf dem Dach, Standard ja), seiten (Aufkleber-Streifen rot-weiß, Peru)
 */
export function taxiSvg(t) {
  const body = t.body, dark = ['#1e1e1e', '#c8202a', '#2f9b5f'].includes(body)
  const out = dark ? '#000' : '#4a4a4a'
  const clip = 'tc'
  const shape = 'M18 108 C16 92 22 84 40 80 L78 74 L108 44 C112 40 118 38 126 38 L206 38 C216 38 222 42 228 48 L256 74 L286 80 C298 82 304 90 304 100 L304 110 C304 116 300 118 294 118 L18 118 Z'
  const parts = []
  if (t.roof) parts.push(`<rect x="0" y="0" width="320" height="50" fill="${t.roof}"/>`)
  if (t.lower) parts.push(`<rect x="0" y="92" width="320" height="40" fill="${t.lower}"/>`)
  if (t.stripe) {
    if (t.checker) {
      for (let x = 20, i = 0; x < 304; x += 9, i++) parts.push(`<rect x="${x}" y="88" width="9" height="7" fill="${i % 2 ? '#1e1e1e' : t.stripe}"/><rect x="${x}" y="95" width="9" height="7" fill="${i % 2 ? t.stripe : '#1e1e1e'}"/>`)
    } else {
      parts.push(`<rect x="0" y="88" width="320" height="${t.stripe2 ? 7 : 12}" fill="${t.stripe}"/>`)
      if (t.stripe2) parts.push(`<rect x="0" y="95" width="320" height="7" fill="${t.stripe2}"/>`)
    }
  }
  if (t.seiten) for (let x = 60, i = 0; x < 290; x += 14, i++) parts.push(`<rect x="${x}" y="86" width="14" height="14" fill="${i % 2 ? '#d3262c' : '#ffffff'}"/>`)
  const sign = t.sign === false ? '' :
    `<rect x="146" y="24" width="44" height="15" rx="3" fill="${t.signFarbe ?? '#fff6c2'}" stroke="${out}" stroke-width="1.5"/><text x="168" y="35.5" text-anchor="middle" ${FONT} font-size="10.5" fill="#1c1c1c">TAXI</text>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 150" width="320" height="150">` +
    `<defs><clipPath id="${clip}"><path d="${shape}"/></clipPath><linearGradient id="${clip}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></linearGradient></defs>` +
    `<ellipse cx="162" cy="132" rx="150" ry="7" fill="#00000030"/>` + sign +
    `<path d="${shape}" fill="${body}"/>` +
    `<g clip-path="url(#${clip})">${parts.join('')}<rect x="0" y="0" width="320" height="150" fill="url(#${clip}g)"/></g>` +
    `<path d="${shape}" fill="none" stroke="${out}" stroke-width="2"/>` +
    // Fenster
    `<path d="M88 74 L113 48 C116 45 119 44 124 44 L160 44 L160 74 Z" fill="#9fc3d8" stroke="${out}" stroke-width="1.5"/>` +
    `<path d="M166 44 L204 44 C211 44 215 46 220 51 L243 74 L166 74 Z" fill="#9fc3d8" stroke="${out}" stroke-width="1.5"/>` +
    `<path d="M163 74V112M100 82h12M180 82h12" stroke="${out}" stroke-width="1.5"/>` +
    `<rect x="290" y="88" width="12" height="7" rx="2" fill="#ffe9a3"/><rect x="18" y="88" width="9" height="8" rx="2" fill="#d3262c"/>` +
    // Räder
    `<circle cx="78" cy="118" r="20" fill="#1c1c1c"/><circle cx="78" cy="118" r="9" fill="#bdbdbd"/>` +
    `<circle cx="246" cy="118" r="20" fill="#1c1c1c"/><circle cx="246" cy="118" r="9" fill="#bdbdbd"/>` +
    `</svg>`
}

/** Mototaxi (Peru): dreirädriges Tuk-Tuk von der Seite */
export function mototaxiSvg(farbe = '#d3262c', offen = false) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 150" width="320" height="150">` +
    `<ellipse cx="160" cy="134" rx="130" ry="6" fill="#00000030"/>` +
    `<path d="M120 36 H262 Q272 36 272 46 V60 H120 Z" fill="${farbe}" stroke="#000" stroke-width="2"/>` +
    (offen ? '' : `<path d="M200 60 H268 V112 H200 Z" fill="${farbe}" stroke="#000" stroke-width="2"/><rect x="210" y="66" width="48" height="24" rx="3" fill="#9fc3d8" stroke="#000" stroke-width="1.5"/>`) +
    `<path d="M128 60 V100 M198 60 V112" stroke="#333" stroke-width="5"/>` +
    `<path d="M150 98 H262 V112 H150 Z" fill="#333"/><rect x="200" y="82" width="58" height="18" rx="4" fill="#7a4b2a"/>` +
    `<path d="M128 100 L88 104 L60 96 L70 88 L98 92 Z" fill="${farbe}" stroke="#000" stroke-width="2"/>` +
    `<path d="M70 88 L78 60 L92 58" stroke="#222" stroke-width="5" fill="none"/>` +
    `<circle cx="64" cy="116" r="17" fill="#1c1c1c"/><circle cx="64" cy="116" r="7" fill="#bdbdbd"/>` +
    `<circle cx="232" cy="118" r="17" fill="#1c1c1c"/><circle cx="232" cy="118" r="7" fill="#bdbdbd"/></svg>`
}

/** Taxis anderer Länder (Plonk It; Santiago, Rio, São Paulo: allgemein bekannt) */
export const TAXIS = {
  'colombia': [{ titel: 'Pastellgelb, weißes Kennzeichen', auto: { body: '#f5df7a' } }],
  'ecuador': [{ titel: 'Kräftig gelb, oranges Kennzeichen, großer Provinz-Buchstabe an der Tür', auto: { body: '#f2c200' } }],
  'peru': [
    { titel: 'Breite rot-weiße Aufkleber an der Seite', auto: { body: '#f2f2ee', seiten: true } },
    { titel: 'Mototaxi (Tuk-Tuk) – in Lima, Trujillo, Chiclayo, Piura, Iquitos', moto: { farbe: '#d3262c' } },
    { titel: 'Mototaxi mit offenem Vorderteil – vor allem im Norden und Amazonasgebiet', moto: { farbe: '#2f6fd0', offen: true } },
  ],
  'chile': [{ titel: 'Santiago: schwarz mit gelbem Dach', auto: { body: '#1e1e1e', roof: '#f2c230' } }],
  'brazil': [
    { titel: 'Rio de Janeiro: gelb mit blauem Streifen', auto: { body: '#f2c230', stripe: '#2459c2' } },
    { titel: 'São Paulo: weiß', auto: { body: '#f2f2ee' } },
  ],
}

/* ═══════════════════════ Poller (Zeichner aus GeoGuessr Europa) ═══════════════════════ */

export const POLLER = {
  'chile': [
    { titel: 'Wie in Spanien: vorne weißer Reflektor (hinten gelb-orange) – eher selten', form: 'keil', koerper: W, band: { farbe: S, von: 36, bis: 60 }, refl: { farbe: W, form: 'rechteck', y: 48 } },
    { titel: 'Oranger Behelfs-Poller mit zwei weißen Streifen oben', form: 'rund', koerper: OR, streifen: [{ farbe: W, von: 32, bis: 40 }, { farbe: W, von: 48, bis: 56 }] },
  ],
  'ecuador': [
    { titel: 'Rund mit zwei roten Ringen – Poller sind hier sehr häufig', form: 'rund', koerper: W, streifen: [{ farbe: ROT, von: 36, bis: 44 }, { farbe: ROT, von: 52, bis: 60 }] },
    { titel: 'Flach, schwarzes Feld mit zwei roten Reflektoren', form: 'flach', koerper: W, band: { farbe: S, von: 34, bis: 72 }, refl: { farbe: ROT, form: 'zwei', y: 53 } },
  ],
  'peru': [
    { titel: 'Dreieckiger Betonpoller, rot oder gelb bemalt', form: 'stein', koerper: '#e2b51e', streifen: [{ farbe: '#c4201f', von: 100, bis: 120 }] },
    { titel: 'Moquegua: weißer Zylinder mit schwarz-gelbem Ring oben', form: 'rund', koerper: W, streifen: [{ farbe: S, von: 28, bis: 36 }, { farbe: GE, von: 36, bis: 44 }, { farbe: S, von: 44, bis: 52 }] },
  ],
  'uruguay': [
    { titel: 'Weiß, eine Seite gelb gestrichen – nur hier', form: 'keil', koerper: W, seite: GE },
  ],
  'bolivia': [
    { titel: 'Klobiger weißer Vierkant-Pfosten', form: 'flach', koerper: '#ecebe6' },
  ],
}
/** Wie in Europa, zusätzlich „seite“: eine Seitenfläche farbig (Uruguay) */
export function pollerSvg(p, id) {
  const svg = pollerSvgEU(p, id)
  if (!p.seite) return svg
  return svg.replace(/(<g clip-path="url\(#[^)]+\)">)/, `$1<rect x="52" y="0" width="30" height="150" fill="${p.seite}"/>`)
}

/* ═══════════════════════ Kilometersteine ═══════════════════════ */

export const KM = {
  'argentina': [{ titel: 'Weiß, oben schwarzer Streifen mit Straßennummer (RN = Nationalstraße)', art: 'stein', oben: S, obenText: 'RN 40', obenSchrift: W, grund: W, text: '1873', schrift: S }],
  'bolivia': [{ titel: 'Oben schwarz mit „Km“, unten weiß – ohne Straßennummer', art: 'stein', oben: S, obenText: 'Km', obenSchrift: W, grund: W, text: '214', schrift: S }],
  'brazil': [{ titel: 'Blaue Tafel mit Straßennummer und Kilometer', art: 'tafel', grund: '#1f4fa8', zeilen: ['BR', '116', 'KM', '342'], schrift: W }],
  'colombia': [
    { titel: 'Hoher grüner Marker mit „Pr“ oben', art: 'hoch', grund: '#1d7a4a', zeilen: ['Pr', '45', '9007'], schrift: W },
    { titel: 'Klassischer Stein mit schwarzer Schrift', art: 'stein', grund: W, text: '32', schrift: S },
  ],
  'ecuador': [{ titel: 'Grün mit kleinem Straßen-Wappen und Kilometer', art: 'tafel', grund: '#1d7a4a', wappen: true, zeilen: ['E35', 'KM', '87'], schrift: W }],
  'peru': [{ titel: 'Beton, schwarz-weiß bemalt', art: 'stein', oben: S, obenText: 'PE-1N', obenSchrift: W, grund: W, text: '645', schrift: S }],
  'uruguay': [{ titel: 'Kleiner, grün gestrichener Stein', art: 'stein', grund: '#2f8f4f', text: '118', schrift: W, klein: true }],
}

export function kmSvg(k) {
  const p = []
  if (k.art === 'stein') {
    const top = k.klein ? 70 : 44
    const d = `M28 140V${top + 14}Q28 ${top} 42 ${top}H78Q92 ${top} 92 ${top + 14}V140Z`
    p.push(`<clipPath id="kc"><path d="${d}"/></clipPath><path d="${d}" fill="${k.grund}"/>`)
    if (k.oben) p.push(`<g clip-path="url(#kc)"><rect x="0" y="0" width="120" height="${top + 30}" fill="${k.oben}"/></g><text x="60" y="${top + 21}" text-anchor="middle" ${FONT} font-size="${k.obenText.length > 3 ? 15 : 18}" fill="${k.obenSchrift}">${esc(k.obenText)}</text>`)
    p.push(`<text x="60" y="${k.oben ? top + 58 : top + 40}" text-anchor="middle" ${FONT} font-size="22" fill="${k.schrift}">${esc(k.text)}</text>`)
    p.push(`<path d="${d}" fill="none" stroke="#00000066" stroke-width="1.5"/>`)
  } else if (k.art === 'tafel') {
    p.push(`<rect x="56" y="70" width="8" height="72" fill="#8a8a8a"/><rect x="28" y="16" width="64" height="${k.zeilen.length * 22 + (k.wappen ? 40 : 16)}" rx="5" fill="${k.grund}" stroke="#fff" stroke-width="2.5"/>`)
    let y = 40
    if (k.wappen) { p.push(`<path d="M48 22H72V34Q72 42 60 46Q48 42 48 34Z" fill="#fff"/><text x="60" y="38" text-anchor="middle" ${FONT} font-size="9" fill="${k.grund}">E</text>`); y = 66 }
    for (const z of k.zeilen) { p.push(`<text x="60" y="${y}" text-anchor="middle" ${FONT} font-size="${/^\d+$/.test(z) ? 20 : 14}" fill="${k.schrift}">${esc(z)}</text>`); y += 22 }
  } else {
    p.push(`<rect x="38" y="14" width="44" height="128" rx="4" fill="${k.grund}" stroke="#00000055" stroke-width="1.5"/>`)
    let y = 42
    for (const z of k.zeilen) { p.push(`<text x="60" y="${y}" text-anchor="middle" ${FONT} font-size="${z === 'Pr' ? 22 : 14}" fill="${k.schrift}">${esc(z)}</text>`); y += 26 }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 150" width="240" height="300"><ellipse cx="60" cy="141" rx="40" ry="4" fill="#00000035"/>${p.join('')}</svg>`
}

/* ═══════════════════════ Strommasten ═══════════════════════
 * art: rund | leiter | kerbe | achteck | holz | krumm | a-rahmen | doppel
 * kopf: quer | asym | dreizack | wechsel | keiner   streifen: [{farbe, von, bis}] (y von oben, Mast 30…290)
 */
export const MASTEN = {
  'argentina': [
    { titel: 'Runder Betonmast, drei Leitungen abwechselnd links/rechts', art: 'rund', kopf: 'wechsel' },
    { titel: 'Holzmast in A-Form – in Südamerika nur hier', art: 'a-rahmen', kopf: 'quer' },
    { titel: 'Doppelte Betonmasten', art: 'doppel', kopf: 'quer' },
  ],
  'brazil': [
    { titel: '„Leiter“-Mast: unten lange Aussparungen, oben kleine Löcher', art: 'leiter', kopf: 'asym' },
    { titel: 'Florianópolis: weiß mit blauen und roten Streifen', art: 'rund', kopf: 'quer', farbe: '#efefea', streifen: [{ farbe: BL, von: 200, bis: 212 }, { farbe: ROT, von: 212, bis: 224 }] },
    { titel: 'Bahia, Pernambuco, Goiás: lange gelbe Mast-ID', art: 'leiter', kopf: 'quer', schild: { farbe: GE, von: 150, bis: 200, text: 'B 4127' } },
  ],
  'chile': [
    { titel: 'Eckiger Betonmast mit Einbuchtung, oben kleine Löcher', art: 'kerbe', kopf: 'quer' },
    { titel: 'Arica: weiß bemalt mit schwarzer Nummer', art: 'kerbe', kopf: 'quer', farbe: '#f2f2ee', schild: { farbe: '#f2f2ee', von: 170, bis: 200, text: '0582', schrift: S } },
  ],
  'colombia': [
    { titel: 'Schwarz-gelb gestreift', art: 'rund', kopf: 'quer', farbe: '#77746e', streifen: [170, 182, 194, 206, 218].map((v, i) => ({ farbe: i % 2 ? S : GE, von: v, bis: v + 12 })) },
    { titel: 'Antioquia: kurz schwarz, lang gelb, kurz schwarz', art: 'rund', kopf: 'quer', farbe: '#8d8a83', streifen: [{ farbe: S, von: 160, bis: 170 }, { farbe: GE, von: 170, bis: 214 }, { farbe: S, von: 214, bis: 224 }] },
    { titel: 'Achteckiger Betonmast (sonst nur Mexiko und Ecuador)', art: 'achteck', kopf: 'quer' },
  ],
  'ecuador': [{ titel: 'Leitermast mit sehr vielen kleinen Kerben', art: 'sprossen', kopf: 'quer' }],
  'peru': [{ titel: 'Unten schwarz-gelb bemalt', art: 'rund', kopf: 'quer', streifen: [230, 242, 254, 266, 278].map((v, i) => ({ farbe: i % 2 ? GE : S, von: v, bis: v + 12 })) }],
  'uruguay': [{ titel: '„Dreizack“: drei Isolatoren zeigen nach oben', art: 'rund', kopf: 'dreizack' }],
  'bolivia': [{ titel: 'Sehr krummer Holzmast – wie ein Baumstamm', art: 'krumm', kopf: 'quer' }],
}

export function mastSvg(m) {
  const farbe = m.farbe ?? (['holz', 'krumm', 'a-rahmen'].includes(m.art) ? HOLZ : BETON)
  const p = []
  const isol = (x, y) => `<rect x="${x - 2.5}" y="${y - 9}" width="5" height="9" rx="1.5" fill="#6b8a6a"/><ellipse cx="${x}" cy="${y - 9}" rx="4" ry="2" fill="#7fa37e"/>`
  // Mast
  let body
  switch (m.art) {
    case 'leiter': body = `<path d="M50 290V40H70V290Z" fill="${farbe}"/>` + [150, 190, 230, 262].map(y => `<rect x="55" y="${y}" width="10" height="30" rx="2" fill="#5f6b5e"/>`).join('') + [60, 80, 100, 120].map(y => `<circle cx="60" cy="${y}" r="2.2" fill="#55606b"/>`).join(''); break
    case 'kerbe': body = `<path d="M49 290V36H71V290Z" fill="${farbe}"/><rect x="57" y="80" width="6" height="205" fill="#8d897f"/>` + [130, 210].map(y => `<rect x="54" y="${y}" width="12" height="4" fill="${farbe}"/>`).join('') + [44, 54, 64].map(y => `<circle cx="60" cy="${y}" r="1.8" fill="#55606b"/>`).join(''); break
    case 'sprossen': body = `<path d="M50 290V40H70V290Z" fill="${farbe}"/>` + Array.from({ length: 24 }, (_, i) => `<rect x="55" y="${70 + i * 9}" width="10" height="4" rx="1" fill="#7b776f"/>`).join(''); break
    case 'achteck': body = `<path d="M50 290L52 40H68L70 290Z" fill="${farbe}"/><path d="M56 290L57 40M64 290L63 40" stroke="#00000030" stroke-width="2"/>`; break
    case 'holz': body = `<path d="M52 290L54 36H66L68 290Z" fill="${farbe}"/>`; break
    case 'krumm': body = `<path d="M52 290C46 240 64 210 56 170C50 130 64 100 58 36H66C70 100 58 130 64 170C72 210 56 240 66 290Z" fill="${farbe}"/><path d="M58 280C54 240 66 210 60 170" stroke="${DHOLZ}" stroke-width="1.5" fill="none"/>`; break
    case 'a-rahmen': body = `<path d="M30 290L56 40H64L44 290Z" fill="${farbe}"/><path d="M90 290L64 40H56L76 290Z" fill="${farbe}"/><path d="M44 200H76" stroke="${DHOLZ}" stroke-width="5"/>`; break
    case 'doppel': body = `<path d="M38 290L40 40H52L54 290Z" fill="${farbe}"/><path d="M66 290L68 40H80L82 290Z" fill="${farbe}"/>`; break
    default: body = `<path d="M51 290L54 36H66L69 290Z" fill="${farbe}"/>`
  }
  p.push(body)
  // Streifen / Schild
  const clipBody = m.art === 'doppel' ? '' : `<clipPath id="mc"><path d="M48 290L50 30H70L72 290Z"/></clipPath>`
  for (const s of m.streifen ?? []) p.push(`<rect x="48" y="${s.von}" width="24" height="${s.bis - s.von}" fill="${s.farbe}" clip-path="url(#mc)"/>`)
  if (m.schild) p.push(`<rect x="52" y="${m.schild.von}" width="16" height="${m.schild.bis - m.schild.von}" fill="${m.schild.farbe}"/><text transform="translate(63 ${(m.schild.von + m.schild.bis) / 2}) rotate(-90)" text-anchor="middle" ${FONT} font-size="8" fill="${m.schild.schrift ?? S}">${esc(m.schild.text)}</text>`)
  // Kopf
  const cx = m.art === 'doppel' ? 60 : 60
  switch (m.kopf) {
    case 'quer': p.push(`<rect x="20" y="52" width="80" height="7" fill="${m.art.match(/holz|krumm|a-rahmen/) ? DHOLZ : '#8a8780'}"/>` + isol(26, 52) + isol(60, 52) + isol(94, 52)); break
    case 'asym': p.push(`<rect x="38" y="52" width="74" height="7" fill="#8a8780"/><path d="M62 90L100 59" stroke="#77736b" stroke-width="3.5"/>` + isol(44, 52) + isol(78, 52) + isol(106, 52)); break
    case 'dreizack': p.push(`<path d="M42 36V56H78V36" stroke="#6f6c66" stroke-width="5" fill="none"/>` + isol(42, 36) + isol(60, 30) + isol(78, 36)); break
    case 'wechsel': p.push(`<rect x="66" y="56" width="16" height="4" fill="#77736b"/><rect x="38" y="80" width="16" height="4" fill="#77736b"/><rect x="66" y="104" width="16" height="4" fill="#77736b"/>` + isol(80, 56) + isol(40, 80) + isol(80, 104)); break
    default: break
  }
  // Leitungen
  const wires = m.kopf === 'wechsel' ? [50, 74, 98] : m.kopf === 'dreizack' ? [24, 28, 24] : [46, 46, 46]
  const xs = m.kopf === 'wechsel' ? [80, 40, 80] : m.kopf === 'dreizack' ? [42, 60, 78] : m.kopf === 'asym' ? [44, 78, 106] : [26, 60, 94]
  p.push(xs.map((x, i) => `<path d="M0 ${wires[i] + 6}Q${x} ${wires[i] + 2} 120 ${wires[i] + 8}" stroke="#2a2a2a" stroke-width="1.2" fill="none" opacity=".75"/>`).join(''))
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 300" width="200" height="500"><defs>${clipBody}</defs><ellipse cx="60" cy="291" rx="36" ry="4" fill="#00000030"/>${p.join('')}</svg>`
}

/* ═══════════════════════ Chevrons & Leitplanken ═══════════════════════ */

export const SCHILDER = {
  'argentina': [
    { titel: 'Chevron: weiß mit roten Pfeilen – in ganz Amerika nur hier', art: 'chevron', grund: '#f6f6f2', pfeil: '#d3262c' },
    { titel: 'Leitplanke mit gelben und roten Reflektoren', art: 'leitplanke', refl: [GE, ROT] },
  ],
  'chile': [{ titel: 'Chevron: gelb mit schwarzen Pfeilen', art: 'chevron', grund: '#f2c230', pfeil: S }, { titel: 'Brücken: rot gestrichene Geländerpfosten', art: 'bruecke' }],
  'uruguay': [{ titel: 'Chevron: gelb mit schwarzen Pfeilen (wie fast überall in Lateinamerika)', art: 'chevron', grund: '#f2c230', pfeil: S }, { titel: 'Leitplanke mit gelbem/rotem Reflektor wie in Argentinien', art: 'leitplanke', refl: [GE, ROT] }],
  'brazil': [{ titel: 'Chevron: schwarz mit gelbem Pfeil', art: 'chevron', grund: S, pfeil: '#f2c230', einzeln: true }, { titel: 'Schilder-Rückseiten schwarz', art: 'rueckseite', farbe: '#161616' }],
  'colombia': [{ titel: 'Weißer Metallpfosten bildet hinten ein Kreuz', art: 'rueckseite', farbe: '#8b8f93', kreuz: true }],
  'ecuador': [
    { titel: 'Türkisblaue Schild-Rückseite auf dünnem Pfosten', art: 'rueckseite', farbe: '#2bb3b1', rund: true },
    { titel: 'Doppelte Leitplanke', art: 'leitplanke', doppelt: true },
  ],
  'peru': [
    { titel: 'Schwarz-weiß gestreifter Schildpfosten – nur hier', art: 'pfosten', farben: [S, W] },
    { titel: 'Leitplanke: schräge Streifen, außen SCHWARZ', art: 'leitplankenende', aussen: S },
  ],
  'bolivia': [{ titel: 'Leitplanke: schräge Streifen, außen GELB', art: 'leitplankenende', aussen: GE }],
}

export function schildSvg(s) {
  const p = []
  if (s.art === 'chevron') {
    p.push(`<rect x="58" y="70" width="6" height="80" fill="#8a8a8a"/><rect x="25" y="14" width="72" height="88" rx="3" fill="${s.grund}" stroke="#555" stroke-width="1.5"/>`)
    const pts = s.einzeln ? [[52]] : [[38], [62]]
    for (const [x] of pts) p.push(`<path d="M${x} 28L${x + 20} 58L${x} 88" stroke="${s.pfeil}" stroke-width="10" fill="none" stroke-linejoin="miter"/>`)
  } else if (s.art === 'leitplanke') {
    for (const y of s.doppelt ? [40, 82] : [60]) p.push(`<path d="M0 ${y}H120V${y + 26}H0Z" fill="#c3c6c9"/><path d="M0 ${y + 9}H120M0 ${y + 17}H120" stroke="#8d9196" stroke-width="2"/>`)
    p.push([20, 100].map(x => `<rect x="${x - 4}" y="${s.doppelt ? 40 : 60}" width="8" height="${s.doppelt ? 110 : 90}" fill="#9a9da1"/>`).join(''))
    if (s.refl) p.push(`<rect x="52" y="66" width="10" height="14" fill="${s.refl[0]}"/><rect x="66" y="66" width="10" height="14" fill="${s.refl[1]}"/>`)
  } else if (s.art === 'leitplankenende') {
    p.push(`<defs><clipPath id="lc"><path d="M8 50H112V96H8Z"/></clipPath></defs>`)
    const farben = s.aussen === S ? [S, GE] : [GE, S]
    p.push(`<g clip-path="url(#lc)">${Array.from({ length: 12 }, (_, i) => `<path d="M${-30 + i * 14} 96L${-10 + i * 14} 50H${4 + i * 14}L${-16 + i * 14} 96Z" fill="${farben[i % 2]}"/>`).join('')}</g>`)
    p.push(`<path d="M8 50H112V96H8Z" fill="none" stroke="#555" stroke-width="1.5"/><rect x="20" y="96" width="8" height="54" fill="#9a9da1"/><rect x="92" y="96" width="8" height="54" fill="#9a9da1"/>`)
    p.push(`<path d="M8 50V96" stroke="${s.aussen}" stroke-width="8"/><path d="M112 50V96" stroke="${s.aussen}" stroke-width="8"/>`)
  } else if (s.art === 'rueckseite') {
    p.push(`<rect x="57" y="40" width="6" height="110" fill="${s.kreuz ? '#f2f2f2' : '#9a9a9a'}"/>`)
    p.push(s.rund ? `<circle cx="60" cy="50" r="36" fill="${s.farbe}" stroke="#555" stroke-width="1.5"/>` : `<path d="M60 12L100 82H20Z" fill="${s.farbe}" stroke="#555" stroke-width="1.5"/>`)
    if (s.kreuz) p.push(`<rect x="57" y="20" width="6" height="64" fill="#f2f2f2"/><rect x="30" y="58" width="60" height="6" fill="#f2f2f2"/>`)
  } else if (s.art === 'pfosten') {
    p.push(`<circle cx="60" cy="38" r="28" fill="#fff" stroke="#d3262c" stroke-width="7"/><text x="60" y="46" text-anchor="middle" ${FONT} font-size="22" fill="#111">40</text>`)
    for (let y = 66, i = 0; y < 150; y += 12, i++) p.push(`<rect x="56" y="${y}" width="8" height="12" fill="${s.farben[i % 2]}"/>`)
  } else if (s.art === 'bruecke') {
    p.push(`<rect x="0" y="92" width="120" height="14" fill="#9a958c"/><path d="M0 62H120" stroke="#8b8b8b" stroke-width="5"/><path d="M0 76H120" stroke="#8b8b8b" stroke-width="3"/>`)
    for (const x of [10, 40, 70, 100]) p.push(`<rect x="${x}" y="56" width="9" height="38" fill="#c8202a"/>`)
    p.push(`<path d="M0 106H120V150H0Z" fill="#6c8db0"/>`)
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 150" width="240" height="300">${p.join('')}</svg>`
}

/* ═══════════════════════ Zäune, Mauern, Tore ═══════════════════════ */

export const ZAEUNE = {
  'colombia': [
    { titel: 'Einfacher Holzzaun mit Stacheldraht – sehr häufig', art: 'holz' },
    { titel: 'Bemalte, oben spitze Zaunpfähle – fast nur hier', art: 'spitz' },
  ],
  'chile': [
    { titel: 'San Pedro de Atacama: Lehmziegelmauer mit Dreiecken oben', art: 'lehm' },
    { titel: 'Villa O’Higgins: alles aus orange gebeiztem Holz', art: 'latten', farbe: '#d9772b' },
  ],
  'bolivia': [{ titel: 'El Alto: Metalltor mit Farbverlauf (dunkel- zu hellgrün)', art: 'tor', von: '#14532d', bis: '#86efac' }],
  'brazil': [{ titel: 'Süden: Lehmnest des Töpfervogels oben auf dem Mast', art: 'nest' }],
}

export function zaunSvg(z) {
  const p = [`<rect x="0" y="0" width="240" height="150" fill="#cfe3ef"/><rect x="0" y="118" width="240" height="32" fill="#7d9a52"/>`]
  if (z.art === 'holz') {
    for (let x = 14; x < 240; x += 52) p.push(`<path d="M${x} 132L${x + 2} 48L${x + 10} 46L${x + 12} 132Z" fill="${HOLZ}"/><path d="M${x + 3} 60L${x + 9} 58" stroke="${DHOLZ}" stroke-width="1"/>`)
    for (const y of [62, 82, 102]) p.push(`<path d="M0 ${y}Q120 ${y + 5} 240 ${y}" stroke="#555" stroke-width="1.4" fill="none" stroke-dasharray="6 2 1 2"/>`)
  } else if (z.art === 'spitz') {
    const farben = ['#f2f2ee', '#2f9b5f', '#f2f2ee', '#c8202a', '#f2f2ee', '#2459c2']
    for (let x = 6, i = 0; x < 240; x += 20, i++) p.push(`<path d="M${x} 132V58L${x + 6} 44L${x + 12} 58V132Z" fill="${farben[i % farben.length]}" stroke="#555" stroke-width="1"/>`)
    p.push(`<rect x="0" y="76" width="240" height="6" fill="${DHOLZ}"/><rect x="0" y="106" width="240" height="6" fill="${DHOLZ}"/>`)
  } else if (z.art === 'lehm') {
    p.push(`<rect x="0" y="66" width="240" height="60" fill="#b07a4a"/>`)
    for (let y = 70; y < 126; y += 11) for (let x = (y / 11) % 2 ? 0 : 14; x < 240; x += 28) p.push(`<rect x="${x}" y="${y}" width="26" height="9" fill="#a26c3d" opacity=".55"/>`)
    for (let x = 0; x < 240; x += 24) p.push(`<path d="M${x} 66L${x + 12} 48L${x + 24} 66Z" fill="#b07a4a"/>`)
  } else if (z.art === 'latten') {
    for (let x = 4; x < 240; x += 14) p.push(`<rect x="${x}" y="60" width="10" height="68" rx="1" fill="${z.farbe}" stroke="#8a4a18" stroke-width="1"/>`)
    p.push(`<rect x="0" y="72" width="240" height="7" fill="#b85f1f"/><rect x="0" y="108" width="240" height="7" fill="#b85f1f"/>`)
  } else if (z.art === 'tor') {
    p.push(`<rect x="0" y="40" width="40" height="90" fill="#d9c9a8"/><rect x="200" y="40" width="40" height="90" fill="#d9c9a8"/>`)
    p.push(`<defs><linearGradient id="tg" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${z.von}"/><stop offset="1" stop-color="${z.bis}"/></linearGradient></defs><rect x="40" y="34" width="160" height="96" fill="url(#tg)" stroke="#333" stroke-width="2"/><path d="M120 34V130" stroke="#333" stroke-width="2"/>`)
    for (let y = 46; y < 130; y += 14) p.push(`<path d="M44 ${y}H196" stroke="#00000030" stroke-width="2"/>`)
  } else if (z.art === 'nest') {
    p.push(`<rect x="112" y="20" width="16" height="110" fill="${BETON}"/><rect x="74" y="34" width="92" height="7" fill="#8a8780"/><path d="M60 40Q120 44 240 38M0 42Q60 44 120 40" stroke="#333" stroke-width="1.2" fill="none"/>`)
    p.push(`<ellipse cx="100" cy="26" rx="15" ry="11" fill="#9b6b3e"/><ellipse cx="96" cy="28" rx="4" ry="5" fill="#3b2412"/>`)
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 150" width="480" height="300">${p.join('')}</svg>`
}

/* ═══════════════════════ Fahrbahn-Linien ═══════════════════════ */

const LW = '#f3f3f0', LG = '#f2c230'
export const LINIEN = {
  'argentina': [
    { titel: 'Doppelte gelbe Mittellinie', mitte: { farbe: LG, art: 'doppelt' }, rand: { farbe: LW, art: 'durch' } },
    { titel: 'Oder alles weiß gestrichelt', mitte: { farbe: LW, art: 'strich' } },
  ],
  'brazil': [{ titel: 'Doppelt gelbe Mitte, weiße Ränder', mitte: { farbe: LG, art: 'doppelt' }, rand: { farbe: LW, art: 'durch' } }],
  'chile': [
    { titel: 'Alles weiß – am häufigsten', mitte: { farbe: LW, art: 'strich' }, rand: { farbe: LW, art: 'durch' } },
    { titel: 'Alles gelb (Nationalparks, Schnee) – in Amerika praktisch nur hier', mitte: { farbe: LG, art: 'doppelt' }, rand: { farbe: LG, art: 'durch' } },
    { titel: 'Los Ríos, Aysén: Linien aus Farbpunkten', mitte: { farbe: LW, art: 'punkte' }, rand: { farbe: LW, art: 'punkte' } },
  ],
  'uruguay': [{ titel: 'Dreifach: zwei gelbe Linien, weiße Striche dazwischen – nur hier', mitte: { farbe: LG, art: 'dreifach' } }],
  'peru': [
    { titel: 'Weiße Ränder, gelbe gestrichelte Mitte', mitte: { farbe: LG, art: 'strich' }, rand: { farbe: LW, art: 'durch' } },
    { titel: 'Bergstraßen: nur weiße Ränder, keine Mitte', rand: { farbe: LW, art: 'durch' } },
  ],
  'bolivia': [{ titel: 'Mitte gelb und weiß gemischt, Ränder immer weiß', mitte: { farbe: LG, farbe2: LW, art: 'durch+strich' }, rand: { farbe: LW, art: 'durch' } }],
  'colombia': [{ titel: 'Gelbe Mittellinie', mitte: { farbe: LG, art: 'doppelt' }, rand: { farbe: LW, art: 'durch' } }],
}

export function linienSvg(l) {
  const m = l.mitte
  if (m && (m.art === 'dreifach' || m.art === 'punkte') || l.rand?.art === 'punkte') {
    // Neue Muster: die Europa-Zeichnung ohne Mitte als Grundlage
    const base = linienSvgEU({ rand: l.rand && l.rand.art !== 'punkte' ? l.rand : undefined })
    const add = []
    if (m?.art === 'dreifach') add.push(`<path d="M55 0V160M65 0V160" stroke="${m.farbe}" stroke-width="2.4"/><path d="M60 0V160" stroke="${LW}" stroke-width="2.4" stroke-dasharray="15 15"/>`)
    if (m?.art === 'punkte') for (let y = 4; y < 160; y += 8) add.push(`<circle cx="60" cy="${y}" r="1.6" fill="${m.farbe}"/>`)
    if (l.rand?.art === 'punkte') for (let y = 4; y < 160; y += 8) add.push(`<circle cx="24" cy="${y}" r="1.6" fill="${l.rand.farbe}"/><circle cx="96" cy="${y}" r="1.6" fill="${l.rand.farbe}"/>`)
    return base.replace('</svg>', add.join('') + '</svg>')
  }
  return linienSvgEU(l)
}
