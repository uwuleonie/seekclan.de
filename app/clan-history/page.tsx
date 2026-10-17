'use client'

// /clan-history – der ganze Clan-Verlauf: wer wann beigetreten, gegangen, geworfen, befördert oder degradiert wurde.
// Daten: /api/clan/historie (Tabelle clan_historie). Namen antippen → Fenster mit allem zu der Person.
// Styles: app/clan/clan.css.

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { signatureFont } from '../lib/fonts'
import { ARTEN, ART_FARBE, ART_NAME, zeitText, type Art, type Eintrag } from '@/app/lib/clan-historie-def'
import ClanNav from '../clan/_parts/ClanNav'
import PersonVerlauf, { EintragZeile } from '../clan/_parts/PersonVerlauf'
import '../clan/clan.css'

type Antwort = { eintraege: Eintrag[]; gesamt: number; alle: number; seiten: number; jahre: number[]; personen: number; aeltester: string | null }

const tagTitel = (iso: string) => new Date(iso).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Berlin' })
const tagSchluessel = (iso: string) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' })

export default function ClanHistoryPage() {
  const [suche, setSuche] = useState('')
  const [art, setArt] = useState<Art | ''>('')
  const [jahr, setJahr] = useState('')
  const [daten, setDaten] = useState<Antwort | null>(null)
  const [liste, setListe] = useState<Eintrag[]>([])
  const [seite, setSeite] = useState(0)
  const [laedt, setLaedt] = useState(true)
  const [offen, setOffen] = useState<string | null>(null)
  const abfrage = useRef(0)

  const laden = useCallback((s: number) => {
    const nr = ++abfrage.current
    setLaedt(true)
    const q = new URLSearchParams({ seite: String(s) })
    if (suche.trim()) q.set('q', suche.trim())
    if (art) q.set('art', art)
    if (jahr) q.set('jahr', jahr)
    fetch(`/api/clan/historie?${q}`, { cache: 'no-store' }).then(r => r.json()).then((d: Antwort) => {
      if (nr !== abfrage.current) return
      setDaten(d); setSeite(s)
      setListe(alt => (s === 0 ? d.eintraege : [...alt, ...d.eintraege]))
    }).finally(() => { if (nr === abfrage.current) setLaedt(false) })
  }, [suche, art, jahr])

  // Neu laden bei Filterwechsel (Suche kurz verzögert)
  useEffect(() => { const t = setTimeout(() => laden(0), 250); return () => clearTimeout(t) }, [laden])

  // Nach Tagen gruppieren
  const tage: { key: string; titel: string; eintraege: Eintrag[] }[] = []
  for (const e of liste) {
    const k = tagSchluessel(e.zeit)
    const t = tage[tage.length - 1]
    if (t?.key === k) t.eintraege.push(e)
    else tage.push({ key: k, titel: tagTitel(e.zeit), eintraege: [e] })
  }

  return (
    <div className="cn">
      <div className="cn-bg" aria-hidden="true"><span className="cn-blob a" /><span className="cn-blob b" /><span className="cn-blob c" /></div>
      <div className="cn-wrap">
        <Link href="/clan" className="cn-back">‹ Zum Clan</Link>
        <header className="cn-glass cn-head">
          <div className="cn-head-text">
            <h1 className="cn-title">Clan-<span className={`cn-sig ${signatureFont.className}`}>Verlauf</span></h1>
            <p className="cn-lead">Alles, was im seek-Clan passiert ist. Tipp auf einen Namen, um alles zu dieser Person zu sehen.</p>
            {daten && daten.alle > 0 && (
              <div className="cn-stats">
                <span>{daten.alle} Einträge</span>
                <span>{daten.personen} Personen</span>
                {daten.aeltester && <span>seit {zeitText({ zeit: daten.aeltester, genau: false })}</span>}
              </div>
            )}
            <ClanNav aktiv="verlauf" />
          </div>
        </header>

        <div className="cn-werkzeug">
          <input className="cn-suche" value={suche} onChange={e => setSuche(e.target.value)} placeholder="Name suchen …" aria-label="Name suchen" />
          <select className="cn-auswahl" value={jahr} onChange={e => setJahr(e.target.value)} aria-label="Jahr">
            <option value="">Alle Jahre</option>
            {daten?.jahre.map(j => <option key={j} value={j}>{j}</option>)}
          </select>
          <div className="cn-filter" role="group" aria-label="Art">
            <button type="button" className={art === '' ? 'on' : ''} onClick={() => setArt('')} aria-pressed={art === ''}>Alles</button>
            {ARTEN.filter(a => a !== 'sonstiges').map(a => (
              <button key={a} type="button" className={art === a ? 'on' : ''} style={{ '--f': ART_FARBE[a] } as React.CSSProperties} onClick={() => setArt(a)} aria-pressed={art === a}>{ART_NAME[a]}</button>
            ))}
          </div>
        </div>

        {!liste.length ? (
          <div className="cn-glass cn-empty">{laedt ? 'Lädt …' : daten?.alle ? 'Nichts gefunden.' : 'Noch keine Einträge.'}</div>
        ) : (
          <div className="cn-glass cn-liste">
            {tage.map(t => (
              <section key={t.key}>
                <h2 className="cn-tag">{t.titel}</h2>
                <ul className="cn-evs">{t.eintraege.map(e => <EintragZeile key={e.id} e={e} oeffnen={setOffen} />)}</ul>
              </section>
            ))}
            {daten && seite + 1 < daten.seiten && (
              <button type="button" className="cn-mehr" onClick={() => laden(seite + 1)} disabled={laedt}>{laedt ? 'Lädt …' : `Ältere laden (${daten.gesamt - liste.length} weitere)`}</button>
            )}
            <p className="cn-pv-hinweis" style={{ marginTop: 14, textAlign: 'right' }}>* nur der Tag ist bekannt (alte Discord-Liste)</p>
          </div>
        )}
      </div>
      {offen && <PersonVerlauf name={offen} schliessen={() => setOffen(null)} />}
    </div>
  )
}
