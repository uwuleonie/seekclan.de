'use client'

// Higher Lower – Mehrspieler-Raum
// Warteraum (Einladungslink, wer ist da, Einstellungen, Topf) → Spiel → Endstand.
// Duell: jeder spielt dieselben Paare, Live-Tafel daneben, wer am weitesten kommt, gewinnt (und den Topf).
// Team: eine gemeinsame Runde, reihum ist jemand dran, die anderen schlagen vor. Alle bekommen dasselbe.
// Der Stand wird jede Sekunde abgefragt (/api/geo/hl?raum=<id>).

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useGeo } from '../../../_components/GeoShell'
import Icon from '../../../_components/Icon'
import { HL_KATEGORIEN, HL_REGIONEN, type HlGruppe } from '../../../_data/hl'
import { HL_ART_NAME, HL_STUFEN, HL_STUFE_NAME, MIX, type HlArt } from '../../../_lib/hl'
import HlSpiel from '../../HlSpiel'
import type { HlInfo, RaumSpieler, RaumZustand } from '../../typen'

const GRUPPE: Record<HlGruppe, string> = { ernst: 'Wissen', spass: 'Spaß', absurd: 'Absurd' }

async function post(body: Record<string, unknown>) {
  const r = await fetch('/api/geo/hl', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error || 'Fehler')
  return d
}

