import { saveFile } from '@/app/lib/local-storage'
import { IMAGE_TYPES } from '@/app/lib/home-tiles'
import { cleanAnchor, cleanPath, DIFFICULTIES, type Difficulty } from '@/app/lib/halloween'

// Helfer für die Halloween-Verwaltung unter /admin2/halloween
// (Prüfen von Fragen, Kürbissen und Shop-Artikeln, Speichern von Bildern und Musik)

const AUDIO_TYPES: Record<string, string> = { 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a' }

const randomName = (ext: string) => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

/** Bild für einen Shop-Artikel speichern → Dateiname in site-content/halloween/ */
export async function storeHwImage(file: File): Promise<string> {
  const ext = IMAGE_TYPES[file.type]
  if (!ext) throw new Error('Nur JPG, PNG oder WebP erlaubt')
  if (file.size > 5 * 1024 * 1024) throw new Error('Bild zu groß (max. 5 MB)')
  const name = randomName(ext)
  await saveFile('site-content', `halloween/${name}`, Buffer.from(await file.arrayBuffer()))
  return name
}

/** Musik für die Shop-Seite speichern (MP3/OGG/M4A, max. 15 MB) */
export async function storeHwAudio(file: File): Promise<string> {
  const byName = file.name.toLowerCase().match(/\.(mp3|ogg|m4a)$/)?.[1]
  const ext = AUDIO_TYPES[file.type] || byName
  if (!ext) throw new Error('Nur MP3, OGG oder M4A erlaubt')
  if (file.size > 15 * 1024 * 1024) throw new Error('Musikdatei zu groß (max. 15 MB)')
  const name = randomName(ext)
  await saveFile('site-content', `halloween/${name}`, Buffer.from(await file.arrayBuffer()))
  return name
}

const int = (v: unknown, min: number, max: number): number | null => {
  if (v === '' || v === null || v === undefined) return null
  const n = Number(v)
  return Number.isInteger(n) && n >= min && n <= max ? n : null
}
export const intOrNull = int

/** Quizfrage prüfen: 2–4 Antworten, eine davon richtig, Zeit 5–120 Sekunden */
export function parseQuestion(b: Record<string, unknown>) {
  const difficulty = String(b.difficulty || '') as Difficulty
  const question = String(b.question ?? '').trim().slice(0, 300)
  const answers = Array.isArray(b.answers) ? b.answers.map(a => String(a ?? '').trim().slice(0, 120)) : []
  const correctIndex = int(b.correctIndex, 0, 3)
  const timeLimit = int(b.timeLimit, 5, 120) ?? 20
  const active = b.active !== false

  if (!DIFFICULTIES.includes(difficulty)) return { error: 'Schwierigkeit fehlt' }
  if (!question) return { error: 'Frage fehlt' }
  if (answers.length < 2 || answers.length > 4) return { error: 'Es braucht 2 bis 4 Antworten' }
  if (answers.some(a => !a)) return { error: 'Eine Antwort ist leer' }
  if (correctIndex === null || correctIndex >= answers.length) return { error: 'Bitte die richtige Antwort markieren' }
  return { difficulty, question, answers, correctIndex, timeLimit, active }
}

/** Kürbis prüfen (aus dem Platzier-Modus) */
export function parsePumpkin(b: Record<string, unknown>, partial = false) {
  const out: { pagePath?: string; anchor?: string; x?: number; y?: number; size?: number; difficulty?: string; active?: boolean } = {}
  if (!partial || 'pagePath' in b) {
    const p = cleanPath(b.pagePath)
    if (!p) return { error: 'Seite ungültig' }
    out.pagePath = p
  }
  if (!partial || 'anchor' in b) {
    const a = cleanAnchor(b.anchor)
    if (!a) return { error: 'Position ungültig' }
    out.anchor = a
  }
  for (const k of ['x', 'y'] as const) {
    if (!partial || k in b) {
      const n = Number(b[k])
      if (!Number.isFinite(n) || n < -50 || n > 150) return { error: 'Position ungültig' }
      out[k] = Math.round(n * 100) / 100
    }
  }
  if (!partial || 'size' in b) {
    const s = int(b.size ?? 34, 18, 80)
    if (s === null) return { error: 'Größe muss zwischen 18 und 80 liegen' }
    out.size = s
  }
  if (!partial || 'difficulty' in b) {
    const d = String(b.difficulty ?? 'random')
    if (!['random', ...DIFFICULTIES].includes(d)) return { error: 'Schwierigkeit ungültig' }
    out.difficulty = d
  }
  if ('active' in b) out.active = b.active !== false
  return out
}

/** Shop-Artikel aus FormData prüfen */
export function parseItemForm(form: FormData) {
  const name = String(form.get('name') ?? '').trim().slice(0, 80)
  const description = String(form.get('description') ?? '').trim().slice(0, 400) || null
  const price = int(form.get('price'), 0, 1_000_000)
  const stockRaw = String(form.get('stock') ?? '').trim()
  const limitRaw = String(form.get('perUserLimit') ?? '').trim()
  const stock = stockRaw ? int(stockRaw, 0, 1_000_000) : null
  const perUserLimit = limitRaw ? int(limitRaw, 1, 1000) : null
  const rewardType = String(form.get('rewardType') || 'manual')
  const templateRaw = String(form.get('templateId') ?? '').trim()
  const templateId = templateRaw ? int(templateRaw, 1, Number.MAX_SAFE_INTEGER) : null
  const position = int(form.get('position'), -100000, 100000) ?? 0
  const active = form.get('active') !== 'false'

  if (!name) return { error: 'Name fehlt' }
  if (price === null) return { error: 'Preis ungültig' }
  if (stockRaw && stock === null) return { error: 'Bestand ungültig' }
  if (limitRaw && perUserLimit === null) return { error: 'Limit pro Spieler ungültig' }
  if (!['manual', 'mailbox'].includes(rewardType)) return { error: 'Belohnungsart ungültig' }
  if (rewardType === 'mailbox' && !templateId) return { error: 'Bitte ein Admin-Item für die Mailbox auswählen' }
  return { name, description, price, stock, perUserLimit, rewardType, templateId: rewardType === 'mailbox' ? templateId : null, position, active }
}