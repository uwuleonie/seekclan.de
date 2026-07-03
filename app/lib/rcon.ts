import { Rcon } from 'rcon-client'

// Zentrale RCON-Verbindungsfunktion für Server & Deploys (admin2). Öffnet bei
// jedem Aufruf eine neue Verbindung und schließt sie danach wieder - für die
// gelegentlichen Admin-Aktionen hier (Status abfragen, einzelne Befehle) ist
// eine dauerhaft offene Verbindung unnötige Komplexität.
export async function runRconCommand(command: string): Promise<string> {
  const host = process.env.RCON_HOST
  const port = parseInt(process.env.RCON_PORT || '25575')
  const password = process.env.RCON_PASSWORD

  if (!host || !password) {
    throw new Error('RCON ist nicht konfiguriert (RCON_HOST/RCON_PASSWORD fehlen)')
  }

  const rcon = await Rcon.connect({ host, port, password })
  try {
    const response = await rcon.send(command)
    return response
  } finally {
    await rcon.end()
  }
}