'use client'

// /admin2/personen – Personen, Clan & Ränge an EINEM Ort (früher drei Seiten: „Ränge & Personen“, „Clan & Abzeichen“, „Website-Konten“).
//   Personen:  alle Website-Konten, Spieler mit Rang und Clan-Akten. Antippen → Seitenleiste mit allem zu der Person
//              (Rang, Minecraft, Clan-Akte, Abzeichen, Clan-Verlauf, Konto sperren/Passwort/Logins) – _parts/PersonPanel.tsx
//   Clan:      Clan-Liste zum schnellen Bearbeiten (Beitritt, Stufe, Discord), aufnehmen, Freischaltungen – _parts/ClanTabs.tsx
//   Abzeichen: Abzeichen und Kategorien anlegen, an Mitglieder vergeben
//   Historie:  Clan-Verlauf pflegen und alten Verlauf importieren – _parts/Historie.tsx
//   Ränge:     Ränge, Website-Rechte, Minecraft-Prefixe – _parts/RangEditor.tsx
//   Umstellung (nur solange nicht gelaufen, nur Orga) – _parts/Umstellung.tsx
// Rechte: Lesen mit „Admin-Panel ansehen“. Schreiben je Bereich: Ränge vergeben / Ränge bearbeiten / Clan verwalten / Konten verwalten.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../../lib/auth-context'
import { darf } from '@/app/lib/rechte-def'
import type { Person, RangVoll } from './_parts/typen'
import PersonenListe from './_parts/PersonenListe'
import PersonPanel, { type Abzeichen, type Akte } from './_parts/PersonPanel'
import { AbzeichenTab, MitgliederTab } from './_parts/ClanTabs'
import Historie from './_parts/Historie'
import RangEditor from './_parts/RangEditor'
import Umstellung from './_parts/Umstellung'

type Tab = 'personen' | 'clan' | 'abzeichen' | 'historie' | 'raenge' | 'umstellung'
const TABS: { key: Tab; label: string }[] = [
  { key: 'personen', label: '👤 Personen' },
  { key: 'clan', label: '👥 Clan' },
  { key: 'abzeichen', label: '🎖️ Abzeichen' },
  { key: 'historie', label: '📜 Clan-Verlauf' },
  { key: 'raenge', label: '🏅 Ränge & Rechte' },
]
const norm = (u: string | null | undefined) => (u ?? '').replace(/-/g, '').toLowerCase()