export default function RaumView({ id }: { id: string }) {
  const router = useRouter()
  const { loggedIn, loaded, reloadProfile, klang } = useGeo()
  const [st, setSt] = useState<RaumZustand | null>(null)
  const [info, setInfo] = useState<HlInfo | null>(null)
  const [fehler, setFehler] = useState('')
  const [kopiert, setKopiert] = useState(false)
  const [busy, setBusy] = useState(false)
  // Runde, die ich gerade spiele (bleibt sichtbar, bis das Spielfeld selbst „fertig“ meldet – sonst fehlt die letzte Auflösung)
  const [lief, setLief] = useState<string | null>(null)
  const [ichFertig, setIchFertig] = useState<string | null>(null)
  const beigetreten = useRef(false)
  const [link, setLink] = useState('')

  // Einstellungen (Grenzen, Bonus-Stufen) für das Spielfeld
  useEffect(() => {
    let alive = true
    fetch('/api/geo/hl', { cache: 'no-store' }).then(r => r.json()).then(d => { if (alive && d.config) setInfo(d) }).catch(() => {})
    const t = setTimeout(() => { if (alive) setLink(window.location.href) }, 0)
    return () => { alive = false; clearTimeout(t) }
  }, [])

  // Stand abfragen: sofort, dann jede Sekunde (im Hintergrund-Tab seltener)
  useEffect(() => {
    if (!loggedIn) return
    let alive = true
    let t: ReturnType<typeof setTimeout>
    const holen = async () => {
      try {
        const r = await fetch(`/api/geo/hl?raum=${encodeURIComponent(id)}`, { cache: 'no-store' })
        const d = await r.json()
        if (!alive) return
        if (!r.ok) setFehler(d.error || 'Raum nicht gefunden')
        else if (d.gesperrt) {
          setFehler(`Higher Lower startet erst am ${new Date(d.gesperrt).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })} Uhr`)
          return
        } else {
          setSt(d)
          if (d.ichDrin && d.meineRunde?.status === 'laeuft') setLief(d.meineRunde.id)
          // Noch nicht drin und Warteraum → einmal automatisch beitreten
          if (!d.ichDrin && d.raum.status === 'lobby' && !beigetreten.current) {
            beigetreten.current = true
            post({ action: 'raum-beitreten', raum: id }).then(x => { if (alive) setSt(x) }).catch(e => { if (alive) setFehler(e.message) })
          }
        }
      } catch { /* nächster Versuch */ }
      if (alive) t = setTimeout(holen, document.hidden ? 4000 : 1000)
    }
    holen()
    return () => { alive = false; clearTimeout(t) }
  }, [loggedIn, id])

  // Endstand: Sieger-Fanfare (Duell gewonnen) bzw. kurzer Jubel fürs Team
  const status = st?.raum.status
  const gewinnerIch = !!st?.raum.ergebnis?.sieger?.includes(st.spieler.find(p => p.me)?.id ?? '-')
  const modusJetzt = st?.raum.modus
  const warStatus = useRef(status)
  useEffect(() => {
    if (status === 'fertig' && warStatus.current === 'laeuft') {
      if (modusJetzt === 'team') klang('stufe')
      else if (gewinnerIch) klang('sieg')
    }
    warStatus.current = status
  }, [status, gewinnerIch, modusJetzt, klang])

  const aktion = useCallback(async (body: Record<string, unknown>) => {
    setBusy(true); setFehler('')
    try { const d = await post({ ...body, raum: id }); if (d?.raum) setSt(d); return d }
    catch (e) { setFehler(e instanceof Error ? e.message : 'Fehler'); return null }
    finally { setBusy(false) }
  }, [id])

  const verlassen = async () => { await aktion({ action: 'raum-verlassen' }); router.push('/geo/higher-lower') }
  const kopieren = async () => { try { await navigator.clipboard.writeText(link); setKopiert(true); setTimeout(() => setKopiert(false), 2000) } catch { /* egal */ } }
  const vorschlag = useCallback((w: 'hoeher' | 'niedriger' | null) => { post({ action: 'raum-vorschlag', raum: id, wahl: w }).then(d => d?.raum && setSt(d)).catch(() => {}) }, [id])
  const meinEnde = useCallback((e: { runde: { id: string } }) => { setIchFertig(e.runde.id); reloadProfile() }, [reloadProfile])

  if (!loaded) return <div className="ga-page"><div className="ga-map-loading">Lädt …</div></div>
  if (!loggedIn) {
    return (
      <div className="ga-page">
        <div className="ga-card ga-locked">
          <div className="ga-locked-icon"><Icon name="users" size={28} /></div>
          <h1 className="ga-h2">Du wurdest zu Higher Lower eingeladen</h1>
          <p className="ga-lead" style={{ margin: '6px auto 16px' }}>Zum Mitspielen bitte einloggen – danach kommst du direkt in den Raum.</p>
          <Link href={`/login?redirect=${encodeURIComponent(`/geo/higher-lower/raum/${id}`)}`} className="ga-btn primary">Einloggen</Link>
        </div>
      </div>
    )
  }
  if (fehler && !st) return <div className="ga-page"><div className="ga-card ga-locked"><h1 className="ga-h2">{fehler}</h1><Link href="/geo/higher-lower" className="ga-btn primary" style={{ marginTop: 12 }}>Zu Higher Lower</Link></div></div>
  if (!st || !info) return <div className="ga-page"><div className="ga-map-loading">Raum wird geladen …</div></div>

  const { raum } = st
  const duell = raum.modus === 'duell'
  const titel = duell ? 'Duell' : 'Team'
  const auswahl = `${HL_REGIONEN.find(r => r.key === raum.region)?.name} · ${raum.katName} · ${HL_ART_NAME[raum.art]} · ${HL_STUFE_NAME[raum.stufe]}`

  /* ───────────── Spiel läuft ───────────── */
  const meine = st.meineRunde
  const spielt = !!(st.ichDrin && meine && lief === meine.id && ichFertig !== meine.id)
  if (meine && (spielt || (raum.status === 'laeuft' && st.ichDrin))) {
    const tafel = <Tafel st={st} />
    if (duell && spielt) {
      return (
        <div className="ga-page ga-hl">
          <HlSpiel key={meine.id} start={meine} info={info} onEnde={meinEnde} mehr={{ modus: 'duell', tafel }} />
        </div>
      )
    }
    if (!duell && spielt) {
      return (
        <div className="ga-page ga-hl">
          <HlSpiel key={meine.id} start={meine} info={info} onEnde={meinEnde}
            mehr={{
              modus: 'team', amZug: raum.amZug === st.spieler.find(p => p.me)?.id, amZugName: raum.amZugName,
              extern: meine, letzte: raum.letzte, vorschlaege: raum.vorschlaege, onVorschlag: vorschlag, tafel,
            }} />
          <div className="ga-hl-raum-fuss"><button className="ga-btn ghost sm" onClick={verlassen}>Raum verlassen</button></div>
        </div>
      )
    }
    // Duell: ich bin fertig, die anderen spielen noch (Team: kurz, bis der Endstand da ist)
    if (raum.status === 'laeuft') return (
      <div className="ga-page ga-hl">
        <section className="ga-hl-hero ga-hl-warte">
          <p className="ga-eyebrow">Duell läuft</p>
          <h1 className="ga-hl-titel">Du hast <span>{meine.richtige}</span> richtige</h1>
          <p className="ga-muted">Warte, bis die anderen fertig sind …</p>
          {tafel}
        </section>
      </div>
    )
  }

  /* ───────────── Endstand ───────────── */
  if (raum.status === 'fertig') {
    const e = raum.ergebnis ?? {}
    const sortiert = [...st.spieler].filter(p => p.status !== 'zuschauer').sort((a, b) => b.richtige - a.richtige || b.punkte - a.punkte)
    const ich = st.spieler.find(p => p.me)
    const gewonnen = duell && ich && e.sieger?.includes(ich.id)
    return (
      <div className="ga-page ga-hl">
        <section className="ga-hl-hero">
          <p className="ga-eyebrow">{titel} · Endstand</p>
          {duell ? (
            <h1 className="ga-hl-titel">{gewonnen ? <>Du hast <span>gewonnen!</span></> : <>{(e.sieger ?? []).map(sid => st.spieler.find(p => p.id === sid)?.name).join(' & ')} <span>gewinnt</span></>}</h1>
          ) : (
            <h1 className="ga-hl-titel">Zusammen <span>{e.richtige ?? 0}</span> richtige</h1>
          )}
          <p className="ga-muted">{auswahl}</p>
          {duell && (e.topf ?? 0) > 0 && <p className="ga-hl-topf-erg"><Icon name="star" size={15} /> Topf: {e.topf} Sternis {(e.sieger?.length ?? 0) > 1 ? `– geteilt, je ${e.jeder}` : `→ ${e.jeder} an den Sieger`}</p>}
          {!duell && <p className="ga-hl-topf-erg"><Icon name="star" size={15} /> Jeder bekommt +{e.xp ?? 0} XP und +{e.sternis ?? 0} Sternis</p>}
          {duell && (
            <ol className="ga-hl-endliste">
              {sortiert.map((p, i) => (
                <li key={p.id} className={`${p.me ? 'ich' : ''} ${e.sieger?.includes(p.id) ? 'sieger' : ''}`}>
                  <span className="pl">{e.sieger?.includes(p.id) ? '👑' : i + 1}</span>
                  <span className="nm">{p.name}</span>
                  <span className="sc"><b>{p.richtige}</b> richtig · {p.punkte} P.</span>
                  {p.gewinn > 0 && <span className="gw">+{p.gewinn}</span>}
                </li>
              ))}
            </ol>
          )}
          <div className="ga-hl-erg-knoepfe">
            {st.isHost ? <button className="ga-btn primary" disabled={busy} onClick={() => aktion({ action: 'raum-nochmal' })}><Icon name="refresh" size={15} /> Nochmal mit allen</button>
              : <span className="ga-muted">{raum.hostName} kann eine neue Runde starten.</span>}
            <button className="ga-btn" onClick={verlassen}>Raum verlassen</button>
          </div>
          {fehler && <p className="ga-adm-flash bad">{fehler}</p>}
        </section>
      </div>
    )
  }

  /* ───────────── Läuft, aber ich bin nicht dabei ───────────── */
  if (raum.status === 'laeuft') {
    return (
      <div className="ga-page ga-hl">
        <section className="ga-hl-hero ga-hl-warte">
          <p className="ga-eyebrow">{titel} läuft gerade</p>
          <h1 className="ga-hl-titel">Gleich geht’s <span>weiter</span></h1>
          <p className="ga-muted">Die Runde hat ohne dich angefangen. Sobald sie vorbei ist, kannst du bei der nächsten mitmachen.</p>
          <Tafel st={st} />
        </section>
      </div>
    )
  }

  /* ───────────── Warteraum ───────────── */
  const dabei = st.spieler.filter(p => !p.verlassen)
  const max = duell ? st.mehr.maxDuell : st.mehr.maxTeam
  const host = st.isHost
  const aendern = (o: Record<string, unknown>) => aktion({ action: 'raum-aendern', ...o })
  return (
    <div className="ga-page ga-hl">
      <section className="ga-hl-hero">
        <div className="kopf">
          <div>
            <p className="ga-eyebrow" style={{ margin: 0 }}>Higher Lower · Warteraum</p>
            <h1 className="ga-hl-titel">{duell ? <>Duell <span>gegeneinander</span></> : <>Team <span>miteinander</span></>}</h1>
            <p className="ga-muted">{duell
              ? 'Alle bekommen dieselben Paare. Wer am weitesten kommt, gewinnt.'
              : 'Eine gemeinsame Runde. Reihum ist jemand dran, die anderen schlagen vor. Alle bekommen dieselben Punkte.'}</p>
          </div>
        </div>

        <div className="ga-hl-einladung">
          <span className="lbl">Einladungslink – an Freunde schicken</span>
          <div className="ga-share-link">
            <input className="ga-input" readOnly value={link} onFocus={e => e.target.select()} aria-label="Einladungslink" />
            <button className="ga-btn" onClick={kopieren}><Icon name={kopiert ? 'check' : 'copy'} size={15} /> {kopiert ? 'Kopiert' : 'Kopieren'}</button>
          </div>
        </div>

        <div className="ga-hl-lobby">
          <div>
            <span className="lbl">Dabei ({dabei.length}/{max})</span>
            <ul className="ga-hl-lobby-liste">
              {dabei.map(p => (
                <li key={p.id} className={p.me ? 'ich' : ''}>
                  <span className={`dot ${p.online ? 'on' : ''}`} />
                  <span className="nm">{p.name}</span>
                  {p.id === raum.hostId && <small>Gastgeber</small>}
                  {p.me && <small>du</small>}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <span className="lbl">Einstellungen {host ? '' : `(legt ${raum.hostName} fest)`}</span>
            {host ? (
              <div className="ga-hl-raum-einst">
                <div className="ga-seg">{HL_REGIONEN.map(r => <button key={r.key} className={raum.region === r.key ? 'active' : ''} onClick={() => aendern({ region: r.key })}>{r.name}</button>)}</div>
                <select className="ga-input sm" value={raum.kategorie} onChange={e => aendern({ kategorie: e.target.value })} aria-label="Kategorie">
                  <option value={MIX}>🎲 Mix (alle Kategorien)</option>
                  {(['ernst', 'spass', 'absurd'] as HlGruppe[]).map(g => (
                    <optgroup key={g} label={GRUPPE[g]}>
                      {HL_KATEGORIEN.filter(k => k.gruppe === g && info.kategorien[raum.region]?.includes(k.key)).map(k => <option key={k.key} value={k.key}>{k.icon} {k.name}</option>)}
                    </optgroup>
                  ))}
                </select>
                <div className="ga-seg">
                  {(duell ? ['klassisch', 'leben', 'sprint'] : ['klassisch', 'leben'] as HlArt[]).filter(a => info.config.arten[a as HlArt]).map(a => (
                    <button key={a} className={raum.art === a ? 'active' : ''} onClick={() => aendern({ art: a })}>{a === 'leben' ? `${info.config.leben} Leben` : a === 'sprint' ? `Sprint ${info.config.sprintSek} s` : 'Klassisch'}</button>
                  ))}
                </div>
                <div className="ga-seg">{HL_STUFEN.map(x => <button key={x.key} className={raum.stufe === x.key ? 'active' : ''} onClick={() => aendern({ stufe: x.key })}>{x.name}</button>)}</div>
                {duell && st.mehr.topf && (
                  <label className="ga-hl-topf-feld">
                    <Icon name="star" size={14} /> Einsatz pro Spieler
                    <input type="number" className="ga-input sm" min={0} max={st.mehr.maxEinsatz} defaultValue={raum.einsatz}
                      onBlur={e => { const v = Math.max(0, Math.floor(Number(e.target.value) || 0)); if (v !== raum.einsatz) aendern({ einsatz: v }) }} />
                    <span className="ga-muted">0 = ohne Topf</span>
                  </label>
                )}
              </div>
            ) : (
              <p className="ga-hl-raum-zusammenfassung">{auswahl}{duell && raum.einsatz > 0 ? ` · Einsatz ${raum.einsatz} Sternis` : ''}</p>
            )}
            {duell && raum.einsatz > 0 && (
              <p className="ga-hl-topf"><Icon name="star" size={14} /> Jeder setzt <b>{raum.einsatz}</b> Sternis beim Start. Topf bei {dabei.length} Spielern: <b>{raum.einsatz * dabei.length}</b> – der Sieger bekommt alles, bei Gleichstand wird geteilt.</p>
            )}
          </div>
        </div>

        {fehler && <p className="ga-adm-flash bad" role="alert">{fehler}</p>}
        <div className="ga-hl-spielen">
          {host
            ? <button className="ga-btn primary ga-hl-losbtn" disabled={busy || dabei.length < 2} onClick={() => aktion({ action: 'raum-start' })}><Icon name="play" size={17} /> {dabei.length < 2 ? 'Warte auf Mitspieler …' : 'Runde starten'}</button>
            : <span className="ga-muted">Warte, bis {raum.hostName} die Runde startet …</span>}
          <button className="ga-btn ghost" onClick={verlassen}>Raum verlassen</button>
        </div>
      </section>
    </div>
  )
}

/** Live-Tafel: alle Spieler mit Stand */
function Tafel({ st }: { st: RaumZustand }) {
  const duell = st.raum.modus === 'duell'
  const liste: RaumSpieler[] = duell
    ? [...st.spieler].filter(p => p.status !== 'zuschauer').sort((a, b) => b.richtige - a.richtige || b.punkte - a.punkte)
    : st.spieler.filter(p => !p.verlassen)
  return (
    <section className="ga-card ga-hl-tafel">
      <h2 className="ga-hl-h"><Icon name="users" size={16} /> {duell ? 'Live-Stand' : 'Dein Team'}
        {duell && st.raum.topf > 0 && <span className="ga-muted">· Topf {st.raum.topf} Sternis</span>}
        {!duell && st.meineRunde && <span className="ga-muted">· zusammen {st.meineRunde.richtige} richtig</span>}
      </h2>
      <ol className="ga-hl-tafel-liste">
        {liste.map((p, i) => (
          <li key={p.id} className={`${p.me ? 'ich' : ''} ${p.status === 'fertig' ? 'raus' : ''} ${!duell && st.raum.amZug === p.id ? 'dran' : ''}`}>
            <span className="pl">{duell ? i + 1 : <span className={`dot ${p.online ? 'on' : ''}`} />}</span>
            <span className="nm">{p.name}{p.me ? ' (du)' : ''}</span>
            {duell ? (
              <>
                <span className="sc"><b>{p.richtige}</b> richtig</span>
                <span className="stat">{p.status === 'spielt' ? (p.leben != null ? `${p.leben} ♥` : 'spielt …') : 'fertig'}</span>
              </>
            ) : (
              <span className="stat">{st.raum.amZug === p.id ? 'ist dran' : p.online ? '' : 'weg'}</span>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}