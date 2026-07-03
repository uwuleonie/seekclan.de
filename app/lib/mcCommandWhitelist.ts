// Whitelist erlaubter Minecraft-Konsolenbefehle für die Live-Konsole in Server
// & Deploys (admin2). Bewusst restriktiv - nur lesende/harmlose Befehle plus
// ein paar kontrollierte Schreibaktionen. Alles was nicht hier drin steht,
// wird von der Konsolen-Route hart abgelehnt (siehe validateMcCommand unten).
//
// Format: der erste Wortteil des Befehls (vor dem ersten Leerzeichen) muss
// exakt in dieser Liste stehen. Alles danach (Argumente) wird nicht weiter
// eingeschränkt, da z.B. "say <beliebiger Text>" oder "tp <Spieler>" variable
// Inhalte brauchen - die Sicherheit kommt hier aus der Begrenzung auf
// bekannte, harmlose BEFEHLSNAMEN, nicht aus Argument-Validierung.
const ALLOWED_COMMANDS = [
  'list', 'tps', 'say', 'whitelist', 'kick', 'ban', 'pardon',
  'tp', 'weather', 'time', 'difficulty', 'save-all', 'seed',
  'plugins', 'version', 'help','stop', 'restart', 
]

export function validateMcCommand(rawCommand: string): { valid: boolean, error?: string } {
  const trimmed = rawCommand.trim()
  if (!trimmed) return { valid: false, error: 'Leerer Befehl' }

  // Führenden Slash tolerieren (Spieler tippen oft "/list" aus Gewohnheit)
  const withoutSlash = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed
  const commandName = withoutSlash.split(/\s+/)[0]?.toLowerCase()

  if (!commandName || !ALLOWED_COMMANDS.includes(commandName)) {
    return { valid: false, error: `Befehl "${commandName}" ist nicht in der Whitelist. Erlaubt: ${ALLOWED_COMMANDS.join(', ')}` }
  }

  return { valid: true }
}