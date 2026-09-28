// Text an Claude (claude.ai) oder Google übergeben.
// claude.ai übernimmt den Text über ?q= ins Eingabefeld. Zur Sicherheit wird er zusätzlich
// in die Zwischenablage kopiert – falls das Vorausfüllen einmal nicht klappt, einfach einfügen.

export const CLAUDE_PRESETS = [
  { key: 'ask', label: 'Fragen', prefix: '' },
  { key: 'explain', label: 'Erklären', prefix: 'Erkläre mir einfach und auf Deutsch:\n\n' },
  { key: 'translate', label: 'Übersetzen', prefix: 'Übersetze ins Deutsche (bei deutschem Text ins Englische):\n\n' },
  { key: 'summary', label: 'Zusammenfassen', prefix: 'Fasse kurz auf Deutsch zusammen:\n\n' },
  { key: 'check', label: 'Fakten prüfen', prefix: 'Stimmt das? Prüfe die Aussage und nenne Quellen:\n\n' },
] as const

export type ClaudePreset = (typeof CLAUDE_PRESETS)[number]['key']

const MAX = 6000 // lange Texte kürzen, damit der Link nicht zu lang wird

export function claudeUrl(text: string, preset: ClaudePreset = 'ask'): string {
  const p = CLAUDE_PRESETS.find(x => x.key === preset)?.prefix ?? ''
  return `https://claude.ai/new?q=${encodeURIComponent((p + text.trim()).slice(0, MAX))}`
}

export function googleUrl(text: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(text.trim().slice(0, 500))}`
}

export async function openClaude(text: string, preset: ClaudePreset = 'ask') {
  const p = CLAUDE_PRESETS.find(x => x.key === preset)?.prefix ?? ''
  try { await navigator.clipboard.writeText(p + text.trim()) } catch { /* egal */ }
  window.open(claudeUrl(text, preset), '_blank', 'noopener')
}

export function openGoogle(text: string) {
  window.open(googleUrl(text), '_blank', 'noopener')
}