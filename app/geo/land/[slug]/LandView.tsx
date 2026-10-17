'use client'

// Länderseite /geo/land/<slug>: alles zu einem Land auf einer Seite – Steckbrief, Karte, Nachbarn, Wirtschaft mit Diagrammen,
// alle Zahlen aus Higher Lower (mit Platz weltweit und Vergleich mit den Nachbarn), GeoGuessr und alle Quizzes.

import { useMemo, useState } from 'react'
import Link from 'next/link'
import Flag from '../../_components/Flag'
import Icon from '../../_components/Icon'
import { LAENDER } from '../../_data/land'
import { KONTINENT_NAME, landHref, type Gliederung, type LandDaten } from '../../_lib/land'
import type { HlLandZeile } from '@/app/lib/geo-hl'
import { Balken, Rang, Ring } from '../_parts/Diagramme'
import LandGg from '../_parts/LandGg'
import LandKarten from '../_parts/LandKarten'
import LandQuizzes from '../_parts/LandQuizzes'

const SLUG: Record<string, string> = Object.fromEntries(LAENDER.map(l => [l[1], l[0]]))
const de = (x: number, d = 1) => x.toLocaleString('de-DE', { maximumFractionDigits: d })
const GRUPPE: Record<HlLandZeile['gruppe'], string> = { ernst: 'Zahlen & Fakten', spass: 'Zum Spaß', absurd: 'Kurioses' }

