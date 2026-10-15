'use client'

// Länder-Steckbrief für GeoGuessr: Merkmale, Schilder, alle Hinweise nach Kategorie – zum Lesen, Abfragen (Texte verdecken),
// Merken (Stern → „Meine Wörter“) und Ausdrucken (Merkblatt).
// Daten: public/geo/gg/laender/<slug>.json (erzeugt von scripts/geo/build-gg.mjs)

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Icon from '../../_components/Icon'
import Flag from '../../_components/Flag'
import { SaveButton } from '../../_components/ItemActions'
import { GG_REGIONEN, loadIndex, loadLand, WERT_FARBE, hellerText, STAERKE, type GgIndex, type GgRegion, type GgSteckbrief } from '../_shared'

const INFO_NAME: Record<string, string> = {
  poller: 'Poller', strommasten: 'Strommasten', google_auto: 'Google-Auto', landschaft: 'Landschaft', kennzeichen: 'Kennzeichen',
  chevron: 'Chevrons', klima: 'Klima', vorwahl: 'Vorwahl & Domain',
}

export default function SteckbriefView({ slug, region = 'europa' }: { slug: string; region?: GgRegion['key'] }) {
  const R = GG_REGIONEN[region]
  const GG_LAENDER = R.laender
  const [land, setLand] = useState<GgSteckbrief | null>(null)
  const [idx, setIdx] = useState<GgIndex | null>(null)
  const [error, setError] = useState('')
  const [kat, setKat] = useState<string | null>(null)
  const [nurStark, setNurStark] = useState(false)
  const [verdeckt, setVerdeckt] = useState(false)
  const [offen, setOffen] = useState<Set<number>>(new Set())
  useEffect(() => {
    let alive = true
    Promise.all([loadLand(slug, R), loadIndex(R)]).then(([l, i]) => { if (alive) { setLand(l); setIdx(i) } }).catch(e => { if (alive) setError(String(e?.message || e)) })
    return () => { alive = false }
  }, [slug, R])

  const pos = GG_LAENDER.findIndex(x => x[0] === slug)
  const prev = GG_LAENDER[(pos - 1 + GG_LAENDER.length) % GG_LAENDER.length]
  const next = GG_LAENDER[(pos + 1) % GG_LAENDER.length]
  const nameOf = (s: string) => GG_LAENDER.find(x => x[0] === s)?.[1] ?? s
  const flagOf = (s: string) => GG_LAENDER.find(x => x[0] === s)?.[2] ?? ''

  const liste = useMemo(() => (land?.hinweise ?? []).map((h, i) => ({ ...h, i })).filter(h => (!kat || h.kat === kat) && (!nurStark || h.staerke === 3)), [land, kat, nurStark])
  const kats = useMemo(() => {
    const m = new Map<string, number>()
    for (const h of land?.hinweise ?? []) m.set(h.kat, (m.get(h.kat) ?? 0) + 1)
    return [...m]
  }, [land])

  return (
    <div className="ga-page ga-gg ga-gg-print" style={{ maxWidth: 1080 }}>
      <div className="ga-row ga-wrap ga-no-print" style={{ justifyContent: 'space-between' }}>
        <Link href={R.path} className="ga-btn ghost sm" style={{ marginLeft: -10 }}><Icon name="back" size={15} /> GeoGuessr {R.name}</Link>
        <span className="ga-row" style={{ gap: 6 }}>
          <Link href={`${R.path}/${prev[0]}`} className="ga-btn ghost sm" title={prev[1]}><Icon name="back" size={14} /> <Flag code={prev[2]} size="sm" /></Link>
          <Link href={`${R.path}/${next[0]}`} className="ga-btn ghost sm" title={next[1]}><Flag code={next[2]} size="sm" /> <Icon name="next" size={14} /></Link>
        </span>
      </div>
      {error && <div className="ga-map-loading"><Icon name="info" /> {error}</div>}
      {!land && !error && <div className="ga-map-loading">Lädt …</div>}
      {land && idx && (
        <>
          <div className="ga-gg-kopf">
            <span className="ga-gg-kopf-flag"><Flag code={land.flag} size="lg" /></span>
            <div>
              <p className="ga-eyebrow">{idx.gruppen[land.gruppe]} · {land.anzahl} Hinweise</p>
              <h1 className="ga-title" style={{ margin: '2px 0 6px' }}>{land.name}</h1>
              <p className="ga-lead" style={{ margin: 0 }}>{land.kurz}</p>
              {land.sprachen.length > 0 && <p className="ga-muted" style={{ margin: '6px 0 0', fontSize: 13.5 }}>Sprache{land.sprachen.length > 1 ? 'n' : ''}: {land.sprachen.join(', ')}</p>}
            </div>
          </div>

          <div className="ga-gg-merkmale">
            {Object.entries(land.merkmale).filter(([, v]) => v).map(([k, v]) => (
              <span key={k} className="ga-gg-merkmal" style={{ '--c': WERT_FARBE[v!] ?? '#888' } as React.CSSProperties}>
                <small>{idx.merkmale[k]?.name ?? k}</small><b className={hellerText(v!) ? 'hell' : ''}>{idx.wertNamen[v!] ?? v}</b>
              </span>
            ))}
          </div>

          {(land.orts.length > 0 || land.zebra.length > 0 || land.strassen.length > 0) && (
            <div className="ga-card ga-gg-schilder">
              {land.orts.length > 0 && <figure><div>{land.orts.map(src => <img key={src} src={src} alt="Ortsschild" />)}</div><figcaption>Ortsschild</figcaption></figure>}
              {land.zebra.length > 0 && <figure><div>{land.zebra.map(src => <img key={src} src={src} alt="Zebrastreifen-Schild" className="zebra" />)}</div><figcaption>Zebrastreifen</figcaption></figure>}
              {land.strassen.length > 0 && <figure><div>{land.strassen.map(s => <img key={s.file} src={s.file} alt={s.text} title={s.art} className="strasse" />)}</div><figcaption>Straßennummern</figcaption></figure>}
            </div>
          )}

          {(land.poller?.length > 0 || land.wegweiser?.length > 0 || land.linien?.length > 0) && (
            <div className="ga-card ga-gg-zeich">
              {land.poller?.length > 0 && (
                <figure className="poller">
                  <div>{land.poller.map(b => <span key={b.file}><img src={b.file} alt={`Poller: ${b.titel}`} /><small>{b.titel}</small></span>)}</div>
                  <figcaption>Poller</figcaption>
                </figure>
              )}
              {land.wegweiser?.length > 0 && (
                <figure className="weg">
                  <div>{land.wegweiser.map(b => <span key={b.file}><img src={b.file} alt={`Wegweiser: ${b.titel}`} /><small>{b.titel}</small></span>)}</div>
                  <figcaption>Wegweiser</figcaption>
                </figure>
              )}
              {land.linien?.length > 0 && (
                <figure className="linien">
                  <div>{land.linien.map(b => <span key={b.file}><img src={b.file} alt={`Fahrbahn: ${b.titel}`} /><small>{b.titel}</small></span>)}</div>
                  <figcaption>Fahrbahn-Linien</figcaption>
                </figure>
              )}
              <p className="ga-muted ga-gg-zeich-note">Eigene Zeichnungen nach den Hinweisen unten – vereinfacht, Entfernungen auf Wegweisern sind Beispiele.</p>
            </div>
          )}

          {land.galerie && idx.galerien && Object.keys(land.galerie).length > 0 && (
            <div className="ga-card ga-gg-zeich sa">
              {idx.galerien.filter(g => land.galerie?.[g.key]?.length).map(g => (
                <figure key={g.key} className={g.key}>
                  <div>{land.galerie![g.key].map(b => <span key={b.file}><img src={b.file} alt={`${g.label}: ${b.titel}`} loading="lazy" /><small>{b.titel}</small></span>)}</div>
                  <figcaption>{g.label} · <Link href={`/geo/quiz/${g.quiz}`}>als Quiz</Link></figcaption>
                </figure>
              ))}
              <p className="ga-muted ga-gg-zeich-note">Eigene Zeichnungen nach den Hinweisen unten – vereinfacht, Kennzeichen-Texte sind Beispiele. Pflanzen: Fotos von Wikimedia Commons.</p>
            </div>
          )}

          {Object.values(land.info).some(Boolean) && (
            <div className="ga-gg-info">
              {Object.entries(land.info).filter(([, v]) => v).map(([k, v]) => (
                <div key={k}><small>{INFO_NAME[k] ?? k}</small><p>{v}</p></div>
              ))}
            </div>
          )}

          <div className="ga-toolbar ga-no-print" style={{ marginTop: 18 }}>
            <div className="ga-chips">
              <button className={`ga-chip sm ${!kat ? 'active' : ''}`} onClick={() => setKat(null)}>Alle ({land.hinweise.length})</button>
              {kats.map(([k, n]) => <button key={k} className={`ga-chip sm ${kat === k ? 'active' : ''}`} onClick={() => setKat(k)}>{idx.kategorien[k] ?? k} ({n})</button>)}
            </div>
          </div>
          <div className="ga-row ga-wrap ga-no-print" style={{ margin: '8px 0 14px' }}>
            <button className={`ga-chip sm ${nurStark ? 'active' : ''}`} onClick={() => setNurStark(x => !x)}><Icon name="bolt" size={13} /> Nur sichere Hinweise</button>
            <button className={`ga-chip sm ${verdeckt ? 'active' : ''}`} onClick={() => { setVerdeckt(x => !x); setOffen(new Set()) }}><Icon name="eye" size={13} /> Abfragen: Texte verdecken</button>
            <Link href={`/geo/quiz/${R.hinweisQuiz}`} className="ga-chip sm"><Icon name="cards" size={13} /> Lernkarten</Link>
            <button className="ga-chip sm" onClick={() => window.print()}><Icon name="copy" size={13} /> Merkblatt drucken</button>
          </div>

          {Object.keys(idx.kategorien).filter(k => liste.some(h => h.kat === k)).map(k => (
            <section key={k} className="ga-gg-kat">
              <h2 className="ga-h3">{idx.kategorien[k]}</h2>
              <ul className="ga-gg-hinweise">
                {liste.filter(h => h.kat === k).map(h => {
                  const zu = verdeckt && !offen.has(h.i)
                  return (
                    <li key={h.i} className={`s${h.staerke}`}>
                      <span className="ga-gg-staerke" title={STAERKE[h.staerke]}>{'●'.repeat(h.staerke)}{'○'.repeat(3 - h.staerke)}</span>
                      <div>
                        <b>{h.titel}</b>
                        {h.region && <span className="ga-badge" style={{ marginLeft: 6 }}>{h.region}</span>}
                        {zu
                          ? <button type="button" className="ga-gg-verdeckt" onClick={() => setOffen(o => new Set(o).add(h.i))}>Antippen zum Aufdecken</button>
                          : <p>{h.text}</p>}
                        {!zu && h.compare && h.compare.length > 0 && (
                          <span className="ga-gg-compare">Vergleiche: {h.compare.map(c => <Link key={c} href={`${R.path}/${c}`}><Flag code={flagOf(c)} size="sm" /> {nameOf(c)}</Link>)}</span>
                        )}
                      </div>
                      <span className="ga-no-print">
                        <SaveButton small word={{ key: `gg:${slug}:${h.i}`, slug: R.hinweisQuiz, quiz: `GeoGuessr ${R.name}`, c: h.titel, a: land.name, sub: h.text, flag: land.flag, at: new Date().toISOString() }} />
                      </span>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
          {!liste.length && <p className="ga-muted">Keine Hinweise für diese Auswahl.</p>}

          <p className="ga-muted ga-gg-quelle">
            Hinweise nach <a href={`https://www.plonkit.net/${slug}`} target="_blank" rel="noopener noreferrer">Plonk It</a> (CC BY-NC-SA 4.0)
            {land.hinweise.some(h => h.src === 's') && <> und dem Guide „GeoGuessr – The Top Tips, Tricks and Techniques“</>} – auf Deutsch neu formuliert, Texte ebenfalls CC BY-NC-SA 4.0.
            {land.hinweise.some(h => h.src === 'a') && <> Vorwahl und Domain: allgemein bekannt (ITU, IANA).</>}
            {' '}Bilder: Wikimedia Commons bzw. eigene Grafiken (<a href={`${R.data}/QUELLEN.txt`} target="_blank" rel="noopener">Quellen</a>).
            {' '}● ● ● = verrät das Land fast sicher · ● ● ○ = engt stark ein · ● ○ ○ = Zusatzhinweis.
          </p>
        </>
      )}
    </div>
  )
}