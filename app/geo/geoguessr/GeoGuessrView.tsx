'use client'

// GeoGuessr Europa, Südamerika und Afrika – Übersicht: Lernkarten & Karten, alle Länder (Steckbriefe), Galerie (Poller, Wegweiser, Linien …),
// Ausschluss-Training, Vergleichstabelle, Vergleiche. Welche Region: Eigenschaft `region` (Daten siehe _shared.ts).
// Inhalte: Fakten aus Plonk It (plonkit.net, CC BY-NC-SA 4.0) und dem älteren GeoGuessr-Guide, auf Deutsch neu formuliert.

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useGeo } from '../_components/GeoShell'
import Icon from '../_components/Icon'
import Flag from '../_components/Flag'
import QuizTile from '../_components/QuizTile'
import { GG_QUIZZES } from '../_content/gg-europa'
import { GG_SA_QUIZZES } from '../_content/gg-suedamerika'
import { GG_AF_QUIZZES } from '../_content/gg-afrika'
import { GG_REGIONEN, loadIndex, WERT_FARBE, hellerText, type GgIndex, type GgLand, type GgRegion } from './_shared'

const LEAD: Record<GgRegion['key'], string> = {
  europa: 'Poller, Kennzeichen, Ortsschilder, Linien, Strommasten und das Google-Auto: Woran erkennst du jedes Land Europas? Steckbriefe zum Nachlesen, Lernkarten zum Auswendiglernen und Training zum Ausschließen.',
  suedamerika: 'Kennzeichen, Taxis, Strommasten, Chevrons, Kilometersteine, Palmen und das Google-Auto: Woran erkennst du Argentinien, Chile, Brasilien, Kolumbien und Co.? Mit eigenen Zeichnungen, Fotos von Pflanzen, Region-Hinweisen und Training zum Ausschließen.',
  afrika: 'Gelbe Randlinien, Linksverkehr, Ghana-Tape, Namibias schiefe Antenne und rote Erde: Woran erkennst du Südafrika, Kenia, Nigeria, Senegal und die anderen GeoGuessr-Länder Afrikas? Steckbriefe, Lernkarten, Region-Hinweise und Training zum Ausschließen.',
}

