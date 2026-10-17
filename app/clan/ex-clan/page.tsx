'use client'

// /clan/ex-clan – ehemalige Clan-Mitglieder (aus der Clan-Historie und alten Clan-Akten). Daten: /api/clan/ehemalige.
// Karte antippen → Fenster mit dem ganzen Verlauf der Person. Styles: app/clan/clan.css.

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { signatureFont } from '../../lib/fonts'
import { zeitText, type Zeitraum } from '@/app/lib/clan-historie-def'
import ClanNav from '../_parts/ClanNav'
import PersonVerlauf from '../_parts/PersonVerlauf'
import '../clan.css'

type Ehemalig = {
  name: string; zeitraeume: Zeitraum[]; erster: string | null; ende: string | null; wie: 'verlassen' | 'geworfen' | 'entfernt' | null
  durch: string | null; mal: number; tage: number; hoechsterRang: string | null; ohneAustritt: boolean
}
type Sortierung = 'rang' | 'zuletzt' | 'dauer' | 'az'

/** Gruppen nach höchstem Rang im Verlauf – wie auf /clan, höchster zuerst */
const GRUPPEN = [
  { key: 'admin', titel: 'Clan-Administratoren', farbe: '#ef4444' },
  { key: 'mod', titel: 'Clan-Moderatoren', farbe: '#f59e0b' },
  { key: 'mitglied', titel: 'Clan-Mitglieder', farbe: '#14b8a6' },
] as const
const gruppeVon = (r: string | null) => (r?.includes('Admin') ? 'admin' : r?.includes('Mod') ? 'mod' : 'mitglied')

const tag = (iso: string | null) => (iso ? zeitText({ zeit: iso, genau: false }) : '?')
const WIE = { verlassen: { text: 'verlassen', klasse: 'grau' }, geworfen: { text: 'geworfen', klasse: 'rot' }, entfernt: { text: 'entfernt', klasse: 'orange' } }
const RANG_FARBE = (r: string | null) => (r?.includes('Admin') ? '#ef4444' : r?.includes('Mod') ? '#f59e0b' : '#14b8a6')

