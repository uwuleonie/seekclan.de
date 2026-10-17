'use client'

// Fenster „alles zu einer Person“: Mitgliedschaften im Clan und alle Einträge aus der Clan-Historie,
// in denen die Person vorkommt (betroffen oder selbst ausgeführt). Genutzt auf /clan, /clan/ex-clan und /clan-history.
// Namen in den Sätzen sind anklickbar und öffnen die andere Person. Styles: app/clan/clan.css (cn-pv-…).

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ART_FARBE, ART_NAME, tageImClan, zeitText, type Eintrag, type Verlauf } from '@/app/lib/clan-historie-def'

type Daten = {
  person: { name: string; imClan: boolean; rang: { anzeige: string; farbe: string } | null; username: string | null; beitrittAkte: string | null; verlauf: Verlauf }
  betrifft: Eintrag[]
  ausgefuehrt: Eintrag[]
}

const datum = (iso: string | null) => (iso ? zeitText({ zeit: iso, genau: false }) : 'vor den Aufzeichnungen')
const WIE: Record<string, string> = { verlassen: 'verlassen', geworfen: 'geworfen', entfernt: 'entfernt' }

/** Satz mit anklickbaren Namen */
export function SatzMitNamen({ e, oeffnen }: { e: Eintrag; oeffnen: (name: string) => void }) {
  const N = ({ n }: { n: string }) => <button type="button" className="cn-name-btn" onClick={() => oeffnen(n)}>{n}</button>
  const von = e.von ? <> von <N n={e.von} /></> : null
  switch (e.art) {
    case 'beigetreten': return e.von ? <><N n={e.spieler} /> wurde{von} in den Clan aufgenommen</> : <><N n={e.spieler} /> ist dem Clan beigetreten</>
    case 'verlassen': return <><N n={e.spieler} /> hat den Clan verlassen</>
    case 'geworfen': return <><N n={e.spieler} /> wurde{von} aus dem Clan geworfen</>
    case 'entfernt': return <><N n={e.spieler} /> wurde{von} aus dem Clan entfernt</>
    case 'befoerdert': return <><N n={e.spieler} /> wurde{von} {e.rang ? <>zum <b>{e.rang}</b> </> : null}befördert</>
    case 'degradiert': return <><N n={e.spieler} /> wurde{von} {e.rang ? <>zum <b>{e.rang}</b> </> : null}degradiert</>
    default: return <><N n={e.spieler} />{e.notiz ? `: ${e.notiz}` : ''}</>
  }
}