export default function GeoGuessrView({ region = 'europa' }: { region?: GgRegion['key'] }) {
  const R = GG_REGIONEN[region]
  const QZ = region === 'europa' ? GG_QUIZZES : region === 'afrika' ? GG_AF_QUIZZES : GG_SA_QUIZZES
  const { bySlug } = useGeo()
  const [idx, setIdx] = useState<GgIndex | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { loadIndex(R).then(setIdx).catch(e => setError(String(e?.message || e))) }, [R])
  const tiles = QZ.map(q => bySlug[q.slug]).filter(Boolean)
  const sections = [...new Set(QZ.map(q => q.section!))]

  return (
    <div className="ga-page ga-gg">
      <Link href={R.bereich.href} className="ga-btn ghost sm" style={{ marginLeft: -10 }}><Icon name="back" size={15} /> {R.bereich.name}</Link>
      <p className="ga-eyebrow" style={{ marginTop: 8 }}>{R.name} für GeoGuessr</p>
      <h1 className="ga-title">GeoGuessr <span className="grad">{R.name}</span></h1>
      <p className="ga-lead">{LEAD[region]}</p>
      <div className="ga-row ga-wrap" style={{ marginTop: 14 }}>
        <a href="#laender" className="ga-btn sm"><Icon name="flag" size={15} /> Länder-Steckbriefe</a>
        {region !== 'afrika' && <a href="#galerie" className="ga-btn ghost sm"><Icon name="eye" size={15} /> {region === 'europa' ? 'Poller & Wegweiser' : 'Bilder: Kennzeichen, Taxis, Masten …'}</a>}
        <a href="#ausschluss" className="ga-btn ghost sm"><Icon name="target" size={15} /> Ausschluss-Training</a>
        <a href="#vergleich" className="ga-btn ghost sm"><Icon name="layers" size={15} /> Vergleichstabelle</a>
      </div>

      {sections.map(sec => {
        const es = tiles.filter(e => e.section === sec)
        if (!es.length) return null
        return (
          <section key={sec} className="ga-section">
            <div className="ga-section-head"><div><p className="ga-eyebrow">{es.length} Quizzes</p><h2 className="ga-h2">{sec.replace('GeoGuessr: ', '')}</h2></div></div>
            <div className="ga-tiles">{es.map(e => <QuizTile key={e.slug} entry={e} />)}</div>
          </section>
        )
      })}

      {error && <div className="ga-map-loading"><Icon name="info" /> {error}</div>}
      {!idx && !error && <div className="ga-map-loading">Lädt …</div>}
      {idx && (
        <>
          <section className="ga-section" id="laender" style={{ scrollMarginTop: 90 }}>
            <div className="ga-section-head">
              <div><p className="ga-eyebrow">{idx.laender.length} Länder und Gebiete</p><h2 className="ga-h2">Steckbriefe</h2></div>
              <span className="ga-muted" style={{ fontSize: 13 }}>{idx.laender.reduce((n, l) => n + l.anzahl, 0).toLocaleString('de-DE')} Hinweise</span>
            </div>
            {Object.entries(idx.gruppen).map(([g, gname]) => {
              const ls = idx.laender.filter(l => l.gruppe === g)
              if (!ls.length) return null
              return (
                <div key={g} className="ga-gg-gruppe">
                  <h3 className="ga-h3">{gname}</h3>
                  <div className="ga-gg-laender">
                    {ls.map(l => (
                      <Link key={l.slug} href={`${R.path}/${l.slug}`} className="ga-gg-land">
                        <span className="ga-row" style={{ gap: 8 }}><Flag code={l.flag} size="sm" /><b>{l.name}</b></span>
                        <small>{l.kurz}</small>
                        <span className="ga-gg-land-foot">
                          {(l.orts[0] ?? l.titelbild) && <img src={l.orts[0] ?? l.titelbild!} alt="" loading="lazy" />}
                          <i>{l.anzahl} Hinweise</i>
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )
            })}
          </section>

          {idx.galerien ? <GalerieSA idx={idx} path={R.path} /> : <Galerie idx={idx} />}
          <Ausschluss idx={idx} path={R.path} />
          <Vergleich idx={idx} path={R.path} />

          {idx.vergleiche.length > 0 && (
            <section className="ga-section">
              <div className="ga-section-head"><div><p className="ga-eyebrow">Länder im Vergleich</p><h2 className="ga-h2">Gut zu unterscheiden</h2></div></div>
              <div className="ga-gg-vergleiche">
                {idx.vergleiche.map(v => (
                  <div key={v.titel} className="ga-card ga-gg-vergleich">
                    <b>{v.titel}</b>
                    <p>{v.text}</p>
                    <div className="ga-row ga-wrap" style={{ gap: 6 }}>
                      {v.laender.map(s => {
                        const l = idx.laender.find(x => x.slug === s)
                        return l ? <Link key={s} href={`${R.path}/${s}`} className="ga-gg-mini" title={v.werte[s] ?? l.name}><Flag code={l.flag} size="sm" /> {l.name}{v.werte[s] ? `: ${v.werte[s]}` : ''}</Link> : null
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {idx.sprachErkennung.length > 0 && (
            <section className="ga-section">
              <div className="ga-section-head"><div><p className="ga-eyebrow">Sprache erkennen</p><h2 className="ga-h2">Sonderzeichen verraten das Land</h2></div>
                {region === 'europa' && <Link href="/geo/quiz/lateinische-sonderzeichen" className="ga-btn ghost sm"><Icon name="play" size={14} /> Sonderzeichen-Quiz</Link>}</div>
              <div className="ga-gg-sprachen">
                {idx.sprachErkennung.map(s => (
                  <div key={s.sprache} className="ga-gg-sprache">
                    <b>{s.sprache}</b>
                    {s.zeichen.length > 0 && <span className="ga-gg-zeichen">{s.zeichen.join(' ')}</span>}
                    <small>{s.text}</small>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {region === 'afrika' ? (
        <p className="ga-muted ga-gg-quelle">
          Hinweise nach <a href="https://www.plonkit.net/guide" target="_blank" rel="noopener noreferrer">Plonk It</a> (CC BY-NC-SA 4.0, Stand Oktober 2026) – auf Deutsch neu formuliert,
          diese Texte stehen ebenfalls unter CC BY-NC-SA 4.0. <a href={`${R.data}/QUELLEN.txt`} target="_blank" rel="noopener">Alle Quellen</a>.
        </p>
      ) : region === 'suedamerika' ? (
        <p className="ga-muted ga-gg-quelle">
          Hinweise nach <a href="https://www.plonkit.net/guide" target="_blank" rel="noopener noreferrer">Plonk It</a> (CC BY-NC-SA 4.0) – auf Deutsch neu formuliert,
          diese Texte stehen ebenfalls unter CC BY-NC-SA 4.0. Kennzeichen, Taxis, Masten, Poller, Schilder, Zäune und Linien sind eigene Zeichnungen,
          Pflanzen-Fotos von Wikimedia Commons. <a href={`${R.data}/QUELLEN.txt`} target="_blank" rel="noopener">Alle Quellen</a>.
        </p>
      ) : (
      <p className="ga-muted ga-gg-quelle">
        Hinweise nach <a href="https://www.plonkit.net/guide" target="_blank" rel="noopener noreferrer">Plonk It</a> (CC BY-NC-SA 4.0) und dem Guide
        {' '}<a href="https://somerandomstuff1.wordpress.com/2019/02/08/geoguessr-the-top-tips-tricks-and-techniques/" target="_blank" rel="noopener noreferrer">„GeoGuessr – The Top Tips, Tricks and Techniques“</a> –
        auf Deutsch neu formuliert, diese Texte stehen ebenfalls unter CC BY-NC-SA 4.0. Verkehrszeichen von Wikimedia Commons, Straßennummern als eigene Grafiken.
        {' '}<a href="/geo/gg/QUELLEN.txt" target="_blank" rel="noopener">Alle Quellen</a>.
      </p>
      )}
    </div>
  )
}

/* ───────────── Ausschluss-Training ───────────── */

const TRAIN_KEYS = ['fahrseite', 'schrift', 'kennzeichen_hinten', 'eu_streifen', 'ortsschild_hintergrund', 'wegweiser', 'mittellinie', 'linienfarbe', 'zebrastreifen_schild']

/* ───────────── Galerie: alle Poller, Wegweiser und Fahrbahn-Linien ───────────── */

const GALERIE = [
  { key: 'poller', label: 'Poller', quiz: 'gg-poller', text: 'Alle Poller auf einen Blick – tippe auf einen, um zum Land zu kommen.' },
  { key: 'wegweiser', label: 'Wegweiser', quiz: 'gg-wegweiser', text: 'Farbe, Form und Schrift der Wegweiser. Ortsnamen sind echte Orte, Entfernungen Beispiele.' },
  { key: 'linien', label: 'Fahrbahn-Linien', quiz: 'gg-linien-karte', text: 'Ein Stück Landstraße von oben: Mittellinie und Randlinien, so wie die Quellen sie beschreiben.' },
] as const

function Galerie({ idx }: { idx: GgIndex }) {
  const [art, setArt] = useState<(typeof GALERIE)[number]['key']>('poller')
  const [verdeckt, setVerdeckt] = useState(false)
  const g = GALERIE.find(x => x.key === art)!
  const bilder = idx.laender.flatMap(l => (l[art] ?? []).map((b, i) => ({ l, b, i })))
  return (
    <section className="ga-section" id="galerie" style={{ scrollMarginTop: 90 }}>
      <div className="ga-section-head">
        <div><p className="ga-eyebrow">Eigene Zeichnungen</p><h2 className="ga-h2">Poller, Wegweiser & Linien</h2></div>
        <div className="ga-row ga-wrap" style={{ gap: 6 }}>
          <div className="ga-seg" role="group" aria-label="Art">
            {GALERIE.map(x => <button key={x.key} className={art === x.key ? 'active' : ''} onClick={() => setArt(x.key)}>{x.label}</button>)}
          </div>
          <button className={`ga-chip sm ${verdeckt ? 'active' : ''}`} onClick={() => setVerdeckt(v => !v)}><Icon name="eye" size={13} /> Länder verdecken</button>
          <Link href={`/geo/quiz/${g.quiz}`} className="ga-btn ghost sm"><Icon name="play" size={14} /> Als Quiz</Link>
        </div>
      </div>
      <p className="ga-muted" style={{ margin: '-4px 0 12px', fontSize: 13.5 }}>{g.text}</p>
      <div className={`ga-gg-galerie ${art}`}>
        {bilder.map(({ l, b, i }) => (
          <Link key={`${l.slug}-${i}`} href={`/geo/geoguessr/${l.slug}`} className="ga-gg-galerie-item" title={verdeckt ? undefined : b.titel}>
            <img src={b.file} alt={verdeckt ? `${g.label}` : `${g.label} ${l.name}: ${b.titel}`} loading="lazy" />
            {verdeckt
              ? <span className="ga-gg-galerie-name verdeckt">?</span>
              : <span className="ga-gg-galerie-name"><Flag code={l.flag} size="sm" /> {l.name}</span>}
          </Link>
        ))}
      </div>
    </section>
  )
}

/* ───────────── Galerie Südamerika: Arten aus index.json (galerien), Bilder je Land (galerie) ───────────── */

function GalerieSA({ idx, path }: { idx: GgIndex; path: string }) {
  const arten = idx.galerien ?? []
  const [art, setArt] = useState(arten[0]?.key ?? '')
  const [verdeckt, setVerdeckt] = useState(false)
  const g = arten.find(x => x.key === art) ?? arten[0]
  if (!g) return null
  // Ein Bild (z. B. Foto einer Pflanze) kann zu mehreren Ländern gehören – in der Galerie nur einmal zeigen
  const bilder = idx.laender.flatMap(l => (l.galerie?.[g.key] ?? []).map((b, i) => ({ l, b, i }))).filter((x, i, all) => all.findIndex(y => y.b.file === x.b.file) === i)
  return (
    <section className="ga-section" id="galerie" style={{ scrollMarginTop: 90 }}>
      <div className="ga-section-head">
        <div><p className="ga-eyebrow">Eigene Zeichnungen & Fotos</p><h2 className="ga-h2">Bilder-Galerie</h2></div>
        <div className="ga-row ga-wrap" style={{ gap: 6 }}>
          <button className={`ga-chip sm ${verdeckt ? 'active' : ''}`} onClick={() => setVerdeckt(v => !v)}><Icon name="eye" size={13} /> Länder verdecken</button>
          <Link href={`/geo/quiz/${g.quiz}`} className="ga-btn ghost sm"><Icon name="play" size={14} /> Als Quiz</Link>
        </div>
      </div>
      <div className="ga-chips" style={{ marginBottom: 10 }}>
        {arten.map(x => <button key={x.key} className={`ga-chip sm ${art === x.key ? 'active' : ''}`} onClick={() => setArt(x.key)}>{x.label}</button>)}
      </div>
      <p className="ga-muted" style={{ margin: '0 0 12px', fontSize: 13.5 }}>{g.text}</p>
      <div className={`ga-gg-galerie sa ${g.key}`}>
        {bilder.map(({ l, b, i }) => (
          <Link key={`${l.slug}-${b.file}-${i}`} href={`${path}/${l.slug}`} className="ga-gg-galerie-item">
            <img src={b.file} alt={verdeckt ? g.label : `${g.label} ${l.name}: ${b.titel}`} loading="lazy" />
            {verdeckt
              ? <span className="ga-gg-galerie-name verdeckt">?</span>
              : <>
                <span className="ga-gg-galerie-name"><Flag code={l.flag} size="sm" /> {l.name}</span>
                <small className="ga-gg-galerie-titel">{b.titel}</small>
              </>}
          </Link>
        ))}
      </div>
    </section>
  )
}

function Ausschluss({ idx, path }: { idx: GgIndex; path: string }) {
  const [sel, setSel] = useState<Record<string, string>>({})
  const [mode, setMode] = useState<'filter' | 'train'>('filter')
  const wn = (v: string) => idx.wertNamen[v] ?? v
  const passt = (l: GgLand, k: string, v: string) => l.merkmale[k] === v || l.merkmale[k] === 'gemischt'
  const keys = (idx.trainKeys ?? TRAIN_KEYS).filter(k => idx.merkmale[k])

  // Filter
  const rest = useMemo(() => {
    const sicher: GgLand[] = [], unklar: GgLand[] = [], raus: GgLand[] = []
    for (const l of idx.laender) {
      const ks = Object.entries(sel)
      if (ks.some(([k, v]) => l.merkmale[k] && !passt(l, k, v))) raus.push(l)
      else if (ks.some(([k]) => !l.merkmale[k])) unklar.push(l)
      else sicher.push(l)
    }
    return { sicher, unklar, raus }
  }, [sel, idx]) // eslint-disable-line react-hooks/exhaustive-deps

  // Training: drei bekannte Merkmale eines Landes – welche Länder bleiben übrig?
  const [aufgabe, setAufgabe] = useState<{ land: GgLand; werte: [string, string][] } | null>(null)
  const [wahl, setWahl] = useState<Set<string>>(new Set())
  const [geprueft, setGeprueft] = useState(false)
  const [punkte, setPunkte] = useState({ richtig: 0, runden: 0 })
  function neueAufgabe() {
    const kandidaten = idx.laender.filter(l => keys.filter(k => l.merkmale[k] && l.merkmale[k] !== 'gemischt').length >= 3)
    const land = kandidaten[Math.floor(Math.random() * kandidaten.length)]
    const ks = keys.filter(k => land.merkmale[k] && land.merkmale[k] !== 'gemischt').sort(() => Math.random() - 0.5).slice(0, 3)
    setAufgabe({ land, werte: ks.map(k => [k, land.merkmale[k]!]) })
    setWahl(new Set())
    setGeprueft(false)
  }
  const loesung = useMemo(() => new Set(aufgabe ? idx.laender.filter(l => aufgabe.werte.every(([k, v]) => l.merkmale[k] && passt(l, k, v))).map(l => l.slug) : []), [aufgabe, idx]) // eslint-disable-line react-hooks/exhaustive-deps
  function pruefen() {
    setGeprueft(true)
    const ok = loesung.size === wahl.size && [...wahl].every(s => loesung.has(s))
    setPunkte(p => ({ richtig: p.richtig + (ok ? 1 : 0), runden: p.runden + 1 }))
  }

  return (
    <section className="ga-section" id="ausschluss" style={{ scrollMarginTop: 90 }}>
      <div className="ga-section-head">
        <div><p className="ga-eyebrow">Wie ein Profi denken</p><h2 className="ga-h2">Ausschluss-Training</h2></div>
        <div className="ga-seg" role="group" aria-label="Modus">
          <button className={mode === 'filter' ? 'active' : ''} onClick={() => setMode('filter')}><Icon name="layers" size={14} /> Filter</button>
          <button className={mode === 'train' ? 'active' : ''} onClick={() => { setMode('train'); if (!aufgabe) neueAufgabe() }}><Icon name="target" size={14} /> Training</button>
        </div>
      </div>
      {mode === 'filter' ? (
        <div className="ga-card ga-gg-filter">
          <p className="ga-muted" style={{ margin: '0 0 10px', fontSize: 13.5 }}>Wähle, was du in der Runde siehst – übrig bleiben die Länder, die dazu passen.</p>
          {keys.map(k => (
            <div key={k} className="ga-gg-filter-row">
              <span>{idx.merkmale[k].name}</span>
              <div className="ga-chips">
                {idx.merkmale[k].werte.filter(v => v !== 'gemischt').map(v => (
                  <button key={v} className={`ga-chip sm ${sel[k] === v ? 'active' : ''}`} onClick={() => setSel(s => { const n = { ...s }; if (n[k] === v) delete n[k]; else n[k] = v; return n })}>
                    <i className="ga-gg-dot" style={{ background: WERT_FARBE[v] ?? '#888' }} /> {wn(v)}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="ga-row ga-wrap" style={{ justifyContent: 'space-between', margin: '12px 0 6px' }}>
            <b>{Object.keys(sel).length ? `${rest.sicher.length} Länder passen` : 'Noch nichts gewählt – alle Länder möglich'}</b>
            {Object.keys(sel).length > 0 && <button className="ga-btn ghost sm" onClick={() => setSel({})}><Icon name="refresh" size={14} /> Zurücksetzen</button>}
          </div>
          <div className="ga-gg-flaggen">
            {rest.sicher.map(l => <Link key={l.slug} href={`${path}/${l.slug}`} className="ga-gg-mini"><Flag code={l.flag} size="sm" /> {l.name}</Link>)}
          </div>
          {rest.unklar.length > 0 && Object.keys(sel).length > 0 && (
            <>
              <p className="ga-muted" style={{ fontSize: 12.5, margin: '10px 0 4px' }}>Ohne Angabe zu einem gewählten Merkmal (nicht ausgeschlossen):</p>
              <div className="ga-gg-flaggen dim">{rest.unklar.map(l => <Link key={l.slug} href={`${path}/${l.slug}`} className="ga-gg-mini"><Flag code={l.flag} size="sm" /> {l.name}</Link>)}</div>
            </>
          )}
        </div>
      ) : aufgabe && (
        <div className="ga-card ga-gg-filter">
          <p className="ga-muted" style={{ margin: '0 0 8px', fontSize: 13.5 }}>
            Du siehst diese drei Dinge. Tippe ALLE Länder an, die dazu passen – dann „Prüfen“. Länder ohne Angabe zählen nicht.
            {punkte.runden > 0 && <b> · {punkte.richtig} von {punkte.runden} Runden perfekt</b>}
          </p>
          <div className="ga-row ga-wrap" style={{ gap: 8, marginBottom: 12 }}>
            {aufgabe.werte.map(([k, v]) => (
              <span key={k} className="ga-gg-merkmal" style={{ '--c': WERT_FARBE[v] ?? '#888' } as React.CSSProperties}>
                <small>{idx.merkmale[k].name}</small><b className={hellerText(v) ? 'hell' : ''}>{wn(v)}</b>
              </span>
            ))}
          </div>
          <div className="ga-gg-flaggen">
            {idx.laender.map(l => {
              const an = wahl.has(l.slug), soll = loesung.has(l.slug)
              const cls = geprueft ? (soll && an ? 'ok' : soll ? 'fehlt' : an ? 'falsch' : 'dim') : an ? 'an' : ''
              return (
                <button key={l.slug} type="button" className={`ga-gg-mini pick ${cls}`} disabled={geprueft}
                  onClick={() => setWahl(w => { const n = new Set(w); if (n.has(l.slug)) n.delete(l.slug); else n.add(l.slug); return n })}>
                  <Flag code={l.flag} size="sm" /> {l.name}
                </button>
              )
            })}
          </div>
          <div className="ga-row ga-wrap" style={{ marginTop: 12 }}>
            {!geprueft
              ? <button className="ga-btn primary" onClick={pruefen} disabled={!wahl.size}>Prüfen</button>
              : <>
                <span className={loesung.size === wahl.size && [...wahl].every(s => loesung.has(s)) ? 'ga-task-reveal' : 'ga-task-warn'} style={{ margin: 0 }}>
                  {loesung.size === wahl.size && [...wahl].every(s => loesung.has(s)) ? 'Perfekt!' : `Richtig wären ${loesung.size} Länder (grün = richtig, gelb = vergessen, rot = falsch).`}
                </span>
                <button className="ga-btn primary" onClick={neueAufgabe}>Nächste Runde <Icon name="next" size={15} /></button>
              </>}
          </div>
        </div>
      )}
    </section>
  )
}

/* ───────────── Vergleichstabelle ───────────── */

function Vergleich({ idx, path }: { idx: GgIndex; path: string }) {
  const bildSpalte = idx.laender.some(l => l.orts[0]) ? 'Ortsschild' : 'Kennzeichen'
  const [gruppe, setGruppe] = useState<string | null>(null)
  const keys = Object.keys(idx.merkmale)
  const ls = idx.laender.filter(l => !gruppe || l.gruppe === gruppe)
  return (
    <section className="ga-section" id="vergleich" style={{ scrollMarginTop: 90 }}>
      <div className="ga-section-head">
        <div><p className="ga-eyebrow">Alles auf einen Blick</p><h2 className="ga-h2">Vergleichstabelle</h2></div>
      </div>
      <div className="ga-chips" style={{ marginBottom: 10 }}>
        <button className={`ga-chip sm ${!gruppe ? 'active' : ''}`} onClick={() => setGruppe(null)}>Alle</button>
        {Object.entries(idx.gruppen).map(([g, n]) => <button key={g} className={`ga-chip sm ${gruppe === g ? 'active' : ''}`} onClick={() => setGruppe(g)}>{n}</button>)}
      </div>
      <div className="ga-card ga-gg-tabelle-wrap">
        <table className="ga-gg-tabelle">
          <thead>
            <tr><th>Land</th>{keys.map(k => <th key={k}>{idx.merkmale[k].name}</th>)}<th>{bildSpalte}</th></tr>
          </thead>
          <tbody>
            {ls.map(l => (
              <tr key={l.slug}>
                <th><Link href={`${path}/${l.slug}`}><Flag code={l.flag} size="sm" /> {l.name}</Link></th>
                {keys.map(k => {
                  const v = l.merkmale[k]
                  return <td key={k}>{v ? <span className={`ga-gg-wert ${hellerText(v) ? 'hell' : ''}`} style={{ '--c': WERT_FARBE[v] ?? '#888' } as React.CSSProperties}>{idx.wertNamen[v] ?? v}</span> : <span className="ga-muted">–</span>}</td>
                })}
                <td>{(l.orts[0] ?? l.titelbild) ? <img src={l.orts[0] ?? l.titelbild!} alt="" loading="lazy" className="ga-gg-tab-img" /> : <span className="ga-muted">–</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="ga-muted" style={{ fontSize: 12 }}>„–“ heißt: steht nicht in den Quellen. „gemischt“: es gibt mehrere Varianten im Land.</p>
    </section>
  )
}