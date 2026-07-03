import { Client } from 'ssh2'
import { readFileSync } from 'fs'

// Zentrale SSH-Verbindungsfunktion für Server & Deploys (admin2). Führt EINEN
// Befehl aus und gibt stdout/stderr zurück - keine interaktive Shell, keine
// dauerhafte Verbindung. Das reicht für Neustarts, git pull, npm run build
// etc. und ist deutlich einfacher abzusichern als eine offene Shell-Sitzung.
export function runSshCommand(command: string, timeoutMs = 60000): Promise<{ stdout: string, stderr: string, code: number | null }> {
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
    } catch (err) {
      reject(new Error(`SSH-Schlüssel konnte nicht gelesen werden: ${keyPath}`))
      return
    }

    const conn = new Client()
    let stdout = ''
    let stderr = ''

    const timeout = setTimeout(() => {
      conn.end()
      reject(new Error('SSH-Befehl hat das Zeitlimit überschritten'))
    }, timeoutMs)

    conn.on('ready', () => {
      conn.exec(command, (err, stream) => {
        if (err) {
          clearTimeout(timeout)
          conn.end()
          reject(err)
          return
        }
        stream.on('close', (code: number | null) => {
          clearTimeout(timeout)
          conn.end()
          resolve({ stdout, stderr, code })
        })
        stream.on('data', (data: Buffer) => { stdout += data.toString() })
        stream.stderr.on('data', (data: Buffer) => { stderr += data.toString() })
      })
    })

    conn.on('error', (err) => {
      clearTimeout(timeout)
      reject(err)
    })

    conn.connect({ host, username: user, privateKey })
  })
}