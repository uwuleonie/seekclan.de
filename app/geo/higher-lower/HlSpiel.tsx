'use client'

// Higher Lower – das Spielfeld: zwei Karten, Höher/Niedriger, Zahl zählt hoch, grün/rot, Karte rutscht nach links.
// Oben: Kategorie, Serie mit Flamme und Multiplikator, Punkte, Leben, Sprint-Uhr, Wette (Fortschritt + Zeitlimit).
// Tastatur: Pfeil hoch = höher, Pfeil runter = niedriger, Leertaste/Enter = weiter. Handy: auf der rechten Karte wischen.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useGeo } from '../_components/GeoShell'
import Icon from '../_components/Icon'
import { flagFillSrc, loadFlags } from '../_components/Flag'
import { HL_KAT } from '../_data/hl'
import { fmtWert, multiplikator, naechsteStufe, mergeHlConfig, HL_ART_NAME } from '../_lib/hl'
import type { Aufloesung, Ergebnis, HlInfo, Karte, Runde } from './typen'

async function post(body: Record<string, unknown>) {
  const r = await fetch('/api/geo/hl', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error || `Fehler ${r.status}`)
  return d
}

/** Flagge als breites Band oben auf der Karte */
function FlagBand({ code }: { code: string | null }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    if (!code) return
    loadFlags('flags').then(f => { if (alive && f[code]) setSrc(flagFillSrc(f[code])) }).catch(() => {})
    return () => { alive = false }
  }, [code])
  // eslint-disable-next-line @next/next/no-img-element
  return <div className="ga-hl-band">{src && <img src={src} alt="" draggable={false} />}</div>
}

