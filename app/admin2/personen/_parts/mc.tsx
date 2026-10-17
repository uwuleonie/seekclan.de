// Minecraft-Farbcodes (§) für den Rang-Editor: Farbtabelle und Vorschau

export const MC_COLORS = [
  { code: '§0', hex: '#000000', label: 'Schwarz' },
  { code: '§1', hex: '#0000AA', label: 'Dunkelblau' },
  { code: '§2', hex: '#00AA00', label: 'Dunkelgrün' },
  { code: '§3', hex: '#00AAAA', label: 'Dunkelcyan' },
  { code: '§4', hex: '#AA0000', label: 'Dunkelrot' },
  { code: '§5', hex: '#AA00AA', label: 'Lila' },
  { code: '§6', hex: '#FFAA00', label: 'Gold' },
  { code: '§7', hex: '#AAAAAA', label: 'Grau' },
  { code: '§8', hex: '#555555', label: 'Dunkelgrau' },
  { code: '§9', hex: '#5555FF', label: 'Blau' },
  { code: '§a', hex: '#55FF55', label: 'Grün' },
  { code: '§b', hex: '#55FFFF', label: 'Cyan' },
  { code: '§c', hex: '#FF5555', label: 'Rot' },
  { code: '§d', hex: '#FF55FF', label: 'Magenta' },
  { code: '§e', hex: '#FFFF55', label: 'Gelb' },
  { code: '§f', hex: '#FFFFFF', label: 'Weiß' },
]

export function renderMcText(text: string): React.ReactNode {
  const parts: { text: string; color: string; bold: boolean }[] = []
  let color = '#FFFFFF', bold = false, current = '', i = 0
  while (i < text.length) {
    if (text[i] === '§' && i + 1 < text.length) {
      if (current) parts.push({ text: current, color, bold })
      current = ''
      const c = text[i + 1].toLowerCase()
      const col = MC_COLORS.find(x => x.code === '§' + c)
      if (col) { color = col.hex; bold = false }
      else if (c === 'l') bold = true
      else if (c === 'r') { color = '#FFFFFF'; bold = false }
      i += 2
    } else { current += text[i]; i++ }
  }
  if (current) parts.push({ text: current, color, bold })
  return parts.map((p, idx) => (
    <span key={idx} style={{ color: p.color, fontWeight: p.bold ? 'bold' : 'normal' }}>{p.text}</span>
  ))
}

