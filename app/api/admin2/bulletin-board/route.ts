import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import sharp from 'sharp'

// Minecraft-Farbpalette (128 Farben, vereinfacht auf die wichtigsten)
// Jeder Eintrag: [R, G, B]
const MC_COLORS: [number, number, number][] = [
  [0,0,0],[127,178,56],[247,233,163],[199,199,199],[255,0,0],[160,160,255],
  [167,167,167],[0,124,0],[255,255,255],[164,168,184],[151,109,77],[112,112,112],
  [64,64,255],[143,119,72],[255,252,245],[216,127,51],[178,76,216],[102,153,216],
  [229,229,51],[127,204,25],[242,127,165],[76,76,76],[153,153,153],[76,127,153],
  [127,63,178],[51,76,178],[102,76,51],[102,127,51],[153,51,51],[25,25,25],
  [250,238,77],[92,219,213],[74,128,255],[0,217,58],[129,86,49],[112,2,0],
  [209,177,161],[159,82,36],[149,87,108],[112,108,138],[186,133,36],[103,117,53],
  [160,77,78],[57,41,35],[135,107,98],[87,92,92],[122,73,88],[76,62,92],
  [76,50,35],[76,82,42],[142,60,46],[37,22,16],
]

function closestMcColor(r: number, g: number, b: number): [number, number, number] {
  let best = MC_COLORS[0]
  let bestDist = Infinity
  for (const c of MC_COLORS) {
    const dist = (r-c[0])**2 + (g-c[1])**2 + (b-c[2])**2
    if (dist < bestDist) { bestDist = dist; best = c }
  }
  return best
}

