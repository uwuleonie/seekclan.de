import sharp from 'sharp'
import { saveFile, readFile, type Bucket } from './local-storage'
import { pool } from './db'

// Eigenes, selbst gehostetes System für Spielerköpfe — ersetzt externe Dienste wie
// mc-heads.net / CreeperNation, die sich als unzuverlässig (falsche Cache-Treffer,
// abweichende URL-Formate) herausgestellt haben.
//
// Ablauf:
// 1. Kopf schon lokal gecacht und noch frisch (< 24h)? -> direkt ausliefern
// 2. Sonst: Mojang-API abfragen (UUID -> Profil -> Skin-URL), Skin herunterladen,
//    Kopf-Bereich (8x8 Basis + 8x8 Hut-Overlay) ausschneiden, hochskalieren, cachen
//
// Gegen den Steve-Kopf bei vollen Seiten (/clan, /clan-history zeigen 100+ Köpfe auf einmal):
//  - UUID zuerst aus der eigenen Datenbank (Ränge, Clan-Akten, Konten) – spart die Namens-Anfrage bei Mojang
//  - Anfragen an Mojang laufen nacheinander in einer Warteschlange (höchstens 2 gleichzeitig) statt alle auf einmal
//  - Sagt Mojang „zu viele Anfragen“ (429), wird kurz pausiert – wartende Köpfe warten mit und werden danach geholt
//  - Derselbe Spieler wird nur EINMAL gleichzeitig geholt, auch wenn die Seite seinen Kopf 20× in verschiedenen
//    Größen anfragt (Mojang lässt dasselbe Profil nur selten hintereinander abfragen)
//  - „Gibt es nicht“ (z. B. alter Name nach Namensänderung) wird 6 Stunden gemerkt
//  - Ein Steve-Platzhalter wird nie im Browser gespeichert (siehe Route) – beim nächsten Laden kommt der echte Kopf

const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000 // 24 Stunden, wie zuvor bei mc-heads.net
const HEAD_BUCKET: Bucket = 'player-heads'

// Eingebauter Steve-Fallback als Data-URL-Quelle: wir generieren ihn einmalig aus
// den offiziellen Mojang-Default-Skin-Koordinaten, falls ein Spieler nicht gefunden wird.
const MOJANG_STEVE_SKIN_URL = 'http://textures.minecraft.net/texture/31f477eb1a7beee631c2ca64d06f8f68fa93a3386d04452ab27f43acdf1b60cb'

function safeUsername(username: string): string {
  // Nur alphanumerisch + Unterstrich erlaubt (offizielles Minecraft-Namensformat),
  // verhindert Path-Traversal und ungültige Requests an Mojang. Eine UUID (mit/ohne Bindestriche) wird zu 32 Zeichen.
  return username.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase()
}

/* ── Warteschlange für Mojang ── */
const GLEICHZEITIG = 2
let laufend = 0
const warten: (() => void)[] = []
let pauseBis = 0

const schlafen = (ms: number) => new Promise(r => setTimeout(r, ms))

/** Anfrage an Mojang über die Warteschlange. Wartet eine Pause ab (höchstens ~25 s) und versucht es nach „zu viele“ noch einmal. */
async function mojangFetch(url: string): Promise<Response | null> {
  const bis = Date.now() + 25_000
  for (let versuch = 0; versuch < 2; versuch++) {
    while (Date.now() < pauseBis) {
      if (Date.now() > bis) return null
      await schlafen(Math.min(1000, pauseBis - Date.now()))
    }
    if (laufend >= GLEICHZEITIG) await new Promise<void>(r => warten.push(r))
    laufend++
    let res: Response | null = null
    try {
      res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(6000) })
    } catch {
      res = null
    } finally {
      laufend--
      warten.shift()?.()
    }
    if (res?.status === 429) {
      pauseBis = Math.max(pauseBis, Date.now() + 10_000)
      console.warn('Spielerköpfe: Mojang meldet zu viele Anfragen – kurze Pause')
      continue
    }
    return res
  }
  return null
}

/** Namen/UUIDs, die es bei Mojang nicht gibt → Zeitpunkt (nicht ständig neu fragen) */
const gibtsNicht = new Map<string, number>()
const GIBTS_NICHT_MS = 6 * 3600 * 1000

/** UUID aus der eigenen Datenbank (Minecraft-Ränge, Clan-Akten, verknüpfte Konten) – null, wenn unbekannt */
async function uuidAusDatenbank(name: string): Promise<string | null> {
  try {
    const r = await pool.query(
      `SELECT uuid FROM (
         SELECT uuid::text AS uuid, 1 AS p FROM mc_player_ranks WHERE lower(player_name) = $1
         UNION ALL SELECT minecraft_uuid, 2 FROM clan_members WHERE minecraft_uuid IS NOT NULL AND lower(display_name) = $1
         UNION ALL SELECT minecraft_uuid, 3 FROM users WHERE minecraft_uuid IS NOT NULL AND lower(minecraft_username) = $1
       ) x ORDER BY p LIMIT 1`,
      [name.toLowerCase()]
    )
    const u = r.rows[0]?.uuid
    return u ? String(u).replace(/-/g, '').toLowerCase() : null
  } catch {
    return null
  }
}

