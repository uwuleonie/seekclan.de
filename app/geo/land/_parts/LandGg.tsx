'use client'

// Länderseite → GeoGuessr: das Wichtigste aus dem GG-Steckbrief (Merkmale, Schilder, Poller, Wegweiser, Linien, Galerie)
// und der Link zum ganzen Steckbrief mit allen Hinweisen. Daten: public/geo/gg*/laender/<slug>.json

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Icon from '../../_components/Icon'
import { useGeo } from '../../_components/GeoShell'
import { GG_REGIONEN, loadIndex, loadLand, WERT_FARBE, hellerText, type GgIndex, type GgSteckbrief } from '../../geoguessr/_shared'
import type { LandDaten } from '../../_lib/land'

const INFO_NAME: Record<string, string> = {
  poller: 'Poller', strommasten: 'Strommasten', google_auto: 'Google-Auto', landschaft: 'Landschaft', kennzeichen: 'Kennzeichen',
  chevron: 'Chevrons', klima: 'Klima', vorwahl: 'Vorwahl & Domain',
}

export default function LandGg({ land }: { land: LandDaten }) {
  const { state } = useGeo()
  const abdeckung = state.gg.laender.includes(land.iso)
  const R = land.gg ? GG_REGIONEN[land.gg.region] : null
  const [gg, setGg] = useState<GgSteckbrief | null>(null)
  const [idx, setIdx] = useState<GgIndex | null>(null)
  const [fehler, setFehler] = useState('')

  useEffect(() => {
    if (!land.gg || !R) return
    let alive = true
    Promise.all([loadLand(land.gg.slug, R), loadIndex(R)])
      .then(([l, i]) => { if (alive) { setGg(l); setIdx(i) } })
      .catch(e => { if (alive) setFehler(String(e?.message || e)) })
    return () => { alive = false }
  }, [land.gg, R])

  return (
    <section className="ga-land-sek" id="geoguessr">
      <div className="ga-land-sek-kopf">
        <h2 className="ga-h3">GeoGuessr</h2>
        <span className={`ga-badge ${abdeckung ? 'ga-land-ja' : 'ga-land-nein'}`}>
          <Icon name={abdeckung ? 'check' : 'x'} size={12} /> {abdeckung ? 'Street View in GeoGuessr' : 'keine offizielle Abdeckung'}
        </span>
        <span className="ga-badge kind">Fahrseite: {land.fahrseite}</span>
      </div>

      {!land.gg && (
        <p className="ga-muted" style={{ margin: 0 }}>
          {abdeckung
            ? 'Für dieses Land gibt es noch keinen GeoGuessr-Steckbrief.'
            : 'Hier landest du in GeoGuessr nicht (oder nur auf einzelnen inoffiziellen Bildern).'}
        </p>
      )}
      {fehler && <p className="ga-muted"><Icon name="info" size={14} /> {fehler}</p>}
      {land.gg && !gg && !fehler && <p className="ga-muted">Lädt …</p>}

      {gg && idx && R && (
        <div className="ga-card">
          <p className="ga-lead" style={{ maxWidth: 'none' }}>{gg.kurz}</p>
          <div className="ga-gg-merkmale" style={{ marginTop: 12 }}>
            {Object.entries(gg.merkmale).filter(([, v]) => v).map(([k, v]) => (
              <span key={k} className="ga-gg-merkmal" style={{ '--c': WERT_FARBE[v!] ?? '#888' } as React.CSSProperties}>
                <small>{idx.merkmale[k]?.name ?? k}</small><b className={hellerText(v!) ? 'hell' : ''}>{idx.wertNamen[v!] ?? v}</b>
              </span>
            ))}
          </div>

          {(gg.orts.length > 0 || gg.zebra.length > 0 || gg.strassen.length > 0) && (
            <div className="ga-gg-schilder ga-land-gg-bilder">
              {gg.orts.length > 0 && <figure><div>{gg.orts.map(src => <img key={src} src={src} alt="Ortsschild" />)}</div><figcaption>Ortsschild</figcaption></figure>}
              {gg.zebra.length > 0 && <figure><div>{gg.zebra.map(src => <img key={src} src={src} alt="Zebrastreifen-Schild" className="zebra" />)}</div><figcaption>Zebrastreifen</figcaption></figure>}
              {gg.strassen.length > 0 && <figure><div>{gg.strassen.map(s => <img key={s.file} src={s.file} alt={s.text} title={s.art} className="strasse" />)}</div><figcaption>Straßennummern</figcaption></figure>}
            </div>
          )}

          {(gg.poller?.length > 0 || gg.wegweiser?.length > 0 || gg.linien?.length > 0) && (
            <div className="ga-gg-zeich ga-land-gg-bilder">
              {gg.poller?.length > 0 && <figure className="poller"><div>{gg.poller.map(b => <span key={b.file}><img src={b.file} alt={`Poller: ${b.titel}`} /><small>{b.titel}</small></span>)}</div><figcaption>Poller</figcaption></figure>}
              {gg.wegweiser?.length > 0 && <figure className="weg"><div>{gg.wegweiser.map(b => <span key={b.file}><img src={b.file} alt={`Wegweiser: ${b.titel}`} /><small>{b.titel}</small></span>)}</div><figcaption>Wegweiser</figcaption></figure>}
              {gg.linien?.length > 0 && <figure className="linien"><div>{gg.linien.map(b => <span key={b.file}><img src={b.file} alt={`Fahrbahn: ${b.titel}`} /><small>{b.titel}</small></span>)}</div><figcaption>Fahrbahn-Linien</figcaption></figure>}
            </div>
          )}

          {gg.galerie && idx.galerien && Object.keys(gg.galerie).length > 0 && (
            <div className="ga-gg-zeich sa ga-land-gg-bilder">
              {idx.galerien.filter(g => gg.galerie?.[g.key]?.length).map(g => (
                <figure key={g.key} className={g.key}>
                  <div>{gg.galerie![g.key].map(b => <span key={b.file}><img src={b.file} alt={`${g.label}: ${b.titel}`} loading="lazy" /><small>{b.titel}</small></span>)}</div>
                  <figcaption>{g.label}</figcaption>
                </figure>
              ))}
            </div>
          )}

          {Object.values(gg.info).some(Boolean) && (
            <div className="ga-gg-info" style={{ marginTop: 12 }}>
              {Object.entries(gg.info).filter(([, v]) => v).map(([k, v]) => <div key={k}><small>{INFO_NAME[k] ?? k}</small><p>{v}</p></div>)}
            </div>
          )}

          <div className="ga-row ga-wrap" style={{ marginTop: 14, gap: 8 }}>
            <Link href={`${R.path}/${gg.slug}`} className="ga-btn primary sm"><Icon name="book" size={14} /> Alle {gg.anzahl} Hinweise zu {land.name}</Link>
            <Link href={R.path} className="ga-btn ghost sm">GeoGuessr {R.name}</Link>
          </div>
          <p className="ga-muted" style={{ fontSize: 12, margin: '10px 0 0' }}>
            Hinweise nach Plonk It (CC BY-NC-SA 4.0), auf Deutsch neu formuliert. Zeichnungen: eigene Grafiken.
          </p>
        </div>
      )}
    </section>
  )
}