function generateSvg(title: string, bullets: string[], logoUrl: string | null): string {
  const W = 768, H = 384
  const PADDING = 32
  const LOGO_SIZE = 48

  // Bullets als SVG-Elemente
  const bulletElements = bullets.map((b, i) => {
    const y = 160 + i * 36
    return `
      <text x="${PADDING + 16}" y="${y}" font-family="Arial, sans-serif" font-size="20" fill="#E5E7EB">
        <tspan fill="#A78BFA">▸</tspan> ${escSvg(b)}
      </text>`
  }).join('')

  // Trennlinie nach Titel
  const titleY = logoUrl ? 110 : 80

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0F0A1E"/>
      <stop offset="100%" stop-color="#1A0F2E"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#4F46E5"/>
      <stop offset="50%" stop-color="#7C3AED"/>
      <stop offset="100%" stop-color="#C026D3"/>
    </linearGradient>
  </defs>

  <!-- Hintergrund -->
  <rect width="${W}" height="${H}" fill="url(#bg)" rx="0"/>

  <!-- Border-Gradient oben -->
  <rect x="0" y="0" width="${W}" height="4" fill="url(#accent)"/>

  <!-- Logo-Kreis -->
  <circle cx="${PADDING + LOGO_SIZE/2}" cy="52" r="${LOGO_SIZE/2}" fill="url(#accent)"/>
  <text x="${PADDING + LOGO_SIZE/2}" y="58" font-family="Arial Black, sans-serif" font-size="22" fill="white" text-anchor="middle" font-weight="bold">S</text>

  <!-- seekclan.de Label -->
  <text x="${PADDING + LOGO_SIZE + 12}" y="44" font-family="Arial, sans-serif" font-size="13" fill="#9CA3AF">seekclan.de</text>

  <!-- Titel -->
  <text x="${PADDING + LOGO_SIZE + 12}" y="68" font-family="Arial Black, sans-serif" font-size="26" fill="white" font-weight="bold">${escSvg(title)}</text>

  <!-- Trennlinie -->
  <rect x="${PADDING}" y="${titleY}" width="${W - PADDING * 2}" height="2" fill="url(#accent)" rx="1"/>

  <!-- Bullets -->
  ${bulletElements}

  <!-- Datum unten rechts -->
  <text x="${W - PADDING}" y="${H - 16}" font-family="Arial, sans-serif" font-size="13" fill="#4B5563" text-anchor="end">Seek The Clan</text>

  <!-- Deko-Punkte rechts -->
  <circle cx="${W - 24}" cy="48" r="3" fill="#4F46E5" opacity="0.5"/>
  <circle cx="${W - 36}" cy="48" r="3" fill="#7C3AED" opacity="0.5"/>
  <circle cx="${W - 48}" cy="48" r="3" fill="#C026D3" opacity="0.5"/>
</svg>`
}

function escSvg(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

async function svgToPng(svg: string): Promise<Buffer> {
  return sharp(Buffer.from(svg)).png().toBuffer()
}

// Konvertiert PNG zu Minecraft Map-Daten (128x128 Tiles)
async function pngToMapTiles(pngBuffer: Buffer, cols: number, rows: number): Promise<number[][][]> {
  const totalW = 128 * cols
  const totalH = 128 * rows

  // Resize auf exakte Map-Größe
  const raw = await sharp(pngBuffer)
    .resize(totalW, totalH, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { data, info } = raw
  const channels = info.channels

  // Aufteilen in tiles[row][col] → flat array of 128*128 MC color indices
  const tiles: number[][][] = []
  for (let row = 0; row < rows; row++) {
    tiles[row] = []
    for (let col = 0; col < cols; col++) {
      const tile: number[] = new Array(128 * 128)
      for (let py = 0; py < 128; py++) {
        for (let px = 0; px < 128; px++) {
          const globalX = col * 128 + px
          const globalY = row * 128 + py
          const idx = (globalY * totalW + globalX) * channels
          const r = data[idx], g = data[idx+1], b = data[idx+2]
          const [cr, cg, cb] = closestMcColor(r, g, b)
          // Finde Index in MC_COLORS
          const colorIdx = MC_COLORS.findIndex(c => c[0]===cr && c[1]===cg && c[2]===cb)
          tile[py * 128 + px] = colorIdx * 4 + 2 // MC multiplier offset
        }
      }
      tiles[row][col] = tile
    }
  }
  return tiles
}

async function checkWrite(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const s = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  if (!s.rows[0]) return null
  const u = await pool.query('SELECT id, clan_role FROM users WHERE id = $1', [s.rows[0].user_id])
  const user = u.rows[0]
  if (!user || (user.clan_role !== 'administrator' && user.clan_role !== 'owner')) return null
  return user
}

async function checkRead(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const s = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  if (!s.rows[0]) return null
  const u = await pool.query('SELECT id, clan_role FROM users WHERE id = $1', [s.rows[0].user_id])
  const user = u.rows[0]
  if (!user || !['administrator', 'owner', 'teammitglied'].includes(user.clan_role)) return null
  return user
}

// GET /api/admin2/bulletin-board — aktuellen Inhalt laden
export async function GET(req: NextRequest) {
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const result = await pool.query('SELECT * FROM lobby_bulletin_board ORDER BY id DESC LIMIT 1')
  return NextResponse.json({ board: result.rows[0] || null })
}

// POST /api/admin2/bulletin-board — neuen Inhalt setzen + Bild generieren
export async function POST(req: NextRequest) {
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { title, bullets } = await req.json().catch(() => ({})) as { title?: string, bullets?: string[] }
  if (!title?.trim()) return NextResponse.json({ error: 'Titel erforderlich' }, { status: 400 })

  const validBullets = (bullets || []).filter(b => b.trim()).slice(0, 8)

  // SVG generieren → PNG
  const svg = generateSvg(title.trim(), validBullets, null)
  const png = await svgToPng(svg)

  // In 6×3 Tiles aufteilen
  const tiles = await pngToMapTiles(png, 6, 3)

  // In DB speichern
  await pool.query('DELETE FROM lobby_bulletin_board')
  const result = await pool.query(
    'INSERT INTO lobby_bulletin_board (title, bullets, map_data) VALUES ($1, $2, $3) RETURNING id',
    [title.trim(), JSON.stringify(validBullets), JSON.stringify(tiles)]
  )

  return NextResponse.json({ id: result.rows[0].id, success: true })
}

// GET /api/admin2/bulletin-board/preview — PNG-Vorschau
export async function PUT(req: NextRequest) {
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { title, bullets } = await req.json().catch(() => ({})) as { title?: string, bullets?: string[] }
  const svg = generateSvg(title?.trim() || 'Vorschau', (bullets || []).filter(b => b.trim()), null)
  const png = await svgToPng(svg)

  return new NextResponse(png, { headers: { 'Content-Type': 'image/png' } })
}