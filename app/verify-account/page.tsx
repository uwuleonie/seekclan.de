'use client'

// /verify-account – Minecraft mit dem Website-Konto verbinden.
//   Weg 1: /link im Spiel → auf den Link im Chat klicken (Seite /link/<code>) – oder den Code hier eintippen.
//   Weg 2 (nur Clan-Mitglieder): Freischaltung durchs Team anfordern (/api/minecraft/anfrage, bearbeitet unter /admin2/clan).
//   ?clan=<Name> füllt den Namen für Weg 2 vor (kommt vom Login, wenn der Name in der Clan-Liste steht).

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '../lib/auth-context'

type Anfrage = { id: number; status: string; akteName: string; grund: string | null; erstelltAm: string }

const nummer = (n: number) => (
  <span className="flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm flex-shrink-0"
    style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED, #C026D3)', color: 'white' }}>{n}</span>
)
const codeStil = { background: 'var(--muted-bg)' }
const feldStil = { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }

export default function VerifyAccountPage() {
  const { user, loading, refresh } = useAuth()
  const [code, setCode] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Clan-Freischaltung
  const [clanName, setClanName] = useState('')
  const [nachricht, setNachricht] = useState('')
  const [anfrage, setAnfrage] = useState<Anfrage | null>(null)
  const [clanFehler, setClanFehler] = useState('')
  const [clanBusy, setClanBusy] = useState(false)
  const [clanOffen, setClanOffen] = useState(false)

  useEffect(() => {
    const vorschlag = new URLSearchParams(window.location.search).get('clan')
    if (vorschlag) { setClanName(vorschlag); setClanOffen(true) }
  }, [])
  useEffect(() => {
    if (!user || user.minecraft_uuid) return
    fetch('/api/minecraft/anfrage', { cache: 'no-store' }).then(r => r.json()).then(d => {
      if (d.anfrage) { setAnfrage(d.anfrage); if (d.anfrage.status === 'offen') setClanOffen(true) }
    }).catch(() => {})
  }, [user])

  const handleLink = async () => {
    setSaving(true); setError(''); setSuccess('')
    try {
      const res = await fetch('/api/minecraft/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Fehler')
      } else {
        setSuccess(`Erfolgreich mit ${json.minecraft_username} verknüpft! 🎉`)
        setCode('')
        refresh()
      }
    } catch {
      setError('Fehler')
    }
    setSaving(false)
  }

  const anfrageSenden = async () => {
    setClanBusy(true); setClanFehler('')
    try {
      const r = await fetch('/api/minecraft/anfrage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: clanName, nachricht }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) setClanFehler(d.error || 'Fehler')
      else { setAnfrage(d.anfrage); setNachricht('') }
    } catch { setClanFehler('Verbindung fehlgeschlagen') }
    setClanBusy(false)
  }

  const zurueckziehen = async () => {
    setClanBusy(true)
    await fetch('/api/minecraft/anfrage', { method: 'DELETE' }).catch(() => {})
    setAnfrage(a => a ? { ...a, status: 'zurueckgezogen' } : a)
    setClanBusy(false)
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12" style={{ color: 'var(--foreground)' }}>
      <p className="text-sm font-semibold mb-2" style={{
        background: 'linear-gradient(135deg, #4F46E5, #7C3AED, #C026D3)',
        WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
        letterSpacing: '0.05em',
      }}>
        ACCOUNT VERKNÜPFEN
      </p>
      <h1 className="text-3xl font-bold mb-3">Minecraft mit deinem Account verbinden</h1>
      <p className="mb-10" style={{ color: 'var(--muted)' }}>
        Erst mit verknüpftem Minecraft-Account kannst du Grundstücke claimen, dein Inventar einsehen und am Tippspiel teilnehmen. Das Verknüpfen dauert weniger als eine Minute.
      </p>

      {!loading && user?.minecraft_uuid ? (
        <div className="card rounded-2xl p-6 mb-10">
          <p className="text-sm font-medium" style={{ color: '#16A34A' }}>
            ✅ Dein Account ist mit <b>{user.minecraft_username}</b> verknüpft.
          </p>
        </div>
      ) : (
        <div className="space-y-4 mb-10">
          <div className="card rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-2">
              {nummer(1)}
              <h2 className="font-bold">Auf den Server gehen</h2>
            </div>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              Noch nie auf dem Server gewesen? Schau dir die <Link href="/join-server" className="underline">Anleitung zum Server-Beitritt</Link> an.
            </p>
          </div>

          <div className="card rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-2">
              {nummer(2)}
              <h2 className="font-bold">Im Chat <code className="px-1.5 py-0.5 rounded" style={codeStil}>/link</code> eingeben</h2>
            </div>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              Chat mit <code className="px-1.5 py-0.5 rounded" style={codeStil}>T</code> öffnen, <code className="px-1.5 py-0.5 rounded" style={codeStil}>/link</code> tippen, Enter.
            </p>
          </div>

          <div className="card rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-2">
              {nummer(3)}
              <h2 className="font-bold">Auf den Link im Chat klicken – fertig</h2>
            </div>
            <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
              Der Link öffnet seekclan.de. Bist du nicht eingeloggt, kannst du dich dort anmelden oder direkt ein Konto erstellen – danach wird automatisch verbunden.
            </p>

            <details>
              <summary className="text-sm cursor-pointer" style={{ color: 'var(--muted)' }}>Link geht nicht? Code von Hand eingeben</summary>
              <div className="mt-3">
                {loading ? (
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>Lädt...</p>
                ) : !user ? (
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>
                    Dafür musst du eingeloggt sein. <Link href="/login?redirect=/verify-account" className="underline">Jetzt einloggen →</Link>
                  </p>
                ) : (
                  <>
                    <div className="flex gap-2 mb-2">
                      <input
                        value={code}
                        onChange={e => setCode(e.target.value.toUpperCase())}
                        maxLength={10}
                        placeholder="XXXXXXXX"
                        className="flex-1 min-w-0 rounded-xl px-4 py-2.5 text-sm outline-none font-mono"
                        style={feldStil}
                      />
                      <button
                        onClick={handleLink}
                        disabled={saving || code.replace(/\s/g, '').length < 6}
                        className="btn-gradient text-white px-6 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
                      >
                        Verknüpfen
                      </button>
                    </div>
                    {error && <p className="text-sm" style={{ color: '#EF4444' }}>{error}</p>}
                    {success && <p className="text-sm" style={{ color: '#16A34A' }}>{success}</p>}
                  </>
                )}
              </div>
            </details>
          </div>

          {/* Clan-Freischaltung */}
          <div className="card rounded-2xl p-6" style={{ borderColor: '#c9a84c55' }}>
            <button onClick={() => setClanOffen(o => !o)} className="w-full flex items-center justify-between gap-3 text-left">
              <h2 className="font-bold">🛡️ Im Clan? Vom Team freischalten lassen</h2>
              <span className="text-sm" style={{ color: 'var(--muted)' }}>{clanOffen ? '−' : '+'}</span>
            </button>
            {clanOffen && (
              <div className="mt-3">
                <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
                  Wenn du in der Clan-Liste stehst, kann das Team dein Konto auch ohne <code className="px-1 rounded" style={codeStil}>/link</code> mit deinem Minecraft-Account verbinden. Das dauert etwas länger, weil jemand die Anfrage prüfen muss.
                </p>
                {loading ? (
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>Lädt...</p>
                ) : !user ? (
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>
                    Dafür musst du eingeloggt sein. <Link href="/login?redirect=/verify-account" className="underline">Einloggen oder Konto erstellen →</Link>
                  </p>
                ) : anfrage?.status === 'offen' ? (
                  <div>
                    <p className="text-sm mb-3">⏳ Deine Anfrage als <b>{anfrage.akteName}</b> wartet auf das Team.</p>
                    <button onClick={zurueckziehen} disabled={clanBusy} className="text-xs underline disabled:opacity-50" style={{ color: 'var(--muted)' }}>Anfrage zurückziehen</button>
                  </div>
                ) : (
                  <div>
                    {anfrage?.status === 'abgelehnt' && (
                      <p className="text-sm mb-3" style={{ color: '#EF4444' }}>Deine letzte Anfrage als {anfrage.akteName} wurde abgelehnt{anfrage.grund ? `: „${anfrage.grund}“` : '.'}</p>
                    )}
                    <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Dein Minecraft-Name (wie in der Clan-Liste)</label>
                    <input value={clanName} onChange={e => setClanName(e.target.value)} placeholder="z. B. uwuleonie" className="w-full rounded-xl px-4 py-2.5 text-sm outline-none mb-3" style={feldStil} />
                    <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Nachricht ans Team (optional)</label>
                    <textarea value={nachricht} onChange={e => setNachricht(e.target.value)} maxLength={500} rows={2} placeholder="z. B. Discord-Name, damit wir dich erkennen" className="w-full rounded-xl px-4 py-2.5 text-sm outline-none mb-3 resize-none" style={feldStil} />
                    {clanFehler && <p className="text-sm mb-3" style={{ color: '#EF4444' }}>{clanFehler}</p>}
                    <button onClick={anfrageSenden} disabled={clanBusy || clanName.trim().length < 3} className="px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #b8902f, #c9a84c)', color: '#111' }}>
                      {clanBusy ? 'Sende …' : 'Freischaltung anfragen'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="rounded-2xl p-8 text-center" style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED, #C026D3)' }}>
        <p className="text-white font-bold mb-1">Code kommt nicht an oder funktioniert nicht?</p>
        <p className="text-white/80 text-sm mb-4">Auf unserem Discord hilft dir die Community gerne weiter.</p>
        <a href="/discord" target="_blank" rel="noopener noreferrer" className="inline-block bg-white px-6 py-2.5 rounded-full font-medium text-sm" style={{ color: '#4F46E5' }}>
          Discord beitreten
        </a>
      </div>
    </div>
  )
}
