// Einfache Diagramme für die Länderseiten – reines SVG/CSS, ohne Bibliothek.

const FARBEN = ['#e9b35f', '#5fb0c9', '#6fcf97', '#ef8a6b', '#a78bda', '#d9c27a', '#7aa6e0', '#c97aa6']

const de = (x: number, d = 1) => x.toLocaleString('de-DE', { maximumFractionDigits: d })

/** Ring-Diagramm mit Legende (Anteile in %) */
export function Ring({ werte, titel, mitte }: { werte: [string, number][]; titel?: string; mitte?: string }) {
  const summe = werte.reduce((s, [, v]) => s + Math.max(0, v), 0) || 1
  const R = 52, U = 2 * Math.PI * R
  const teile = werte.map(([n, v]) => ({ n, len: (Math.max(0, v) / summe) * U }))
  const starts = teile.map((_, i) => teile.slice(0, i).reduce((s, t) => s + t.len, 0))
  return (
    <div className="ga-land-ring">
      <svg viewBox="0 0 140 140" role="img" aria-label={titel ?? werte.map(([n, v]) => `${n} ${de(v)} %`).join(', ')}>
        <circle cx="70" cy="70" r={R} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="22" />
        {teile.map(({ n, len }, i) => (
          <circle key={n} cx="70" cy="70" r={R} fill="none" stroke={FARBEN[i % FARBEN.length]} strokeWidth="22"
            strokeDasharray={`${len} ${U - len}`} strokeDashoffset={-starts[i]} transform="rotate(-90 70 70)" />
        ))}
        {mitte && <text x="70" y="75" textAnchor="middle" className="ga-land-ring-mitte">{mitte}</text>}
      </svg>
      <ul>
        {werte.map(([n, v], i) => (
          <li key={n}><i style={{ background: FARBEN[i % FARBEN.length] }} />{n}<b>{de(v)} %</b></li>
        ))}
      </ul>
    </div>
  )
}

/** Waagerechte Balken (z.B. Handelspartner in %). max = Länge des vollen Balkens */
export function Balken({ werte, einheit = '%', max, hervor }: { werte: { name: string; wert: number; text?: string; href?: string }[]; einheit?: string; max?: number; hervor?: string }) {
  const m = max ?? Math.max(...werte.map(w => Math.abs(w.wert)), 1)
  return (
    <ul className="ga-land-balken">
      {werte.map(w => (
        <li key={w.name} className={w.name === hervor ? 'hervor' : ''}>
          <span className="n">{w.href ? <a href={w.href}>{w.name}</a> : w.name}</span>
          <span className="b"><i style={{ width: `${Math.max(1.5, (Math.abs(w.wert) / m) * 100)}%` }} className={w.wert < 0 ? 'neg' : ''} /></span>
          <b>{w.text ?? `${de(w.wert)}${einheit === '%' ? ' %' : einheit ? ` ${einheit}` : ''}`}</b>
        </li>
      ))}
    </ul>
  )
}

/** Platz weltweit als Leiste: links = höchster Wert, rechts = niedrigster */
export function Rang({ rang, von }: { rang: number; von: number }) {
  const pos = von > 1 ? ((rang - 1) / (von - 1)) * 100 : 0
  return (
    <span className="ga-land-rang" title={`Platz ${rang} von ${von} Ländern`}>
      <span className="leiste"><i style={{ left: `${pos}%` }} /></span>
      <small>Platz {rang} von {von}</small>
    </span>
  )
}