export default function ExClanPage() {
  const [leute, setLeute] = useState<Ehemalig[]>([])
  const [laedt, setLaedt] = useState(true)
  const [suche, setSuche] = useState('')
  const [wie, setWie] = useState<'alle' | 'verlassen' | 'geworfen'>('alle')
  const [sortierung, setSortierung] = useState<Sortierung>('rang')
  const [offen, setOffen] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/clan/ehemalige', { cache: 'no-store' }).then(r => r.json()).then(d => setLeute(d.ehemalige || [])).finally(() => setLaedt(false))
  }, [])

  const gezeigt = useMemo(() => {
    const q = suche.trim().toLowerCase()
    return leute
      .filter(p => (!q || p.name.toLowerCase().includes(q)) && (wie === 'alle' || p.wie === wie))
      // „Nach Rang“: in jeder Gruppe zuletzt Gegangene zuerst
      .sort((a, b) => sortierung === 'az' ? a.name.localeCompare(b.name) : sortierung === 'dauer' ? b.tage - a.tage : +new Date(b.ende ?? 0) - +new Date(a.ende ?? 0))
  }, [leute, suche, wie, sortierung])

  const geworfen = leute.filter(p => p.wie === 'geworfen').length
  const verlassen = leute.filter(p => p.wie === 'verlassen').length

  /** Karte einer ehemaligen Person (Tippen → ganzer Verlauf) */
  const karte = (p: Ehemalig) => {
    const letzte = p.zeitraeume[p.zeitraeume.length - 1]
    return (
      <button key={p.name} type="button" className="cn-glass cn-card" style={{ '--rc': RANG_FARBE(p.hoechsterRang) } as React.CSSProperties} onClick={() => setOffen(p.name)}>
        <div className="cn-card-top">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/player-heads/${encodeURIComponent(p.name)}/64?v=2`} alt="" className="cn-head-img" style={{ filter: 'grayscale(.35)' }} loading="lazy" />
          <div className="cn-card-name">
            <b>{p.name}</b>
            <div className="cn-ex-zeile">
              {p.wie && <span className={`cn-chip ${WIE[p.wie].klasse}`}>{WIE[p.wie].text}{p.durch ? ` von ${p.durch}` : ''}</span>}
              {!p.wie && <span className="cn-chip">kein Austritt im Verlauf</span>}
              {p.mal > 1 && <span className="cn-chip">{p.mal}× im Clan</span>}
            </div>
          </div>
        </div>
        <div className="cn-ex-zeit">
          <span>Zuletzt: <b>{tag(letzte?.von)} – {letzte?.bis ? tag(letzte.bis) : '?'}</b></span>
          <span>{p.tage ? <><b>{p.tage}</b> Tage im Clan (bekannt)</> : 'Dauer unbekannt'}{p.hoechsterRang ? ` · höchster Rang: ${p.hoechsterRang.replace('Clan-', '')}` : ''}</span>
        </div>
      </button>
    )
  }

  return (
    <div className="cn">
      <div className="cn-bg" aria-hidden="true"><span className="cn-blob a" /><span className="cn-blob b" /><span className="cn-blob c" /></div>
      <div className="cn-wrap">
        <Link href="/clan" className="cn-back">‹ Zum Clan</Link>
        <header className="cn-glass cn-head">
          <div className="cn-head-text">
            <h1 className="cn-title">Ehemalige <span className={`cn-sig ${signatureFont.className}`}>Mitglieder</span></h1>
            <p className="cn-lead">Alle, die mal im seek-Clan waren. Tipp auf eine Person für ihren ganzen Verlauf.</p>
            {leute.length > 0 && (
              <div className="cn-stats">
                <span>{leute.length} ehemalige</span>
                <span>{verlassen} verlassen</span>
                <span>{geworfen} geworfen</span>
              </div>
            )}
            <ClanNav aktiv="ehemalige" />
          </div>
        </header>

        <div className="cn-werkzeug">
          <input className="cn-suche" value={suche} onChange={e => setSuche(e.target.value)} placeholder="Name suchen …" aria-label="Name suchen" />
          <div className="cn-filter" role="group" aria-label="Wie gegangen">
            {(['alle', 'verlassen', 'geworfen'] as const).map(w => (
              <button key={w} type="button" className={wie === w ? 'on' : ''} onClick={() => setWie(w)} aria-pressed={wie === w}>
                {w === 'alle' ? 'Alle' : w === 'verlassen' ? 'Verlassen' : 'Geworfen'}
              </button>
            ))}
          </div>
          <select className="cn-auswahl" value={sortierung} onChange={e => setSortierung(e.target.value as Sortierung)} aria-label="Sortierung">
            <option value="rang">Nach Rang</option>
            <option value="zuletzt">Zuletzt gegangen</option>
            <option value="dauer">Längste Zeit im Clan</option>
            <option value="az">A → Z</option>
          </select>
        </div>

        {laedt ? (
          <div className="cn-grid">{[0, 1, 2, 3, 4, 5].map(i => <div key={i} className="cn-glass cn-card skeleton" />)}</div>
        ) : !gezeigt.length ? (
          <div className="cn-glass cn-empty">{leute.length ? 'Niemand gefunden.' : 'Noch keine ehemaligen Mitglieder eingetragen.'}</div>
        ) : sortierung === 'rang' ? (
          <div className="cn-roles">
            {GRUPPEN.map(g => ({ ...g, leute: gezeigt.filter(p => gruppeVon(p.hoechsterRang) === g.key) })).filter(g => g.leute.length).map(g => (
              <section key={g.key} className="cn-role" style={{ '--rc': g.farbe } as React.CSSProperties}>
                <div className="cn-role-head">
                  <span className="cn-pill">{g.titel}</span>
                  <span className="cn-line" />
                  <span className="cn-count">{g.leute.length} ehemalige</span>
                </div>
                <div className="cn-grid">{g.leute.map(karte)}</div>
              </section>
            ))}
          </div>
        ) : (
          <div className="cn-grid">{gezeigt.map(karte)}</div>
        )}
      </div>
      {offen && <PersonVerlauf name={offen} schliessen={() => setOffen(null)} />}
    </div>
  )
}