const UUID_RE = /^[0-9a-f]{32}$/

async function fetchMojangUuid(username: string): Promise<string | null> {
  const ausDb = await uuidAusDatenbank(username)
  if (ausDb) return ausDb
  try {
    const res = await mojangFetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(username)}`)
    if (res && (res.status === 404 || res.status === 204)) gibtsNicht.set(username, Date.now())
    if (!res?.ok || res.status === 204) return null
    const data = await res.json()
    return data?.id || null
  } catch {
    return null
  }
}

async function fetchSkinUrl(uuid: string): Promise<string | null> {
  try {
    const res = await mojangFetch(`https://sessionserver.mojang.com/session/minecraft/profile/${uuid}`)
    if (!res?.ok) return null
    const data = await res.json()
    const texturesProp = data?.properties?.find((p: any) => p.name === 'textures')
    if (!texturesProp?.value) return null
    const decoded = JSON.parse(Buffer.from(texturesProp.value, 'base64').toString('utf-8'))
    return decoded?.textures?.SKIN?.url || null
  } catch {
    return null
  }
}

async function downloadSkinBuffer(skinUrl: string): Promise<Buffer | null> {
  try {
    const res = await fetch(skinUrl)
    if (!res.ok) return null
    const arrayBuffer = await res.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch {
    return null
  }
}

/**
 * Schneidet aus einem vollständigen Minecraft-Skin (64x64 oder 64x32) den Kopf aus:
 * Basis-Kopf bei (8,8) 8x8px, darauf der Hut/Helm-Overlay bei (40,8) 8x8px
 * (nur bei 64x64-Skins vorhanden, ältere 64x32-Skins haben keinen Overlay).
 * Ergebnis wird ohne Kantenglättung (nearest-neighbor) auf targetSize hochskaliert,
 * damit die charakteristischen scharfen Pixel-Kanten erhalten bleiben.
 */
async function cropHeadFromSkin(skinBuffer: Buffer, targetSize: number): Promise<Buffer> {
  // Den kompletten Skin EINMAL zu rohen RGBA-Pixeln dekodieren. Das umgeht
  // jegliche Format-Eigenheiten (z.B. indizierte Farbpaletten, wie sie viele
  // mit Skin-Editoren gespeicherte PNGs verwenden), die beim direkten
  // Verketten von PNG-zu-PNG extract()-Aufrufen zu verlorener Transparenz
  // im Overlay führen können.
  const { data, info } = await sharp(skinBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const hasOverlay = info.height >= 64 && info.width >= 64
  const channels = info.channels // 4 (RGBA) durch ensureAlpha() garantiert
  const stride = info.width * channels

  const headPixels = extractRegionRaw(data, stride, channels, 8, 8, 8, 8)

  if (hasOverlay) {
    const overlayPixels = extractRegionRaw(data, stride, channels, 40, 8, 8, 8)
    // Manuelles Alpha-Blending, pixelweise: overlay über head legen.
    for (let i = 0; i < headPixels.length; i += 4) {
      const overlayAlpha = overlayPixels[i + 3] / 255
      if (overlayAlpha > 0) {
        headPixels[i] = Math.round(overlayPixels[i] * overlayAlpha + headPixels[i] * (1 - overlayAlpha))
        headPixels[i + 1] = Math.round(overlayPixels[i + 1] * overlayAlpha + headPixels[i + 1] * (1 - overlayAlpha))
        headPixels[i + 2] = Math.round(overlayPixels[i + 2] * overlayAlpha + headPixels[i + 2] * (1 - overlayAlpha))
        headPixels[i + 3] = Math.min(255, headPixels[i + 3] + overlayPixels[i + 3])
      }
    }
  }

  return sharp(headPixels, { raw: { width: 8, height: 8, channels: 4 } })
    .resize(targetSize, targetSize, { kernel: 'nearest' })
    .png()
    .toBuffer()
}

/** Schneidet einen rechteckigen Pixelbereich aus einem rohen RGBA-Byte-Array aus. */
function extractRegionRaw(
  data: Buffer, stride: number, channels: number,
  left: number, top: number, width: number, height: number
): Buffer {
  const out = Buffer.alloc(width * height * channels)
  for (let y = 0; y < height; y++) {
    const srcStart = (top + y) * stride + left * channels
    const destStart = y * width * channels
    data.copy(out, destStart, srcStart, srcStart + width * channels)
  }
  return out
}

/**
 * Liefert einen Spielerkopf als PNG-Buffer zurück, aus dem lokalen Cache falls
 * vorhanden und frisch genug, sonst frisch von Mojang abgerufen und neu gecacht.
 * Gibt bei jedem Fehler (Spieler nicht gefunden, Mojang nicht erreichbar, etc.)
 * den Standard-Steve-Kopf zurück statt eines Fehlers — die Seite soll nie kaputt
 * aussehen, nur im schlimmsten Fall den Platzhalter zeigen.
 */
export async function getPlayerHead(rawUsername: string, size: number): Promise<{ buffer: Buffer; isFallback: boolean }> {
  const username = safeUsername(rawUsername)
  const clampedSize = Math.max(8, Math.min(size || 48, 512))
  const cacheKey = `${username}.png`

  const cached = await readFile(HEAD_BUCKET, cacheKey)
  const isFresh = cached ? await isCacheFresh(cacheKey) : false

  if (cached && isFresh) {
    const resized = await sharp(cached.buffer).resize(clampedSize, clampedSize, { kernel: 'nearest' }).png().toBuffer()
    return { buffer: resized, isFallback: false }
  }

  // Kopf holen – läuft für denselben Spieler nur einmal gleichzeitig, alle anderen Anfragen warten auf dasselbe Ergebnis
  let arbeit = inArbeit.get(username)
  if (!arbeit) {
    arbeit = referenzKopfHolen(username, cacheKey).finally(() => inArbeit.delete(username))
    inArbeit.set(username, arbeit)
  }
  const referenceHead = await arbeit
  if (referenceHead) {
    const resized = await sharp(referenceHead).resize(clampedSize, clampedSize, { kernel: 'nearest' }).png().toBuffer()
    return { buffer: resized, isFallback: false }
  }

  // Fallback: alten Cache-Stand nutzen, auch wenn er abgelaufen ist, statt Steve zu zeigen —
  // besser ein leicht veralteter echter Skin als der generische Platzhalter.
  if (cached) {
    const resized = await sharp(cached.buffer).resize(clampedSize, clampedSize, { kernel: 'nearest' }).png().toBuffer()
    return { buffer: resized, isFallback: false }
  }

  const steveBuffer = await getSteveFallback(clampedSize)
  return { buffer: steveBuffer, isFallback: true }
}

const inArbeit = new Map<string, Promise<Buffer | null>>()

/** Skin bei Mojang holen, 64px-Kopf ausschneiden und speichern. null, wenn es nicht geklappt hat. */
async function referenzKopfHolen(username: string, cacheKey: string): Promise<Buffer | null> {
  const nicht = gibtsNicht.get(username)
  if (nicht && Date.now() - nicht < GIBTS_NICHT_MS) return null
  // Statt eines Namens darf auch direkt die UUID kommen (spart die Namens-Anfrage)
  const uuid = UUID_RE.test(username) ? username : await fetchMojangUuid(username)
  const skinUrl = uuid ? await fetchSkinUrl(uuid) : null
  const skinBuffer = skinUrl ? await downloadSkinBuffer(skinUrl) : null
  if (!skinBuffer) return null
  try {
    // Immer eine 64px-Referenzgröße cachen, davon dann für jede angefragte Größe herunterskalieren
    const referenceHead = await cropHeadFromSkin(skinBuffer, 64)
    await saveFile(HEAD_BUCKET, cacheKey, referenceHead)
    await saveFile(HEAD_BUCKET, `${cacheKey}.meta`, Buffer.from(String(Date.now())))
    return referenceHead
  } catch (err) {
    console.error('Fehler beim Verarbeiten des Skins für', username, err)
    return null
  }
}

async function isCacheFresh(cacheKey: string): Promise<boolean> {
  const meta = await readFile(HEAD_BUCKET, `${cacheKey}.meta`)
  if (!meta) return false
  const timestamp = parseInt(meta.buffer.toString('utf-8'), 10)
  if (Number.isNaN(timestamp)) return false
  return Date.now() - timestamp < CACHE_MAX_AGE_MS
}

let steveCache: Buffer | null = null

async function getSteveFallback(size: number): Promise<Buffer> {
  if (!steveCache) {
    const skinBuffer = await downloadSkinBuffer(MOJANG_STEVE_SKIN_URL)
    steveCache = skinBuffer ? await cropHeadFromSkin(skinBuffer, 64) : await sharp({
      create: { width: 8, height: 8, channels: 4, background: { r: 130, g: 100, b: 80, alpha: 1 } },
    }).png().toBuffer()
  }
  return sharp(steveCache).resize(size, size, { kernel: 'nearest' }).png().toBuffer()
}