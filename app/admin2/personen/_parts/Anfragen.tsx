'use client'

// Clan-Freischaltungen: Leute aus der Clan-Liste, die sich nicht per /link im Spiel verbinden wollen oder können,
// fragen auf /verify-account an. Annehmen = Konto wird mit dem Minecraft-Account der Clan-Akte verbunden (Rang, Akte, Name).

import { useEffect, useState } from 'react'

type Anfrage = {
  id: number; status: string; nachricht: string | null; grund: string | null
  erstelltAm: string; bearbeitetAm: string | null; bearbeitetVon: string | null
  akteName: string; username: string
}

/** Datum + Uhrzeit, z. B. 17.10.26, 14:03 */
const wann = (iso: string) => new Date(iso).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })

const STATUS: Record<string, { text: string; farbe: string }> = {
  angenommen: { text: 'angenommen', farbe: '#4ade80' },
  abgelehnt: { text: 'abgelehnt', farbe: '#f87171' },
  zurueckgezogen: { text: 'zurückgezogen', farbe: '#a1a1aa' },
  erledigt: { text: 'selbst per /link verbunden', farbe: '#60a5fa' },
}

export default function Anfragen({ canWrite, onGeaendert }: { canWrite: boolean; onGeaendert: () => void }) {
  const [offen, setOffen] = useState<Anfrage[]>([])
  const [zuletzt, setZuletzt] = useState<Anfrage[]>([])
  const [fehlt, setFehlt] = useState(false)
  const [busy, setBusy] = useState<number | null>(null)
  const [msg, setMsg] = useState<{ t: string; f?: boolean } | null>(null)
  const [verlauf, setVerlauf] = useState(false)

  const laden = () => fetch('/api/admin2/link-anfragen', { cache: 'no-store' }).then(r => r.json())
    .then(d => { setOffen(d.offen || []); setZuletzt(d.zuletzt || []); setFehlt(!!d.fehlt) }).catch(() => {})
  useEffect(() => { laden() }, [])

  const bearbeiten = async (a: Anfrage, aktion: 'annehmen' | 'ablehnen') => {
    let grund = ''
    if (aktion === 'ablehnen') {
      const g = window.prompt(`Anfrage von ${a.username} ablehnen – Grund (optional, sieht die Person):`, '')
      if (g === null) return
      grund = g
    }
    setBusy(a.id); setMsg(null)
    const r = await fetch('/api/admin2/link-anfragen', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: a.id, aktion, grund }) })
    const d = await r.json().catch(() => ({}))
    setBusy(null)
    if (!r.ok) { setMsg({ t: d.error || 'Fehler', f: true }); return }
    setMsg({ t: aktion === 'annehmen' ? `${a.username} ist jetzt als ${a.akteName} verbunden` : 'Abgelehnt' })
    laden(); if (aktion === 'annehmen') onGeaendert()
  }

  if (fehlt || (!offen.length && !zuletzt.length)) return null

  return (
    <div className="rounded-2xl mb-6 overflow-hidden" style={{ border: '1px solid #c9a84c55', background: '#c9a84c0d' }}>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <h2 className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>🛡️ Clan-Freischaltungen {offen.length > 0 && <span className="ml-1 px-2 py-0.5 rounded-full text-xs" style={{ background: '#c9a84c', color: '#111' }}>{offen.length} offen</span>}</h2>
        {zuletzt.length > 0 && <button onClick={() => setVerlauf(v => !v)} className="text-xs" style={{ color: 'var(--muted)' }}>{verlauf ? 'Verlauf ausblenden' : 'Verlauf zeigen'}</button>}
      </div>
      {msg && <p className="px-4 pb-2 text-sm" style={{ color: msg.f ? '#f87171' : '#4ade80' }}>{msg.t}</p>}
      {!offen.length && <p className="px-4 pb-3 text-sm" style={{ color: 'var(--muted)' }}>Keine offenen Anfragen.</p>}
      {offen.map(a => (
        <div key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3" style={{ borderTop: '1px solid var(--card-border)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/player-heads/${encodeURIComponent(a.akteName)}/64?v=2`} alt="" className="w-8 h-8 rounded-md" />
          <div className="flex-1 min-w-[200px]">
            <p className="text-sm" style={{ color: 'var(--foreground)' }}>
              Konto <b>{a.username}</b> möchte als <b>{a.akteName}</b> freigeschaltet werden
            </p>
            <p className="text-[11px]" style={{ color: 'var(--muted)' }}>{wann(a.erstelltAm)}{a.nachricht ? ` · „${a.nachricht}“` : ''}</p>
          </div>
          {canWrite ? (
            <div className="flex gap-2">
              <button disabled={busy === a.id} onClick={() => bearbeiten(a, 'ablehnen')} className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40" style={{ background: '#ef44441a', color: '#f87171' }}>Ablehnen</button>
              <button disabled={busy === a.id} onClick={() => bearbeiten(a, 'annehmen')} className="px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-40" style={{ background: '#16a34a' }}>{busy === a.id ? '…' : 'Annehmen'}</button>
            </div>
          ) : <span className="text-xs" style={{ color: 'var(--muted)' }}>🔒 nur mit „Clan verwalten“</span>}
        </div>
      ))}
      {verlauf && zuletzt.map(a => (
        <div key={a.id} className="flex flex-wrap items-center gap-2 px-4 py-2 text-xs" style={{ borderTop: '1px solid var(--card-border)', color: 'var(--muted)' }}>
          <span><b style={{ color: 'var(--foreground)' }}>{a.username}</b> → {a.akteName}</span>
          <span style={{ color: STATUS[a.status]?.farbe }}>{STATUS[a.status]?.text ?? a.status}</span>
          {a.bearbeitetVon && !['selbst', 'link'].includes(a.bearbeitetVon) && <span>von {a.bearbeitetVon}</span>}
          {a.grund && <span>· „{a.grund}“</span>}
          {a.bearbeitetAm && <span className="ml-auto">{wann(a.bearbeitetAm)}</span>}
        </div>
      ))}
    </div>
  )
}
