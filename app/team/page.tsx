'use client'

// /team – das Team von seekclan.de: alle mit einem Team-Rang (Haken „Team“ unter /admin2/raenge), nach Rang gruppiert.
// Aussehen wie /clan (Glas-Karten, Styles aus app/clan/clan.css, Präfix cn-). Daten: /api/team.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { signatureFont } from '../lib/fonts'
import { zeitSeit } from '../lib/clan-stufen'
import '../clan/clan.css'

type Person = { key: string; name: string; mcName: string; username: string | null; seit: string | null; imClanSeit: string | null; discord_tag: string | null }
type Gruppe = { rang: { id: number; anzeige: string; farbe: string; beschreibung: string | null }; personen: Person[] }

const Svg = ({ d, size = 16 }: { d: React.ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
)
const ICON = {
  back: <path d="m15 18-6-6 6-6" />,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.8.8 3 2.6 3.5 5.2" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
}

export default function TeamPage() {
  const [gruppen, setGruppen] = useState<Gruppe[]>([])
  const [anzahl, setAnzahl] = useState(0)
  const [laedt, setLaedt] = useState(true)

  useEffect(() => {
    fetch('/api/team').then(r => r.json()).then(d => { setGruppen(d.gruppen ?? []); setAnzahl(d.anzahl ?? 0) }).catch(() => {}).finally(() => setLaedt(false))
  }, [])

  return (
    <div className="cn">
      <div className="cn-bg" aria-hidden="true"><span className="cn-blob a" /><span className="cn-blob b" /><span className="cn-blob c" /></div>
      <div className="cn-wrap">
        <Link href="/" className="cn-back"><Svg d={ICON.back} /> Zurück</Link>

        <header className="cn-glass cn-head">
          <div className="cn-head-text">
            <h1 className="cn-title">Das <span className={`cn-sig ${signatureFont.className}`}>Team</span></h1>
            <p className="cn-lead">Die Leute hinter seekclan.de und dem Server – bei Fragen kannst du dich jederzeit an sie wenden.</p>
            {anzahl > 0 && (
              <div className="cn-stats"><span><Svg d={ICON.users} /> {anzahl} {anzahl === 1 ? 'Person' : 'Personen'} im Team</span></div>
            )}
          </div>
          <Link href="/support" className="cn-team-support">Zum Support</Link>
        </header>

        {laedt ? (
          <div className="cn-grid">{[0, 1, 2].map(i => <div key={i} className="cn-glass cn-card skeleton" />)}</div>
        ) : !gruppen.length ? (
          <div className="cn-glass cn-empty">Noch niemand im Team eingetragen.</div>
        ) : (
          <div className="cn-roles">
            {gruppen.map(g => (
              <section key={g.rang.id} className="cn-role" style={{ '--rc': g.rang.farbe } as React.CSSProperties}>
                <div className="cn-role-head">
                  <span className="cn-pill">{g.rang.anzeige}</span>
                  <span className="cn-line" />
                  <span className="cn-count">{g.personen.length} {g.personen.length === 1 ? 'Person' : 'Personen'}</span>
                </div>
                {g.rang.beschreibung && <p className="cn-team-text">{g.rang.beschreibung}</p>}
                <div className="cn-grid">
                  {g.personen.map(p => (
                    <div key={p.key} className="cn-glass cn-card">
                      {p.username && <Link href={`/${p.username}`} className="cn-card-link" aria-label={`Profil von ${p.name}`} />}
                      <div className="cn-card-top">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/api/player-heads/${encodeURIComponent(p.mcName)}/64`} alt={p.name} className="cn-head-img" />
                        <div className="cn-card-name">
                          <b>{p.name}</b>
                          <span className="cn-pill sm">{g.rang.anzeige}</span>
                        </div>
                      </div>
                      <div className="cn-card-info">
                        <span><Svg d={ICON.calendar} size={15} /> {p.seit ? <>{g.rang.anzeige} seit <b>{zeitSeit(p.seit)}</b></> : p.imClanSeit ? <>Im Clan seit <b>{zeitSeit(p.imClanSeit)}</b></> : 'Im Team'}</span>
                      </div>
                      {p.discord_tag && <div className="cn-discord">Discord: {p.discord_tag}</div>}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <p className="cn-team-foot">Alle Clan-Mitglieder findest du auf der <Link href="/clan">Clanliste</Link>.</p>
      </div>
    </div>
  )
}