export default function PersonenSeite() {
  const { user } = useAuth()
  const istOrga = !!user?.rechte.includes('*')
  const [tab, setTabState] = useState<Tab>('personen')
  const [raenge, setRaenge] = useState<RangVoll[]>([])
  const [personen, setPersonen] = useState<Person[]>([])
  const [akten, setAkten] = useState<Akte[]>([])
  const [abzeichen, setAbzeichen] = useState<Abzeichen[]>([])
  const [laedt, setLaedt] = useState(true)
  const [suche, setSuche] = useState('')
  const [offen, setOffen] = useState<string | null>(null)
  const [umgestellt, setUmgestellt] = useState<boolean | null>(null)
  const [version, setVersion] = useState(0)
  const [meldung, setMeldung] = useState<{ text: string; fehler?: boolean } | null>(null)

  const flash = useCallback((text: string, fehler = false) => {
    setMeldung({ text, fehler })
    setTimeout(() => setMeldung(null), fehler ? 6000 : 3000)
  }, [])

  // Tab aus der Adresse (?tab=clan) – alte Links auf /admin2/raenge, /admin2/clan, /admin2/accounts landen hier
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab') as Tab | null
    if (t && ['personen', 'clan', 'abzeichen', 'historie', 'raenge', 'umstellung'].includes(t)) setTabState(t)
  }, [])
  const setTab = (t: Tab) => {
    setTabState(t)
    const url = new URL(window.location.href)
    url.searchParams.set('tab', t)
    window.history.replaceState(null, '', url)
  }

  const ladeRaenge = useCallback(async () => {
    const r = await fetch('/api/admin2/ranks', { cache: 'no-store' }).then(x => x.json()).catch(() => ({}))
    setRaenge(r.ranks ?? [])
  }, [])
  const ladePersonen = useCallback(async (q: string) => {
    setLaedt(true)
    const [p, a] = await Promise.all([
      fetch(`/api/admin2/personen?alle=1&q=${encodeURIComponent(q.trim())}`, { cache: 'no-store' }).then(x => x.json()).catch(() => ({})),
      fetch('/api/admin2/clan-members', { cache: 'no-store' }).then(x => x.json()).catch(() => ({})),
    ])
    setPersonen(p.personen ?? [])
    setAkten(a.members ?? [])
    setLaedt(false)
  }, [])

  useEffect(() => {
    if (!user) return
    ladeRaenge()
    fetch('/api/admin2/badges', { cache: 'no-store' }).then(r => r.json()).then(d => setAbzeichen(d.badges ?? [])).catch(() => {})
    if (istOrga) fetch('/api/admin2/raenge/umstellung', { cache: 'no-store' }).then(x => x.json()).then(d => setUmgestellt(!!d.umgestellt)).catch(() => setUmgestellt(null))
  }, [user, istOrga, ladeRaenge])
  useEffect(() => {
    if (!user) return
    const t = setTimeout(() => ladePersonen(suche), suche ? 300 : 0)
    return () => clearTimeout(t)
  }, [user, suche, ladePersonen])

  const geaendert = useCallback(() => { ladePersonen(suche); setVersion(v => v + 1) }, [ladePersonen, suche])

  // Ausgewählte Person (immer aus der frisch geladenen Liste) und ihre Clan-Akte
  const person = useMemo(() => personen.find(p => p.key === offen) ?? null, [personen, offen])
  const akte = useMemo(() => {
    if (!person) return null
    return akten.find(a => (person.clanId && a.akteId === person.clanId) || a.key === person.key) ?? null
  }, [person, akten])

  /** Aus der Clan-Liste: Person über Schlüssel, UUID oder Namen finden */
  const oeffnenNachKey = (key: string) => {
    const direkt = personen.find(p => p.key === key)
    if (direkt) { setOffen(direkt.key); return }
    const [art, wert] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)]
    const treffer = personen.find(p => (art === 'mc' && norm(p.uuid) === norm(wert)) || (art === 'cm' && p.clanId === wert) || (art === 'u' && p.userId === wert))
    if (treffer) setOffen(treffer.key)
    else flash('Diese Person ist in der Liste gerade nicht geladen – such sie unter „Personen“', true)
  }

  const zahlen = useMemo(() => ({
    personen: personen.length,
    konten: personen.filter(p => p.userId).length,
    clan: akten.filter(a => a.aktiv).length,
    gesperrt: personen.filter(p => p.gesperrt || p.deaktiviert).length,
  }), [personen, akten])

  const tabs = [...TABS, ...(istOrga && umgestellt === false ? [{ key: 'umstellung' as Tab, label: '⚠️ Umstellung' }] : [])]

  return (
    <div className="max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Personen, Clan & Ränge</h1>
        <p className="text-sm mt-1 max-w-3xl" style={{ color: 'var(--muted)' }}>
          Alles zu Website-Konten, Minecraft-Spielern und dem Clan an einem Ort. Jede Person hat genau einen Rang – er gilt für Website, Spiel,
          <b> /clan</b> und <b>/team</b>. Tipp auf eine Person, um alles zu ihr zu sehen und zu ändern.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {([['Personen', zahlen.personen, '#7C3AED'], ['Website-Konten', zahlen.konten, '#0891B2'], ['Im Clan', zahlen.clan, '#059669'], ['Gesperrt/deaktiviert', zahlen.gesperrt, '#DC2626']] as const).map(([t, z, f]) => (
          <div key={t} className="rounded-2xl p-4" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
            <p className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--muted)' }}>{t}</p>
            <p className="text-2xl font-bold" style={{ color: f }}>{laedt && !personen.length ? '…' : z}</p>
          </div>
        ))}
      </div>

      {istOrga && umgestellt === false && tab !== 'umstellung' && (
        <div className="rounded-xl p-4 text-sm flex flex-wrap items-center gap-3" style={{ background: '#f59e0b1a', border: '1px solid #f59e0b55', color: 'var(--foreground)' }}>
          <span>⚠️ Die Umstellung vom alten System ist noch nicht gelaufen. Bis dahin gelten zusätzlich die alten Website-Rollen.</span>
          <button className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: '#d97706' }} onClick={() => setTab('umstellung')}>Zur Umstellung</button>
        </div>
      )}

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className="px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all"
            style={tab === t.key ? { background: '#7C3AED22', color: '#a78bfa', border: '1px solid #7C3AED55' } : { background: 'var(--muted-bg)', color: 'var(--muted)', border: '1px solid var(--card-border)' }}>
            {t.label}
          </button>
        ))}
      </div>

      {meldung && typeof document !== 'undefined' && createPortal(
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[8700] rounded-xl px-4 py-3 text-sm shadow-xl max-w-[90vw]" style={{ background: meldung.fehler ? '#ef44441a' : '#22c55e1a', color: meldung.fehler ? '#f87171' : '#4ade80', border: `1px solid ${meldung.fehler ? '#ef444455' : '#22c55e55'}` }}>
          {meldung.text}
        </div>,
        document.body
      )}

      {tab === 'personen' && (
        <PersonenListe personen={personen} laedt={laedt} raenge={raenge} suche={suche} setSuche={setSuche}
          oeffnen={p => setOffen(p.key)} ausgewaehlt={offen} neuLaden={geaendert} flash={flash} />
      )}
      {tab === 'clan' && <MitgliederTab key={`clan-${version}`} canWrite={darf(user, 'clan.verwalten')} oeffnen={oeffnenNachKey} />}
      {tab === 'abzeichen' && <AbzeichenTab key={`abz-${version}`} canWrite={darf(user, 'clan.verwalten')} />}
      {tab === 'historie' && <Historie key={`hist-${version}`} canWrite={darf(user, 'clan.verwalten')} />}
      {tab === 'raenge' && <RangEditor raenge={raenge} darfBearbeiten={darf(user, 'raenge.bearbeiten')} istOrga={istOrga} neuLaden={ladeRaenge} flash={flash} />}
      {tab === 'umstellung' && istOrga && <Umstellung flash={flash} fertig={() => { setUmgestellt(true); setTab('personen'); ladeRaenge(); geaendert() }} />}

      {/* Seitenleiste direkt an <body>, damit sie über der Kopfzeile der Website liegt */}
      {person && typeof document !== 'undefined' && createPortal(
        <>
          <div className="fixed inset-0 z-[8500]" style={{ background: '#0008' }} onClick={() => setOffen(null)} aria-hidden="true" />
          <PersonPanel person={person} raenge={raenge} akte={akte} abzeichen={abzeichen}
            schliessen={() => setOffen(null)} geaendert={geaendert} flash={flash} />
        </>,
        document.body
      )}
    </div>
  )
}