/** Eine Zeile im Verlauf */
export function EintragZeile({ e, oeffnen }: { e: Eintrag; oeffnen: (name: string) => void }) {
  return (
    <li className="cn-ev" style={{ '--ev': ART_FARBE[e.art] } as React.CSSProperties}>
      {/* Minecraft-Kopf der Person, Rahmen in der Farbe der Art (beigetreten grün, geworfen rot …) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/player-heads/${encodeURIComponent(e.spieler)}/64?v=2`} alt="" className="cn-ev-kopf" loading="lazy" />
      <div className="cn-ev-text">
        <p><SatzMitNamen e={e} oeffnen={oeffnen} /></p>
        {e.notiz && e.art !== 'sonstiges' && <p className="cn-ev-notiz">{e.notiz}</p>}
      </div>
      <div className="cn-ev-meta">
        <span className="cn-ev-art">{ART_NAME[e.art]}</span>
        <time title={e.genau ? undefined : 'Nur der Tag ist bekannt'}>{zeitText(e)}{e.genau ? '' : ' *'}</time>
      </div>
    </li>
  )
}

export default function PersonVerlauf({ name, schliessen }: { name: string; schliessen: () => void }) {
  const [aktuell, setAktuell] = useState(name)
  const [daten, setDaten] = useState<Daten | null>(null)
  const [fehler, setFehler] = useState('')
  const [zeigeAusgefuehrt, setZeigeAusgefuehrt] = useState(false)

  useEffect(() => { setAktuell(name) }, [name])
  useEffect(() => {
    setDaten(null); setFehler(''); setZeigeAusgefuehrt(false)
    fetch(`/api/clan/historie?person=${encodeURIComponent(aktuell)}`, { cache: 'no-store' })
      .then(r => r.json()).then(d => (d.person ? setDaten(d) : setFehler(d.error || 'Fehler'))).catch(() => setFehler('Verbindung fehlgeschlagen'))
  }, [aktuell])
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') schliessen() }
    window.addEventListener('keydown', esc)
    const alt = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', esc); document.body.style.overflow = alt }
  }, [schliessen])

  const p = daten?.person
  const v = p?.verlauf
  const status = p?.imClan ? 'drin' : v?.zeitraeume.length ? 'raus' : 'nie'

  return (
    <div className="cn-pv-hinter" onClick={schliessen} role="presentation">
      <div className="cn-glass cn-pv" role="dialog" aria-modal="true" aria-label={`Clan-Verlauf von ${aktuell}`} onClick={e => e.stopPropagation()}>
        <button type="button" className="cn-pv-zu" onClick={schliessen} aria-label="Schließen">×</button>
        <header className="cn-pv-kopf">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/player-heads/${encodeURIComponent(p?.name ?? aktuell)}/64?v=2`} alt="" className="cn-head-img" />
          <div>
            <h2>{p?.name ?? aktuell}</h2>
            <div className="cn-pv-chips">
              {status === 'drin' && p?.rang && <span className="cn-pill sm" style={{ '--rc': p.rang.farbe } as React.CSSProperties}>{p.rang.anzeige}</span>}
              {status === 'raus' && <span className="cn-chip">Ehemaliges Mitglied</span>}
              {status === 'nie' && daten && <span className="cn-chip">Nicht im Verlauf als Mitglied</span>}
            </div>
          </div>
        </header>

        {fehler && <p className="cn-pv-leer">{fehler}</p>}
        {!daten && !fehler && <p className="cn-pv-leer">Lädt …</p>}

        {daten && v && (
          <>
            <div className="cn-pv-zahlen">
              <div><b>{v.zeitraeume.length || (p?.imClan ? 1 : 0)}</b><span>{v.zeitraeume.length === 1 ? 'Mitgliedschaft' : 'Mitgliedschaften'}</span></div>
              <div><b>{tageImClan(v) || '–'}</b><span>Tage im Clan (bekannt)</span></div>
              <div><b>{v.hoechsterRang?.replace('Clan-', '') ?? '–'}</b><span>höchster Rang im Verlauf</span></div>
            </div>

            {(v.zeitraeume.length > 0 || p?.beitrittAkte) && (
              <section className="cn-pv-teil">
                <h3>Zeit im Clan</h3>
                <ul className="cn-pv-zeiten">
                  {!v.zeitraeume.length && p?.beitrittAkte && <li><span>{datum(p.beitrittAkte)} – heute</span></li>}
                  {[...v.zeitraeume].reverse().map((z, i) => (
                    <li key={i}>
                      <span>{datum(z.von)} – {z.bis ? datum(z.bis) : 'heute'}</span>
                      {z.wie && <em>{WIE[z.wie]}{z.durch ? ` von ${z.durch}` : ''}</em>}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="cn-pv-teil">
              <h3>Verlauf ({daten.betrifft.length})</h3>
              {daten.betrifft.length ? (
                <ul className="cn-evs">{daten.betrifft.map(e => <EintragZeile key={e.id} e={e} oeffnen={setAktuell} />)}</ul>
              ) : <p className="cn-pv-leer">Keine Einträge.</p>}
            </section>

            {daten.ausgefuehrt.length > 0 && (
              <section className="cn-pv-teil">
                <button type="button" className="cn-pv-auf" onClick={() => setZeigeAusgefuehrt(x => !x)} aria-expanded={zeigeAusgefuehrt}>
                  Von {p?.name} ausgeführt ({daten.ausgefuehrt.length}) {zeigeAusgefuehrt ? '−' : '+'}
                </button>
                {zeigeAusgefuehrt && <ul className="cn-evs">{daten.ausgefuehrt.map(e => <EintragZeile key={e.id} e={e} oeffnen={setAktuell} />)}</ul>}
              </section>
            )}

            <footer className="cn-pv-fuss">
              {p?.username && <Link href={`/${encodeURIComponent(p.username)}`} className="cn-btn">Profil</Link>}
              {p?.imClan && <Link href={`/${encodeURIComponent(p.username ?? p.name)}/abzeichen`} className="cn-btn">Abzeichen</Link>}
              <span className="cn-pv-hinweis">* nur der Tag ist bekannt</span>
            </footer>
          </>
        )}
      </div>
    </div>
  )
}