export default function LandView({ land, hl, quizzes, gliederungen }: { land: LandDaten; hl: HlLandZeile[]; quizzes: string[]; gliederungen: Gliederung[] }) {
  const W = land.wirtschaft
  const zahl = (k: string) => hl.find(z => z.key === k)
  const pos = LAENDER.findIndex(l => l[1] === land.iso)
  const prev = LAENDER[(pos - 1 + LAENDER.length) % LAENDER.length]
  const next = LAENDER[(pos + 1) % LAENDER.length]

  const kurz = ['einwohner', 'flaeche', 'bip', 'bip-kopf', 'lebenserwartung', 'hdi'].map(zahl).filter((z): z is HlLandZeile => !!z)
  const jung = zahl('jugend')?.wert, alt = zahl('senioren')?.wert, stadt = zahl('stadt')?.wert

  const vergleichbar = hl.filter(z => z.vergleich.length > 0)
  const [vk, setVk] = useState(vergleichbar.find(z => z.key === 'bip-kopf')?.key ?? vergleichbar[0]?.key ?? '')
  const vz = hl.find(z => z.key === vk)
  const vergleich = useMemo(() => {
    if (!vz) return []
    return [{ name: land.name, wert: vz.wert, text: vz.text }, ...vz.vergleich.map(v => ({ name: v.name, wert: v.wert, text: v.text, href: SLUG[v.id] ? landHref(SLUG[v.id]) : undefined }))]
      .sort((a, b) => b.wert - a.wert)
  }, [vz, land.name])

  const steck: [string, React.ReactNode][] = [
    ['Hauptstadt', land.hauptstadt],
    ['Kontinent', land.kontinente.map(k => KONTINENT_NAME[k] ?? k).join(' / ')],
    ...(land.staatsform ? [['Staatsform', land.staatsform] as [string, string]] : []),
    ...(land.sprachen.length ? [['Sprachen', land.sprachen.filter((s, i) => s.offiziell || i < 3).map(s => s.name).join(', ')] as [string, string]] : []),
    ...(land.waehrung ? [['Währung', `${land.waehrung.name} (${land.waehrung.code})`] as [string, string]] : []),
    ...(land.vorwahl ? [['Vorwahl', land.vorwahl] as [string, string]] : []),
    ...(land.domain ? [['Domain', land.domain] as [string, string]] : []),
    ...(land.zeitzone ? [['Zeitzone (Hauptstadt)', land.zeitzone] as [string, string]] : []),
    ['Fahrseite', land.fahrseite === 'links' ? 'Linksverkehr' : 'Rechtsverkehr'],
  ]

  return (
    <div className="ga-page ga-land" style={{ maxWidth: 1120 }}>
      <div className="ga-row ga-wrap" style={{ justifyContent: 'space-between' }}>
        <Link href="/geo/laender" className="ga-btn ghost sm" style={{ marginLeft: -10 }}><Icon name="back" size={15} /> Alle Länder</Link>
        <span className="ga-row" style={{ gap: 6 }}>
          <Link href={landHref(prev[0])} className="ga-btn ghost sm" title={prev[2]}><Icon name="back" size={14} /> {prev[3] && <Flag code={prev[3]} size="sm" />}</Link>
          <Link href={landHref(next[0])} className="ga-btn ghost sm" title={next[2]}>{next[3] && <Flag code={next[3]} size="sm" />} <Icon name="next" size={14} /></Link>
        </span>
      </div>

      {/* ── Kopf ── */}
      <div className="ga-land-kopf">
        {land.flag && <span className="ga-land-flagge"><Flag code={land.flag} size="lg" /></span>}
        <div>
          <p className="ga-eyebrow">{land.kontinente.map(k => KONTINENT_NAME[k] ?? k).join(' · ')}</p>
          <h1 className="ga-title" style={{ margin: '2px 0 6px' }}>{land.name}</h1>
          {land.aliases.length > 0 && <p className="ga-muted" style={{ margin: 0, fontSize: 13.5 }}>auch: {land.aliases.join(', ')}</p>}
          <nav className="ga-chips ga-land-sprung">
            <a href="#karte" className="ga-chip sm">Karte</a>
            {(W.sektoren || W.exporte.length > 0) && <a href="#wirtschaft" className="ga-chip sm">Wirtschaft</a>}
            {hl.length > 0 && <a href="#zahlen" className="ga-chip sm">Alle Zahlen</a>}
            <a href="#geoguessr" className="ga-chip sm">GeoGuessr</a>
            <a href="#quizzes" className="ga-chip sm">Quizzes</a>
          </nav>
        </div>
      </div>

      {kurz.length > 0 && (
        <div className="ga-land-kennzahlen">
          {kurz.map(z => (
            <div key={z.key} className="ga-card">
              <small>{z.icon} {z.name}</small>
              <b>{z.text}</b>
              <Rang rang={z.rang} von={z.von} />
            </div>
          ))}
        </div>
      )}

      {/* ── Steckbrief und Karte ── */}
      <div className="ga-land-zwei" id="karte">
        <section className="ga-card ga-land-steck">
          <h2 className="ga-h3">Steckbrief</h2>
          <dl>{steck.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          {(land.sprachen.some(s => s.anteil != null) || land.sprachen.filter((s, i) => s.offiziell || i < 3).length < land.sprachen.length) && (
            <p className="ga-muted ga-land-klein">
              Sprachen: {land.sprachen.map(s => `${s.name}${s.offiziell ? ' (Amtssprache)' : ''}${s.anteil != null ? ` ${de(s.anteil)} %` : ''}`).join(' · ')}
            </p>
          )}
        </section>
        <section className="ga-card ga-land-karte">
          <LandKarten land={land} gliederungen={gliederungen} />
          {land.nachbarn.length > 0 ? (
            <>
              <p className="ga-eyebrow" style={{ margin: '12px 0 8px' }}>{land.nachbarn.length === 1 ? '1 Nachbarland' : `${land.nachbarn.length} Nachbarländer`} · Grenze in km</p>
              <Balken werte={land.nachbarn.map(n => ({ name: n.name, wert: n.km, text: `${de(n.km, 1)} km`, href: SLUG[n.iso] ? landHref(SLUG[n.iso]) : undefined }))} />
            </>
          ) : <p className="ga-muted ga-land-klein">Keine Nachbarländer an Land.</p>}
        </section>
      </div>

      {land.staedte.length > 0 && (
        <section className="ga-land-sek">
          <h2 className="ga-h3">Millionenstädte</h2>
          <div className="ga-chips" style={{ marginTop: 10 }}>
            {land.staedte.map(s => <span key={s.name} className="ga-chip sm static">{s.name}{s.einwohner && <small style={{ marginLeft: 6, opacity: 0.7 }}>{s.einwohner}</small>}</span>)}
          </div>
        </section>
      )}

      {/* ── Wirtschaft ── */}
      {(W.sektoren || W.exporte.length > 0 || W.rohstoffe.length > 0) && (
        <section className="ga-land-sek" id="wirtschaft">
          <div className="ga-land-sek-kopf"><h2 className="ga-h3">Wirtschaft</h2></div>
          <div className="ga-land-raster">
            {W.sektoren && (
              <div className="ga-card">
                <p className="ga-eyebrow">Woher kommt das BIP?{W.sektoren.jahr ? ` · ${W.sektoren.jahr}` : ''}</p>
                <Ring werte={Object.entries(W.sektoren.werte)} mitte={zahl('bip')?.text} />
              </div>
            )}
            {W.verwendung && (
              <div className="ga-card">
                <p className="ga-eyebrow">Wofür wird es ausgegeben?{W.verwendung.jahr ? ` · ${W.verwendung.jahr}` : ''}</p>
                <Balken werte={Object.entries(W.verwendung.werte).map(([name, wert]) => ({ name, wert }))} />
                <p className="ga-muted ga-land-klein">in % des BIP · Importe zählen negativ</p>
              </div>
            )}
            {(W.wachstum || W.inflation || W.schulden) && (
              <div className="ga-card ga-land-mini">
                {W.wachstum && <div><small>Wachstum</small><b className={W.wachstum.wert < 0 ? 'neg' : ''}>{W.wachstum.wert > 0 ? '+' : ''}{de(W.wachstum.wert)} %</b><span>{W.wachstum.jahr}</span></div>}
                {W.inflation && <div><small>Inflation</small><b>{de(W.inflation.wert)} %</b><span>{W.inflation.jahr}</span></div>}
                {W.schulden && <div><small>Staatsschulden</small><b>{de(W.schulden.wert)} %</b><span>des BIP · {W.schulden.jahr}</span></div>}
              </div>
            )}
          </div>
          <div className="ga-land-raster">
            {W.exporte.length > 0 && (
              <div className="ga-card">
                <p className="ga-eyebrow">Wichtigste Exporte{W.exportJahr ? ` · ${W.exportJahr}` : ''}</p>
                <ol className="ga-land-liste">{W.exporte.map(x => <li key={x}>{x}</li>)}</ol>
                {W.exportPartner.length > 0 && <>
                  <p className="ga-eyebrow" style={{ margin: '14px 0 8px' }}>Geht vor allem nach</p>
                  <Balken werte={W.exportPartner.map(p => ({ name: p.name, wert: p.anteil, href: p.iso && SLUG[p.iso] ? landHref(SLUG[p.iso]) : undefined }))} max={100} />
                </>}
              </div>
            )}
            {W.importe.length > 0 && (
              <div className="ga-card">
                <p className="ga-eyebrow">Wichtigste Importe</p>
                <ol className="ga-land-liste">{W.importe.map(x => <li key={x}>{x}</li>)}</ol>
                {W.importPartner.length > 0 && <>
                  <p className="ga-eyebrow" style={{ margin: '14px 0 8px' }}>Kommt vor allem aus</p>
                  <Balken werte={W.importPartner.map(p => ({ name: p.name, wert: p.anteil, href: p.iso && SLUG[p.iso] ? landHref(SLUG[p.iso]) : undefined }))} max={100} />
                </>}
              </div>
            )}
          </div>
          <div className="ga-land-raster">
            {W.rohstoffe.length > 0 && (
              <div className="ga-card">
                <p className="ga-eyebrow">Bodenschätze & Rohstoffe</p>
                <div className="ga-chips" style={{ marginTop: 8 }}>{W.rohstoffe.map(x => <span key={x} className="ga-chip sm static">{x}</span>)}</div>
              </div>
            )}
            {W.agrar.length > 0 && (
              <div className="ga-card">
                <p className="ga-eyebrow">Landwirtschaft: die 10 größten Erzeugnisse</p>
                <div className="ga-chips" style={{ marginTop: 8 }}>{W.agrar.map(x => <span key={x} className="ga-chip sm static">{x}</span>)}</div>
                <p className="ga-muted ga-land-klein">nach Menge (Tonnen)</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Menschen ── */}
      {(jung != null && alt != null) || stadt != null ? (
        <section className="ga-land-sek">
          <div className="ga-land-sek-kopf"><h2 className="ga-h3">Menschen</h2></div>
          <div className="ga-land-raster">
            {jung != null && alt != null && (
              <div className="ga-card">
                <p className="ga-eyebrow">Altersstruktur</p>
                <Ring werte={[['unter 15 Jahre', jung], ['15 bis 64 Jahre', Math.max(0, 100 - jung - alt)], ['65 und älter', alt]]} mitte={zahl('medianalter') ? `Ø ${zahl('medianalter')!.text}` : undefined} />
              </div>
            )}
            {stadt != null && (
              <div className="ga-card">
                <p className="ga-eyebrow">Stadt und Land</p>
                <Ring werte={[['in Städten', stadt], ['auf dem Land', Math.max(0, 100 - stadt)]]} />
              </div>
            )}
          </div>
        </section>
      ) : null}

      {/* ── Vergleich mit den Nachbarn ── */}
      {vz && vergleich.length > 1 && (
        <section className="ga-land-sek">
          <div className="ga-land-sek-kopf">
            <h2 className="ga-h3">Im Vergleich mit den Nachbarn</h2>
            <select className="ga-input ga-land-select" value={vk} onChange={e => setVk(e.target.value)} aria-label="Kategorie">
              {vergleichbar.map(z => <option key={z.key} value={z.key}>{z.icon} {z.name}</option>)}
            </select>
          </div>
          <div className="ga-card">
            <Balken werte={vergleich} hervor={land.name} />
            <p className="ga-muted ga-land-klein">Weltweiter Mittelwert (Median): {vz.medianText} · {land.name}: Platz {vz.rang} von {vz.von}</p>
          </div>
        </section>
      )}

      {/* ── Alle Zahlen ── */}
      {hl.length > 0 && (
        <section className="ga-land-sek" id="zahlen">
          <div className="ga-land-sek-kopf">
            <h2 className="ga-h3">Alle Zahlen</h2>
            <span className="ga-muted" style={{ fontSize: 13 }}>dieselben Werte wie in <Link href="/geo/higher-lower">Higher Lower</Link></span>
          </div>
          {(['ernst', 'spass', 'absurd'] as const).filter(g => hl.some(z => z.gruppe === g)).map(g => (
            <div key={g} className="ga-card ga-land-zahlen">
              <p className="ga-eyebrow">{GRUPPE[g]}</p>
              <table>
                <tbody>
                  {hl.filter(z => z.gruppe === g).map(z => (
                    <tr key={z.key}>
                      <th><span aria-hidden="true">{z.icon}</span> {z.name}</th>
                      <td><b>{z.text}</b>{z.zusatz && <small>{z.zusatz}</small>}</td>
                      <td className="r"><Rang rang={z.rang} von={z.von} /></td>
                      <td className="j"><a href={z.url} target="_blank" rel="noopener noreferrer" title={`Quelle: ${z.quelle}`}>{z.jahr ?? 'Quelle'}</a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </section>
      )}

      <LandGg land={land} />
      <LandQuizzes iso={land.iso} name={land.name} slugs={quizzes} />

      <p className="ga-muted ga-land-quelle">
        Wirtschaft, Handel, Rohstoffe, Sprachen, Staatsform und Grenzen: CIA World Factbook{land.factbook && <> (<a href={`https://github.com/factbook/factbook.json/blob/master/${land.factbook}.json`} target="_blank" rel="noopener noreferrer">Datensatz</a>)</>}, gemeinfrei, eigene Übersetzung.
        {' '}Zahlen: wie bei Higher Lower (Weltbank, CIA, Wikipedia u. a. – Jahr anklicken für die Quelle). Karten: Natural Earth und die Ebenen der Atlas-Quizzes.
        {' '}<Link href="/geo/quellen">Alle Quellen</Link>
      </p>
    </div>
  )
}

