import sharp from 'sharp'
import { saveFile, readFile, type Bucket } from './local-storage'

// Eigenes, selbst gehostetes System für Spielerköpfe — ersetzt externe Dienste wie
// mc-heads.net / CreeperNation, die sich als unzuverlässig (falsche Cache-Treffer,
// abweichende URL-Formate) herausgestellt haben.
//
// Ablauf:
// 1. Kopf schon lokal gecacht und noch frisch (< 24h)? -> direkt ausliefern
// 2. Sonst: Mojang-API abfragen (UUID -> Profil -> Skin-URL), Skin herunterladen,
//    Kopf-Bereich (8x8 Basis + 8x8 Hut-Overlay) ausschneiden, hochskalieren, cachen

const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000 // 24 Stunden, wie zuvor bei mc-heads.net
const HEAD_BUCKET: Bucket = 'player-heads'

// Eingebauter Steve-Fallback als Data-URL-Quelle: wir generieren ihn einmalig aus
// den offiziellen Mojang-Default-Skin-Koordinaten, falls ein Spieler nicht gefunden wird.
const MOJANG_STEVE_SKIN_URL = 'http://textures.minecraft.net/texture/31f477eb1a7beee631c2ca64d06f8f68fa93a3386d04452ab27f43acdf1b60cb'

function safeUsername(username: string): string {
  // Nur alphanumerisch + Unterstrich erlaubt (offizielles Minecraft-Namensformat),
  // verhindert Path-Traversal und ungültige Requests an Mojang.
  return username.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase()
}

async function fetchMojangUuid(username: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(username)}`)
    if (!res.ok) return null
    const data = await res.json()
    return data?.id || null
  } catch {
    return null
  }
}

async function fetchSkinUrl(uuid: string): Promise<string | null> {
  try {
    const res = await fetch(`https://sessionserver.mojang.com/session/minecraft/profile/${uuid}`)
    if (!res.ok) return null
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
  const metadata = await sharp(skinBuffer).metadata()
  const hasOverlay = (metadata.height || 0) >= 64

  const base = await sharp(skinBuffer)
    .extract({ left: 8, top: 8, width: 8, height: 8 })
    .toBuffer()

  let composed = sharp(base)

  if (hasOverlay) {
    const overlay = await sharp(skinBuffer)
      .extract({ left: 40, top: 8, width: 8, height: 8 })
      .toBuffer()
    composed = sharp(base).composite([{ input: overlay }])
  }

  return composed
    .resize(targetSize, targetSize, { kernel: 'nearest' })
    .png()
    .toBuffer()
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

  const uuid = await fetchMojangUuid(username)
  const skinUrl = uuid ? await fetchSkinUrl(uuid) : null
  const skinBuffer = skinUrl ? await downloadSkinBuffer(skinUrl) : null

  if (skinBuffer) {
    try {
      // Immer eine 64px-Referenzgröße cachen, davon dann für jede angefragte
      // Größe herunterskalieren — spart wiederholte Mojang-Anfragen.
      const referenceHead = await cropHeadFromSkin(skinBuffer, 64)
      await saveFile(HEAD_BUCKET, cacheKey, referenceHead)
      await saveFile(HEAD_BUCKET, `${cacheKey}.meta`, Buffer.from(String(Date.now())))
      const resized = await sharp(referenceHead).resize(clampedSize, clampedSize, { kernel: 'nearest' }).png().toBuffer()
      return { buffer: resized, isFallback: false }
    } catch (err) {
      console.error('Fehler beim Verarbeiten des Skins für', username, err)
    }
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