/** Zahl zählt in ~0,9 s hoch (bremst am Ende ab) */
function useHochzaehlen(ziel: number | undefined, an: boolean) {
  const [v, setV] = useState<{ ziel: number; wert: number } | null>(null)
  useEffect(() => {
    if (!an || ziel == null) return
    const still = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const dauer = still ? 0 : 900
    let raf = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      const p = dauer ? Math.min(1, (t - t0) / dauer) : 1
      setV({ ziel, wert: ziel * (1 - Math.pow(1 - p, 3)) })
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [ziel, an])
  return an && v && v.ziel === ziel ? v.wert : null
}

const FLAMME = ['', 'f1', 'f2', 'f3', 'f4', 'f5', 'f5']

/** Mehrspieler: Duell (eigene Runde + Live-Tafel) oder Team (gemeinsame Runde, reihum, Vorschläge) */
export interface MehrProps {
  modus: 'duell' | 'team'
  /** Team: bin ich gerade dran? */
  amZug?: boolean
  amZugName?: string | null
  /** Team: aktueller Stand der gemeinsamen Runde (vom Server, wird laufend abgefragt) */
  extern?: Runde | null
  /** Team: letzte Auflösung (wer hat was getippt) */
  letzte?: { nr: number; von: string; aufl: Aufloesung } | null
  vorschlaege?: { name: string; wahl: 'hoeher' | 'niedriger'; me: boolean }[]
  onVorschlag?: (w: 'hoeher' | 'niedriger' | null) => void
  /** Live-Tafel mit den anderen Spielern */
  tafel?: React.ReactNode
}

export default function HlSpiel({ start, info, onEnde, mehr }: { start: Runde; info: HlInfo; onEnde: (e: Ergebnis) => void; mehr?: MehrProps }) {
  const team = mehr?.modus === 'team'
  const amZug = !team || !!mehr?.amZug
  const { showGains, reloadProfile, klang } = useGeo()
  // Töne zur Auflösung: richtig (mit der Serie höher), falsch, neue Bonus-Stufe, Wette gewonnen/verloren
  const tonZu = useCallback((a: Aufloesung, serie: number) => {
    if (a.wette?.status === 'gewonnen') { klang('richtig', serie); setTimeout(() => klang('wette-gewonnen'), 220); return }
    if (a.wette?.status === 'verloren') { klang('wette-verloren'); return }
    klang(a.richtig ? 'richtig' : 'falsch', serie)
    if (a.richtig && a.stufeHoch) setTimeout(() => klang('stufe'), 230)
  }, [klang])
  const klangRef = useRef(klang)
  useEffect(() => { klangRef.current = klang }, [klang])
  const letzterTick = useRef(0)
  const cfg = mergeHlConfig(info.config)
  const [r, setR] = useState<Runde>(start)
  const [aufl, setAufl] = useState<Aufloesung | null>(null)
  const [phase, setPhase] = useState<'frage' | 'warte' | 'aufloesung' | 'rutschen'>('frage')
  const [fehler, setFehler] = useState('')
  // Serverzeit in ms (0 = Uhr läuft noch nicht)
  const [jetzt, setJetzt] = useState(0)
  const [hinweis, setHinweis] = useState<{ text: string; art: 'stufe' | 'wette' | 'kat' } | null>(null)
  // Unterschied Server-Uhr ↔ Browser-Uhr
  const offset = useRef(0)
  const naechste = useRef<{ runde: Runde; aufl: Aufloesung } | null>(null)
  const gewinnWette = useRef(0)
  const touch = useRef<number | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const weiterRef = useRef<() => void>(() => {})
  const [sicher, setSicher] = useState(false)
  // Team: bis zu welchem Paar haben wir die Auflösung schon gezeigt?
  const gesehen = useRef(start.schritt)

  const kat = HL_KAT[r.kat]
  const offen = phase === 'aufloesung'
  const zaehler = useHochzaehlen(aufl?.rechts.wert, offen)

  // Beim Start das Spielfeld ganz nach oben holen (vor allem am Handy)
  const feld = useRef<HTMLDivElement>(null)
  useEffect(() => { feld.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }) }, [])

  // Aktuelle Werte für die Uhr (wird außerhalb des Renderns gelesen)
  const rRef = useRef(r)
  const phaseRef = useRef(phase)
  const tippRef = useRef<(w: 'zeit') => void>(() => {})
  const sprintEndeRef = useRef<() => void>(() => {})
  useEffect(() => { rRef.current = r; phaseRef.current = phase }, [r, phase])
  useEffect(() => { offset.current = start.jetzt - Date.now() }, [start.jetzt])

  // Uhr für Sprint und Wett-Zeitlimit: Zeit abgelaufen → bei Wette zählt es als falsch, beim Sprint ist die Runde vorbei
  useEffect(() => {
    if (!r.sprintEnde && !r.zeit) return
    const t = setInterval(() => {
      const now = Date.now() + offset.current
      setJetzt(now)
      const rr = rRef.current
      if (phaseRef.current !== 'frage') return
      // Die letzten 5 Sekunden ticken (Wett-Zeitlimit oder Sprint)
      const bis = rr.zeit && rr.wette === 'offen' ? rr.zeit.bis : rr.sprintEnde
      if (bis) {
        const sek = Math.ceil((bis - now) / 1000)
        if (sek >= 1 && sek <= 5 && sek !== letzterTick.current) { letzterTick.current = sek; klangRef.current('tick') }
      }
      if (rr.zeit && rr.wette === 'offen' && now >= rr.zeit.bis) tippRef.current('zeit')
      else if (rr.sprintEnde && now >= rr.sprintEnde) sprintEndeRef.current()
    }, 100)
    return () => clearInterval(t)
  }, [r.sprintEnde, r.zeit])
  const sprintRest = r.sprintEnde && jetzt ? Math.max(0, r.sprintEnde - jetzt) : null
  const zeitRest = r.zeit && jetzt && r.wette === 'offen' && phase === 'frage' ? Math.max(0, r.zeit.bis - jetzt) : null

  const fertig = useCallback((runde: Runde, a: Aufloesung | null) => {
    const gains = [...(a?.ende?.xp ?? []), ...(a?.ende?.sternis ?? [])]
    if (gains.length) showGains(gains)
    reloadProfile()
    onEnde({ runde, letzte: a, belohnung: a?.ende ?? null, gewinnWette: gewinnWette.current })
  }, [onEnde, showGains, reloadProfile])

  const weiter = useCallback(() => {
    const n = naechste.current
    if (!n) return
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    naechste.current = null
    if (n.aufl.ende || n.runde.status === 'beendet') { fertig(n.runde, n.aufl); return }
    const katWechsel = n.runde.kat !== r.kat
    offset.current = n.runde.jetzt - Date.now()
    setPhase('rutschen')
    setTimeout(() => {
      setR(n.runde)
      setAufl(null)
      setPhase('frage')
      if (katWechsel) setHinweis({ text: `${HL_KAT[n.runde.kat]?.icon} ${HL_KAT[n.runde.kat]?.name}`, art: 'kat' })
    }, 320)
  }, [fertig, r.kat])

  const vorschlagen = mehr?.onVorschlag
  const tipp = useCallback(async (wahl: 'hoeher' | 'niedriger' | 'zeit') => {
    if (phase !== 'frage') return
    // Team, aber nicht dran: nur ein Vorschlag an den, der dran ist
    if (!amZug) { if (wahl !== 'zeit') vorschlagen?.(wahl); return }
    setPhase('warte')
    setFehler('')
    try {
      const d = await post({ action: 'tipp', id: r.id, wahl })
      const a = d.aufloesung as Aufloesung
      gesehen.current = Math.max(gesehen.current, d.runde.schritt)
      naechste.current = { runde: d.runde, aufl: a }
      setAufl(a)
      setPhase('aufloesung')
      tonZu(a, d.runde.serie)
      // Zwischenstand schon zeigen (Serie, Punkte), Karten erst beim Weiterrutschen tauschen
      setR(old => ({ ...old, richtige: d.runde.richtige, serie: d.runde.serie, punkte: d.runde.punkte, multi: d.runde.multi, stufe_i: d.runde.stufe_i, leben: d.runde.leben, wette: d.runde.wette, fehler: d.runde.fehler, sprintEnde: d.runde.sprintEnde }))
      if (a.wette?.status === 'gewonnen') {
        gewinnWette.current = a.wette.betrag
        setHinweis({ text: `Wette gewonnen! +${a.wette.betrag.toLocaleString('de-DE')} Sternis`, art: 'wette' })
        showGains([{ amount: a.wette.betrag, label: `Ziel ${r.ziel} geschafft · ×${String(r.quote).replace('.', ',')}`, kind: 'sterni' }])
        reloadProfile()
      } else if (a.wette?.status === 'verloren') {
        setHinweis({ text: `Wette verloren – ${a.wette.betrag.toLocaleString('de-DE')} Sternis weg`, art: 'wette' })
      } else if (a.stufeHoch) {
        setHinweis({ text: `×${String(a.multi).replace('.', ',')} Bonus!`, art: 'stufe' })
      }
      const warte = a.ende || d.runde.status === 'beendet' ? 1900 : a.richtig ? 1150 : 1700
      timer.current = setTimeout(weiterRef.current, warte)
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Fehler')
      setPhase('frage')
    }
  }, [phase, r.id, r.ziel, r.quote, showGains, reloadProfile, amZug, vorschlagen, tonZu])
  useEffect(() => { weiterRef.current = weiter }, [weiter])

  // Team: jemand anderes hat getippt → Auflösung zeigen, dann weiterrutschen
  const extern = mehr?.extern
  const letzte = mehr?.letzte
  useEffect(() => {
    if (!team || !extern) return
    const t = setTimeout(() => {
      if (phaseRef.current !== 'frage') return
      if (letzte && letzte.nr > gesehen.current && extern.schritt >= letzte.nr) {
        gesehen.current = letzte.nr
        naechste.current = { runde: extern, aufl: letzte.aufl }
        setAufl(letzte.aufl)
        setPhase('aufloesung')
        tonZu(letzte.aufl, extern.serie)
        setR(old => ({ ...old, richtige: extern.richtige, serie: extern.serie, punkte: extern.punkte, multi: extern.multi, stufe_i: extern.stufe_i, leben: extern.leben, fehler: extern.fehler }))
        setHinweis({ text: `${letzte.von}: ${letzte.aufl.richtig ? 'richtig!' : 'daneben'}`, art: 'kat' })
        timer.current = setTimeout(weiterRef.current, letzte.aufl.richtig && extern.status !== 'beendet' ? 1500 : 2000)
      } else if (extern.status === 'beendet') {
        fertig(extern, null)
      }
    }, 0)
    return () => clearTimeout(t)
  }, [team, extern, letzte, fertig, tonZu])

  // Team: „Du bist dran“-Ton, sobald man an der Reihe ist
  const warDran = useRef(amZug)
  useEffect(() => {
    if (team && amZug && !warDran.current) klang('zug')
    warDran.current = amZug
  }, [team, amZug, klang])

  // Hinweis nach kurzer Zeit ausblenden
  useEffect(() => {
    if (!hinweis) return
    const t = setTimeout(() => setHinweis(null), hinweis.art === 'wette' ? 2600 : 1500)
    return () => clearTimeout(t)
  }, [hinweis])

  // Sprint vorbei → Runde beenden (einmal)
  const endeGesendet = useRef(false)
  const sprintBeenden = useCallback(() => {
    if (endeGesendet.current) return
    endeGesendet.current = true
    post({ action: 'ende', id: r.id })
      .then(d => fertig(d.runde, { richtig: false, grund: 'sprint-ende', rechts: d.runde.rechts, punkte: 0, multi: 1, stufeHoch: false, ende: d.ende }))
      .catch(() => { endeGesendet.current = false })
  }, [r.id, fertig])
  useEffect(() => { tippRef.current = tipp; sprintEndeRef.current = sprintBeenden }, [tipp, sprintBeenden])

  // Tastatur
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      if (e.key === 'ArrowUp') { e.preventDefault(); tipp('hoeher') }
      else if (e.key === 'ArrowDown') { e.preventDefault(); tipp('niedriger') }
      else if ((e.key === ' ' || e.key === 'Enter') && phase === 'aufloesung') { e.preventDefault(); weiter() }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [tipp, weiter, phase])

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const aufgeben = async () => {
    // Mit laufender Wette erst nachfragen (zweiter Klick bestätigt)
    if (r.wette === 'offen' && !sicher) { setSicher(true); setTimeout(() => setSicher(false), 4000); return }
    try {
      const d = await post({ action: 'ende', id: r.id })
      fertig(d.runde, { richtig: false, rechts: d.runde.rechts, punkte: 0, multi: 1, stufeHoch: false, ende: d.ende })
    } catch (e) { setFehler(e instanceof Error ? e.message : 'Fehler') }
  }

  const next = naechsteStufe(r.serie, cfg)
  const stufeKlasse = FLAMME[Math.min(r.stufe_i, 6)]
  const zustand = offen ? (aufl?.richtig ? 'ok' : 'bad') : ''
  const rechtsKarte: Karte = offen && aufl ? aufl.rechts : r.rechts

  return (
    <div ref={feld} className={`ga-hl-spiel ${phase === 'rutschen' ? 'rutscht' : ''}`}>
      {/* ── Kopfzeile ── */}
      <div className="ga-hl-top">
        {team ? <span className={`ga-hl-zug ${amZug ? 'ich' : ''}`}>{amZug ? 'Du bist dran!' : `${mehr?.amZugName ?? '…'} ist dran`}</span> : (
          <button className={`ga-btn sm ${sicher ? 'danger' : 'ghost'}`} onClick={aufgeben}>
            <Icon name="back" size={15} /> {sicher ? `Wirklich? ${r.einsatz} Sternis weg` : 'Aufhören'}
          </button>
        )}
        <div className="ga-hl-kat" key={r.kat}>
          <span className="ic">{kat?.icon}</span>
          <span><b>{kat?.name}</b>{kat?.einheit && kat.fmt !== 'usd' && kat.fmt !== 'usd-gross' ? <small> · {kat.einheit}</small> : null}</span>
        </div>
        <div className="ga-hl-stats">
          {r.leben != null && (
            <span className="ga-hl-leben" aria-label={`${r.leben} Leben`}>
              {Array.from({ length: cfg.leben }, (_, i) => <Icon key={i} name="heart" size={17} className={i < (r.leben ?? 0) ? 'voll' : ''} />)}
            </span>
          )}
          {sprintRest != null && <span className={`ga-hl-uhr ${sprintRest < 10000 ? 'knapp' : ''}`}><Icon name="timer" size={15} /> {Math.ceil(sprintRest / 1000)} s</span>}
          <span className="ga-hl-punkte"><b>{r.punkte.toLocaleString('de-DE')}</b> Punkte</span>
        </div>
      </div>

      <div className="ga-hl-leiste">
        <div className={`ga-hl-serie ${stufeKlasse}`}>
          <Icon name="fire" size={22} className="flamme" />
          <b key={r.serie} className="zahl">{r.serie}</b>
          <span className="lbl">in Folge</span>
          <span className={`ga-hl-multi s${Math.min(r.stufe_i, 5)}`}>×{String(multiplikator(r.serie, cfg)).replace('.', ',')}</span>
          {next && <span className="ga-muted nx">noch {next.ab - r.serie} bis ×{String(next.faktor).replace('.', ',')}</span>}
        </div>
        {r.ziel && r.einsatz > 0 && (
          <div className={`ga-hl-wette ${r.wette ?? ''}`}>
            <span className="t"><Icon name="star" size={14} /> {r.einsatz.toLocaleString('de-DE')} × {String(r.quote).replace('.', ',')}</span>
            {r.wette === 'offen' ? (
              <>
                <span className="bar"><span style={{ width: `${Math.min(100, (r.serie / r.ziel) * 100)}%` }} /></span>
                <span className="t">{r.serie} / {r.ziel}</span>
                {zeitRest != null && <span className={`zeit ${zeitRest < 5000 ? 'knapp' : ''}`}><Icon name="clock" size={13} /> {Math.ceil(zeitRest / 1000)}</span>}
              </>
            ) : r.wette === 'gewonnen' ? <span className="t ok">gewonnen · +{Math.floor(r.einsatz * Number(r.quote)).toLocaleString('de-DE')}</span>
              : <span className="t bad">verloren</span>}
          </div>
        )}
      </div>

      <p className="ga-hl-frage">
        Hat <b>{r.rechts.name}</b> einen höheren oder niedrigeren Wert als <b>{r.links.name}</b>?
      </p>

      {/* ── Karten ── */}
      <div className="ga-hl-karten">
        <div className="ga-hl-karte links" key={`l-${r.links.id}-${r.kat}`}>
          <FlagBand code={r.links.flag} />
          <div className="inh">
            <div className="name">{r.links.name}</div>
            <div className="wert">{r.links.text}</div>
            <div className="sub">{kat?.name}</div>
            {r.links.zusatz && <div className="zus">{r.links.zusatz}</div>}
            {r.links.jahr && <div className="jahr">Stand {r.links.jahr}</div>}
          </div>
        </div>

        <div className="ga-hl-vs">VS</div>

        <div
          key={`r-${r.rechts.id}`}
          className={`ga-hl-karte rechts ${zustand}`}
          onTouchStart={e => { touch.current = e.touches[0].clientY }}
          onTouchEnd={e => {
            if (touch.current == null) return
            const dy = e.changedTouches[0].clientY - touch.current
            touch.current = null
            if (dy < -45) tipp('hoeher')
            else if (dy > 45) tipp('niedriger')
          }}
        >
          <FlagBand code={rechtsKarte.flag} />
          <div className="inh">
            <div className="name">{rechtsKarte.name}</div>
            {offen && aufl ? (
              <>
                <div className="wert">{zaehler != null && kat ? fmtWert(zaehler, kat) : aufl.rechts.text}</div>
                <div className="sub">{kat?.name}</div>
                {aufl.rechts.zusatz && <div className="zus">{aufl.rechts.zusatz}</div>}
                <div className={`urteil ${aufl.richtig ? 'ok' : 'bad'}`}>
                  <Icon name={aufl.richtig ? 'check' : 'x'} size={18} strokeWidth={2.4} />
                  {aufl.grund === 'zeit' ? 'Zeit abgelaufen' : aufl.grund === 'sprint-ende' ? 'Zeit vorbei' : aufl.richtig ? `Richtig! +${aufl.punkte}` : 'Leider falsch'}
                </div>
              </>
            ) : (
              <div className="knoepfe">
                {!amZug && <span className="ga-hl-tipp">Vorschlag an {mehr?.amZugName ?? '…'}:</span>}
                <button className={`ga-hl-btn hoch ${amZug ? '' : 'vorschlag'} ${mehr?.vorschlaege?.some(v => v.me && v.wahl === 'hoeher') ? 'gewaehlt' : ''}`} disabled={phase !== 'frage'} onClick={() => tipp('hoeher')}>
                  <Icon name="arrowUp" size={20} strokeWidth={2.4} /> Höher
                  {team && <Stimmen liste={mehr?.vorschlaege} wahl="hoeher" />}
                </button>
                <button className={`ga-hl-btn runter ${amZug ? '' : 'vorschlag'} ${mehr?.vorschlaege?.some(v => v.me && v.wahl === 'niedriger') ? 'gewaehlt' : ''}`} disabled={phase !== 'frage'} onClick={() => tipp('niedriger')}>
                  <Icon name="arrowDown" size={20} strokeWidth={2.4} /> Niedriger
                  {team && <Stimmen liste={mehr?.vorschlaege} wahl="niedriger" />}
                </button>
                <span className="ga-hl-tipp">als {r.links.text}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {offen && (
        <div className="ga-hl-weiter">
          <button className="ga-btn sm" onClick={weiter}>Weiter <Icon name="next" size={14} /></button>
        </div>
      )}
      {fehler && <p className="ga-adm-flash bad" role="alert">{fehler}</p>}
      {mehr?.tafel}
      {hinweis && <div className={`ga-hl-hinweis ${hinweis.art}`} role="status">{hinweis.text}</div>}

      <p className="ga-hl-quelle">
        {HL_ART_NAME[r.art]} · Quelle: {kat?.url ? <a href={kat.url} target="_blank" rel="noopener noreferrer">{kat.quelle}</a> : kat?.quelle}
        {kat?.jahr ? ` (${kat.jahr})` : ''} · <span className="ga-hl-keys">↑ höher · ↓ niedriger</span>
      </p>
    </div>
  )
}

/** Team: wer hat was vorgeschlagen (kleine Namens-Liste im Knopf) */
function Stimmen({ liste, wahl }: { liste?: { name: string; wahl: string }[]; wahl: string }) {
  const n = (liste ?? []).filter(v => v.wahl === wahl)
  if (!n.length) return null
  return <span className="ga-hl-stimmen" title={n.map(v => v.name).join(', ')}>{n.length === 1 ? n[0].name : `${n.length} Stimmen`}</span>
}