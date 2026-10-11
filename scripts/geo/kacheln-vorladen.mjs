// Lädt die Kartenkacheln (Relief, Satellit, Nachtlichter) für Europa vorab in den Zwischenspeicher des Servers.
//
// Warum: Beim allerersten Aufruf einer Gegend muss der Server jede Kachel erst bei der Quelle holen (AWS, EOX, NASA)
// und das Relief daraus berechnen – das dauert. Danach liegt sie im Ordner .geo-tiles und kommt sofort.
// Dieses Skript ruft dafür einfach die eigene Seite auf (/api/geo/tiles/…), damit der Server alles einmal holt.
//
// Aufruf (auf dem Server, während die Seite läuft):
//   node scripts/geo/kacheln-vorladen.mjs                       → http://localhost:3000, Standard-Zoomstufen
//   node scripts/geo/kacheln-vorladen.mjs http://localhost:3100  → andere Adresse
//   node scripts/geo/kacheln-vorladen.mjs http://localhost:3000 --max 10   → eine Stufe feiner (≈ 4× so viele Kacheln)
//
// Bereits gespeicherte Kacheln kommen sofort zurück – man kann das Skript also jederzeit abbrechen und neu starten.

const args = process.argv.slice(2)
const BASE = (args.find(a => a.startsWith('http')) ?? 'http://localhost:3000').replace(/\/$/, '')
const maxArg = args.indexOf('--max')
const EXTRA = maxArg >= 0 ? Number(args[maxArg + 1]) - 9 : 0
const PARALLEL = 8

// Europa (mit Island, Kanaren, Kaukasus, Ural) und die ganze Welt in groben Stufen
const EUROPA = { west: -32, east: 60, south: 27, north: 72 }
const WELT = { west: -180, east: 180, south: -85, north: 85 }

const QUELLEN = [
  // [Quelle, Welt bis Stufe, Europa bis Stufe]
  ['terrain', 5, 9 + EXTRA],
  ['sat', 5, 9 + EXTRA],
  ['night', 5, Math.min(8, 8 + EXTRA)],
]

const tileX = (lon, n) => Math.floor(((lon + 180) / 360) * n)
const tileY = (lat, n) => {
  const p = (lat * Math.PI) / 180
  return Math.floor(((1 - Math.log(Math.tan(p) + 1 / Math.cos(p)) / Math.PI) / 2) * n)
}

function* kacheln() {
  for (const [src, weltBis, europaBis] of QUELLEN) {
    for (let z = 0; z <= europaBis; z++) {
      const g = z <= weltBis ? WELT : EUROPA
      const n = 2 ** z
      const x0 = Math.max(0, tileX(g.west, n)), x1 = Math.min(n - 1, tileX(g.east, n))
      const y0 = Math.max(0, tileY(g.north, n)), y1 = Math.min(n - 1, tileY(g.south, n))
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) yield `${src}/${z}/${x}/${y}`
    }
  }
}

const alle = [...kacheln()]
console.log(`${alle.length} Kacheln, Server ${BASE}`)

let i = 0, fertig = 0, fehler = 0
const start = Date.now()
async function arbeiter() {
  while (i < alle.length) {
    const k = alle[i++]
    for (let versuch = 1; versuch <= 3; versuch++) {
      try {
        const r = await fetch(`${BASE}/api/geo/tiles/${k}`)
        await r.arrayBuffer()
        if (r.ok || r.status === 404) break // 404 = an der Stelle gibt es keine Kachel (z. B. offenes Meer) – ist in Ordnung
        if (versuch === 3) { fehler++; console.log(`  Fehler ${r.status}: ${k}`) }
      } catch (e) {
        if (versuch === 3) { fehler++; console.log(`  Fehler: ${k} – ${e.message}`) }
      }
      await new Promise(r => setTimeout(r, 1500 * versuch))
    }
    fertig++
    if (fertig % 250 === 0 || fertig === alle.length) {
      const s = (Date.now() - start) / 1000
      const rest = ((alle.length - fertig) * s) / fertig
      console.log(`  ${fertig}/${alle.length} · ${Math.round(s)} s · noch ca. ${Math.round(rest / 60)} min`)
    }
  }
}
await Promise.all(Array.from({ length: PARALLEL }, arbeiter))
console.log(`fertig – ${fehler} Fehler`)
