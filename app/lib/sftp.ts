import { Client, SFTPWrapper } from 'ssh2'
import { readFileSync } from 'fs'

// Zentrale SFTP-Verbindungsfunktion für den Datei-Browser (Server & Deploys).
// Nutzt denselben SSH-Key wie ssh.ts (SSH_HOST/SSH_USER/SSH_PRIVATE_KEY_PATH),
// öffnet aber eine SFTP-Subsession statt einzelner Shell-Befehle.
function getConnection(): Promise<{ conn: Client, sftp: SFTPWrapper }> {
  return new Promise((resolve, reject) => {
    const host = process.env.SSH_HOST
    const user = process.env.SSH_USER
    const keyPath = process.env.SSH_PRIVATE_KEY_PATH

    if (!host || !user || !keyPath) {
      reject(new Error('SSH ist nicht konfiguriert (SSH_HOST/SSH_USER/SSH_PRIVATE_KEY_PATH fehlen)'))
      return
    }

    let privateKey: Buffer
    try {
      privateKey = readFileSync(keyPath)
    } catch {
      reject(new Error(`SSH-Schlüssel konnte nicht gelesen werden: ${keyPath}`))
      return
    }

    const conn = new Client()
    conn.on('ready', () => {
      conn.sftp((err, sftp) => {
        if (err) { conn.end(); reject(err); return }
        resolve({ conn, sftp })
      })
    })
    conn.on('error', reject)
    conn.connect({ host, username: user, privateKey })
  })
}

// Basis-Ordner, den der Datei-Browser überhaupt sehen darf. Bewusst auf den
// Minecraft-Server-Ordner beschränkt (nicht das ganze Dateisystem), damit ein
// Bug im Browser nicht versehentlich Zugriff auf System- oder Website-Dateien gibt.
function serverRoot(): string {
  return process.env.MC_SERVER_ROOT || '/server'
}

// Verhindert Path-Traversal (../../etc/passwd). ".."-Segmente poppen einfach
// das letzte reale Segment statt darüber hinauszugehen - der aufgelöste Pfad
// bleibt also immer innerhalb von serverRoot().
export function resolveSafePath(relativePath: string): string {
  const root = serverRoot()
  const cleaned = (relativePath || '').replace(/\\/g, '/').split('/').filter(p => p !== '' && p !== '.')
  const parts: string[] = []
  for (const part of cleaned) {
    if (part === '..') { parts.pop(); continue }
    parts.push(part)
  }
  return parts.length ? `${root}/${parts.join('/')}` : root
}

export type SftpEntry = {
  name: string
  type: 'directory' | 'file' | 'other'
  size: number
  modifiedAt: string
}

export async function listDirectory(relativePath: string): Promise<SftpEntry[]> {
  const { conn, sftp } = await getConnection()
  try {
    const fullPath = resolveSafePath(relativePath)
    const entries: any[] = await new Promise((resolve, reject) => {
      sftp.readdir(fullPath, (err, list) => err ? reject(err) : resolve(list))
    })
    return entries
      .filter(e => e.filename !== '.' && e.filename !== '..')
      .map(e => ({
        name: e.filename,
        type: (e.attrs.isDirectory() ? 'directory' : e.attrs.isFile() ? 'file' : 'other') as SftpEntry['type'],
        size: e.attrs.size,
        modifiedAt: new Date(e.attrs.mtime * 1000).toISOString(),
      }))
      .sort((a, b) => a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'directory' ? -1 : 1)
  } finally {
    conn.end()
  }
}

export async function uploadFile(relativePath: string, buffer: Buffer): Promise<void> {
  const { conn, sftp } = await getConnection()
  try {
    const fullPath = resolveSafePath(relativePath)
    await new Promise<void>((resolve, reject) => {
      const stream = sftp.createWriteStream(fullPath)
      stream.on('close', () => resolve())
      stream.on('error', reject)
      stream.end(buffer)
    })
  } finally {
    conn.end()
  }
}

// Für den Log-Viewer (z.B. logs/latest.log). Bricht bewusst bei sehr großen
// Dateien ab statt sie komplett in den Speicher zu laden.
export async function readFileContent(relativePath: string, maxBytes = 512 * 1024): Promise<Buffer> {
  const { conn, sftp } = await getConnection()
  try {
    const fullPath = resolveSafePath(relativePath)
    const chunks: Buffer[] = []
    let total = 0
    await new Promise<void>((resolve, reject) => {
      const stream = sftp.createReadStream(fullPath)
      stream.on('data', (chunk: Buffer) => {
        total += chunk.length
        if (total > maxBytes) { stream.destroy(); reject(new Error('Datei zu groß zum Anzeigen (max. 512 KB)')); return }
        chunks.push(chunk)
      })
      stream.on('end', () => resolve())
      stream.on('error', reject)
    })
    return Buffer.concat(chunks)
  } finally {
    conn.end()
  }
}