'use client'

// /link/<code> – Ziel des Klick-Links aus /link im Spiel.
//   Eingeloggt   → „Konto X mit Minecraft-Spieler Y verbinden?“ → ein Klick
//   Nicht drin   → Einloggen oder Konto erstellen (Name schon ausgefüllt), danach geht es hierher zurück

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useAuth } from '../../lib/auth-context'

type Info = { minecraft_username: string; minecraft_uuid: string }

export default function LinkPage() {
  const params = useParams<{ code: string }>()
  const code = String(params?.code ?? '')
  const { user, loading, refresh } = useAuth()
  const [info, setInfo] = useState<Info | null>(null)
  const [fehler, setFehler] = useState('')
  const [busy, setBusy] = useState(false)
  const [fertig, setFertig] = useState('')

  useEffect(() => {
    fetch(`/api/minecraft/link?code=${encodeURIComponent(code)}`, { cache: 'no-store' })
      .then(async r => { const d = await r.json().catch(() => ({})); if (r.ok) setInfo(d); else setFehler(d.error || 'Code ungültig') })
      .catch(() => setFehler('Verbindung fehlgeschlagen'))
  }, [code])

  const verbinden = async () => {
    setBusy(true); setFehler('')
    try {
      const r = await fetch('/api/minecraft/link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) setFehler(d.error || 'Fehler')
      else { setFertig(d.minecraft_username); await refresh() }
    } catch { setFehler('Verbindung fehlgeschlagen') }
    setBusy(false)
  }

  const zurueck = `/link/${encodeURIComponent(code)}`
  const kopf = info?.minecraft_username
  const knopf = 'block w-full text-center px-5 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50'
  const knopfStil = { background: 'linear-gradient(135deg, #4F46E5, #7C3AED, #C026D3)' }
  const zweitStil = { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }

  return (
    <div className="max-w-md mx-auto px-4 py-12" style={{ color: 'var(--foreground)' }}>
      <div className="card rounded-2xl p-6 text-center">
        {kopf && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/player-heads/${encodeURIComponent(kopf)}/64`} alt="" className="w-16 h-16 rounded-xl mx-auto mb-4" />
        )}

        {fertig ? (
          <>
            <h1 className="text-2xl font-bold mb-2">Verbunden 🎉</h1>
            <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>Dein Konto ist jetzt mit <b>{fertig}</b> verbunden. Dein Rang und – falls du im Clan bist – deine Clan-Akte sind übernommen.</p>
            <Link href="/" className={knopf} style={knopfStil}>Zur Startseite</Link>
          </>
        ) : !info ? (
          <>
            <h1 className="text-2xl font-bold mb-2">Minecraft verbinden</h1>
            <p className="text-sm mb-6" style={{ color: fehler ? '#EF4444' : 'var(--muted)' }}>{fehler || 'Lädt …'}</p>
            {fehler && <Link href="/verify-account" className={knopf} style={zweitStil}>Zur Anleitung</Link>}
          </>
        ) : loading ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Lädt …</p>
        ) : !user ? (
          <>
            <h1 className="text-2xl font-bold mb-2">Hallo {info.minecraft_username}!</h1>
            <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>Melde dich an oder erstelle ein Konto – danach wird es automatisch mit deinem Minecraft-Account verbunden.</p>
            <div className="space-y-2">
              <Link href={`/login?tab=register&name=${encodeURIComponent(info.minecraft_username)}&redirect=${encodeURIComponent(zurueck)}`} className={knopf} style={knopfStil}>Konto erstellen</Link>
              <Link href={`/login?redirect=${encodeURIComponent(zurueck)}`} className={knopf} style={zweitStil}>Ich habe schon ein Konto</Link>
            </div>
          </>
        ) : user.minecraft_uuid ? (
          <>
            <h1 className="text-2xl font-bold mb-2">Schon verbunden</h1>
            <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
              Dein Konto <b>{user.username}</b> ist schon mit <b>{user.minecraft_username}</b> verbunden.
              {user.minecraft_username?.toLowerCase() !== info.minecraft_username.toLowerCase() && ' Wenn du einen anderen Minecraft-Account verbinden willst, melde dich beim Team.'}
            </p>
            <Link href="/" className={knopf} style={zweitStil}>Zur Startseite</Link>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold mb-2">Konto verbinden?</h1>
            <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
              Website-Konto <b style={{ color: 'var(--foreground)' }}>{user.username}</b> mit Minecraft-Spieler <b style={{ color: 'var(--foreground)' }}>{info.minecraft_username}</b> verbinden?
            </p>
            {fehler && <p className="text-sm mb-4" style={{ color: '#EF4444' }}>{fehler}</p>}
            <button onClick={verbinden} disabled={busy} className={knopf} style={knopfStil}>{busy ? 'Verbinde …' : 'Ja, verbinden'}</button>
            <p className="text-xs mt-4" style={{ color: 'var(--muted)' }}>Nicht dein Minecraft-Account? Dann schließ diese Seite einfach.</p>
          </>
        )}
      </div>
    </div>
  )
}
