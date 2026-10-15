'use client'

// Higher Lower – Startseite, Spiel und Ergebnis.
// Oben eine kompakte Start-Karte (Kategorie, Region, Modus, Stufe, Wette, „Spielen“) – sofort spielbar ohne Scrollen.
// Kategorien wählt man in einem eigenen Fenster mit Suche. Darunter: Schnellstart-Kacheln, Tagesrunde, Rangliste.
// Die Spiel-Logik läuft auf dem Server (/api/geo/hl), hier nur Auswahl und Anzeige.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useGeo } from '../_components/GeoShell'
import Icon from '../_components/Icon'
import { HL_KAT, HL_KATEGORIEN, HL_REGIONEN, type HlGruppe, type HlRegion } from '../_data/hl'
import { HL_ARTEN, HL_ART_NAME, HL_STUFEN, HL_STUFE_NAME, MIX, fmtWert, type HlArt, type HlStufe } from '../_lib/hl'
import { normalize } from '../_lib/text'
import HlSpiel from './HlSpiel'
import HlRangliste from './HlRangliste'
import type { Ergebnis, HlInfo, Runde } from './typen'

const GRUPPEN: { key: HlGruppe; name: string }[] = [
  { key: 'ernst', name: 'Wissen' },
  { key: 'spass', name: 'Spaß' },
  { key: 'absurd', name: 'Absurd' },
]
// v2: neuer Standard „Einwohner“ (vorher Mix) – alte gespeicherte Auswahl wird einmal verworfen
const MERKER = 'geo-hl-auswahl-v2'
/** Schnellwahl unter dem Kategorie-Knopf (ein Klick wählt, startet aber nicht) */
const SCHNELLWAHL = [MIX, 'einwohner', 'flaeche', 'bip-kopf', 'lebenserwartung', 'hoechster-punkt', 'olympia', 'bier']
const MODI: HlArt[] = ['klassisch', 'leben', 'sprint']

interface Auswahl { region: HlRegion; kategorie: string; art: HlArt; stufe: HlStufe; wetten: boolean; einsatz: number; ziel: number }
const STANDARD: Auswahl = { region: 'welt', kategorie: 'einwohner', art: 'klassisch', stufe: 'mittel', wetten: false, einsatz: 100, ziel: 10 }

const komma = (n: number) => String(n).replace('.', ',')
const katIcon = (k: string) => (k === MIX ? '🎲' : HL_KAT[k]?.icon ?? '❓')
const katName = (k: string) => (k === MIX ? 'Mix' : HL_KAT[k]?.name ?? k)

export default function HigherLowerView() {
  const router = useRouter()
  const { loaded, loggedIn, profile, reloadProfile } = useGeo()
  const [info, setInfo] = useState<HlInfo | null>(null)
  const [fehler, setFehler] = useState('')
  // Auswahl merken (nur in diesem Browser)
  const [a, setA] = useState<Auswahl>(() => {
    if (typeof window === 'undefined') return STANDARD
    try {
      const s = JSON.parse(localStorage.getItem(MERKER) ?? 'null')
      return s && typeof s === 'object' ? { ...STANDARD, ...s } : STANDARD
    } catch { return STANDARD }
  })
  const [runde, setRunde] = useState<Runde | null>(null)
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null)
  const [busy, setBusy] = useState(false)
  const [waehler, setWaehler] = useState(false)
  const [quote, setQuote] = useState<{ key: string; quote: number; p: number; antworten: number; max: number; gesperrt: boolean } | null>(null)
  const [tick, setTick] = useState(0)
  // Noch nicht freigeschaltet (nur für normale Nutzer): Zeitpunkt der Freischaltung
  const [gesperrt, setGesperrt] = useState<string | null>(null)

  const setze = useCallback((p: Partial<Auswahl>) => setA(x => {
    const n = { ...x, ...p }
    try { localStorage.setItem(MERKER, JSON.stringify(n)) } catch { /* egal */ }
    return n
  }), [])

  // Infos laden (beim Start, nach Login/Logout und nach jeder Runde)
  useEffect(() => {
    let alive = true
    fetch('/api/geo/hl', { cache: 'no-store' })
      .then(async r => {
        const d = await r.json()
        if (!alive) return
        if (!r.ok) setFehler(d.error || 'Fehler beim Laden')
        else if (d.gesperrt) { setGesperrt(d.gesperrt); setInfo(null) }
        else { setGesperrt(null); setInfo(d) }
      })
      .catch(() => { if (alive) setFehler('Fehler beim Laden') })
    return () => { alive = false }
  }, [loggedIn, tick])

  const katsHier = useMemo(() => new Set(info?.kategorien[a.region] ?? []), [info, a.region])
  // Gibt es die gewählte Kategorie/Spielart hier nicht (mehr), gilt Mix bzw. der erste erlaubte Modus
  const kategorie = !info || a.kategorie === MIX || katsHier.has(a.kategorie) ? a.kategorie : MIX
  const modi = MODI.filter(m => !info || info.config.arten[m])
  const art: HlArt = modi.includes(a.art) ? a.art : (modi[0] ?? 'klassisch')

  const cfgW = info?.config.wetten
  const wettbar = !!(info?.eingeloggt && cfgW?.an && (art === 'klassisch' || art === 'leben') && !info.config.wettenAus.includes(kategorie))
  const mitWette = wettbar && a.wetten
  const kontostand = profile?.sternis ?? info?.sternis ?? 0
  const ziel = cfgW ? Math.max(cfgW.minZiel, Math.min(cfgW.maxZiel, a.ziel)) : a.ziel
  const einsatz = cfgW ? Math.max(1, Math.min(a.einsatz, cfgW.maxEinsatz, Math.max(1, kontostand))) : a.einsatz

  // Quote live holen
  const quoteKey = `${a.region}|${kategorie}|${a.stufe}|${ziel}`
  useEffect(() => {
    if (!mitWette) return
    let alive = true
    const t = setTimeout(() => {
      const q = new URLSearchParams({ was: 'quote', region: a.region, kat: kategorie, stufe: a.stufe, ziel: String(ziel) })
      fetch(`/api/geo/hl?${q}`, { cache: 'no-store' }).then(r => r.json()).then(d => { if (alive && typeof d.quote === 'number') setQuote({ ...d, key: quoteKey }) }).catch(() => {})
    }, 180)
    return () => { alive = false; clearTimeout(t) }
  }, [mitWette, a.region, kategorie, a.stufe, ziel, quoteKey])
  const q = mitWette && quote?.key === quoteKey ? quote : null

  /** Runde starten. o = abweichende Auswahl (Schnellstart, Tagesrunde, Nochmal) – dann immer ohne Wette */
  const starten = async (o?: { kategorie?: string; art?: HlArt }) => {
    setBusy(true); setFehler('')
    try {
      const body: Record<string, unknown> = { action: 'start', region: a.region, kategorie: o?.kategorie ?? kategorie, art: o?.art ?? art, stufe: a.stufe }
      if (mitWette && !o) { body.einsatz = einsatz; body.ziel = ziel }
      const r = await fetch('/api/geo/hl', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || 'Konnte nicht starten')
      if (o?.kategorie) setze({ kategorie: o.kategorie })
      setErgebnis(null)
      setRunde(d.runde)
      if (body.einsatz) reloadProfile()
    } catch (e) { setFehler(e instanceof Error ? e.message : 'Fehler') } finally { setBusy(false) }
  }

  /** Mehrspieler-Raum mit der aktuellen Auswahl anlegen und hingehen */
  const raumNeu = async (modus: 'duell' | 'team', duellEinsatz: number) => {
    setBusy(true); setFehler('')
    try {
      const r = await fetch('/api/geo/hl', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'raum-neu', modus, region: a.region, kategorie, art: modus === 'team' && art === 'sprint' ? 'klassisch' : art, stufe: a.stufe, einsatz: duellEinsatz }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || 'Raum konnte nicht erstellt werden')
      router.push(`/geo/higher-lower/raum/${d.id}`)
    } catch (e) { setFehler(e instanceof Error ? e.message : 'Fehler'); setBusy(false) }
  }

  const onEnde = useCallback((e: Ergebnis) => {
    setRunde(null)
    setErgebnis(e)
    setTick(t => t + 1)
  }, [])

  /* ───────────── Spiel läuft ───────────── */
  if (runde && info) {
    return (
      <div className="ga-page ga-hl">
        <HlSpiel key={runde.id} start={runde} info={info} onEnde={onEnde} />
      </div>
    )
  }

  if (gesperrt) return <Sperre bis={gesperrt} onFrei={() => setTick(t => t + 1)} />
  if (!loaded || (!info && !fehler)) return <div className="ga-page"><div className="ga-map-loading">Lädt …</div></div>
  if (info?.aus) {
    return (
      <div className="ga-page">
        <div className="ga-card ga-locked">
          <div className="ga-locked-icon"><Icon name="lock" size={28} /></div>
          <h1 className="ga-h2">Higher Lower macht gerade Pause</h1>
          <p className="ga-lead" style={{ margin: '6px auto 16px' }}>Schau bald wieder vorbei.</p>
          <Link href="/geo" className="ga-btn primary"><Icon name="back" size={15} /> Atlas</Link>
        </div>
      </div>
    )
  }

  const rekord = info?.rekorde?.[`${a.region}|${kategorie}|${art}|${a.stufe}`] ?? 0
  const kat = kategorie === MIX ? null : HL_KAT[kategorie]
  const regionName = HL_REGIONEN.find(r => r.key === a.region)?.name ?? ''
  const tagGespielt = !!(info?.tagesrunde && !info.tagesrunde.laeuft)
  const spielenAus = busy || (mitWette && (!q || q.quote < 1.1 || kontostand < einsatz))

  return (
    <div className="ga-page ga-hl">
      {fehler && <p className="ga-adm-flash bad" role="alert">{fehler}</p>}

      {info?.laufend && (
        <div className="ga-hl-laufend">
          <span><Icon name="play" size={15} /> <b>Laufende Runde:</b> {katName(info.laufend.kategorie)} · {info.laufend.richtige} richtig{info.laufend.wette === 'offen' ? ` · Wette ${info.laufend.einsatz} Sternis` : ''}</span>
          <button className="ga-btn primary sm" onClick={() => setRunde(info.laufend!)}>Weiterspielen</button>
        </div>
      )}

      {/* ───────────── Start-Karte ───────────── */}
      {info?.config.gesperrtBis && (
        <p className="ga-hl-admin-hinweis"><Icon name="lock" size={14} /> Für normale Nutzer noch gesperrt bis {new Date(info.config.gesperrtBis).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })} Uhr – du siehst es als Admin. Datum im Geo-Admin unter „Higher Lower“ änderbar.</p>
      )}

      <section className="ga-hl-hero">
        <div className="kopf">
          <div>
            <h1 className="ga-hl-titel">Higher <span>Lower</span></h1>
            <p className="ga-muted">Welches Land hat mehr? Je länger deine Serie, desto mehr Punkte.</p>
          </div>
          <div className="ga-hl-hero-stats">
            {rekord > 0 && <span title="Dein Rekord mit dieser Auswahl"><Icon name="trophy" size={14} /> {rekord}</span>}
            {info?.eingeloggt && <span title="Deine Geo-Sternis"><Icon name="star" size={14} /> {kontostand.toLocaleString('de-DE')}</span>}
          </div>
        </div>

        <button className="ga-hl-katwahl" onClick={() => setWaehler(true)}>
          <span className="ic">{katIcon(kategorie)}</span>
          <span className="tx">
            <small>Kategorie</small>
            <b>{kategorie === MIX ? 'Mix – jede Frage eine andere' : kat?.name}</b>
          </span>
          <span className="aendern">Ändern <Icon name="next" size={14} /></span>
        </button>

        <div className="ga-hl-schnellwahl" role="group" aria-label="Schnellwahl Kategorie">
          {SCHNELLWAHL.filter(k => k === MIX || katsHier.has(k)).map(k => (
            <button key={k} className={`ga-hl-chip ${kategorie === k ? 'active' : ''}`} onClick={() => setze({ kategorie: k })} aria-pressed={kategorie === k}>
              <span className="ic">{katIcon(k)}</span>{k === MIX ? 'Mix' : HL_KAT[k]?.name}
            </button>
          ))}
          <button className="ga-hl-chip mehr" onClick={() => setWaehler(true)}>Alle {katsHier.size} …</button>
        </div>

        <div className="ga-hl-optionen">
          <div>
            <span className="lbl">Region</span>
            <div className="ga-seg">
              {HL_REGIONEN.map(r => <button key={r.key} className={a.region === r.key ? 'active' : ''} onClick={() => setze({ region: r.key })}>{r.name}</button>)}
            </div>
          </div>
          <div>
            <span className="lbl">Modus</span>
            <div className="ga-seg">
              {modi.map(m => (
                <button key={m} className={art === m ? 'active' : ''} onClick={() => setze({ art: m })}>
                  <Icon name={m === 'klassisch' ? 'fire' : m === 'leben' ? 'heart' : 'timer'} size={13} />
                  {m === 'leben' ? `${info?.config.leben ?? 3} Leben` : m === 'sprint' ? `${info?.config.sprintSek ?? 60} s` : 'Klassisch'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="lbl">Stufe</span>
            <div className="ga-seg">
              {HL_STUFEN.map(x => <button key={x.key} title={x.text} className={a.stufe === x.key ? 'active' : ''} onClick={() => setze({ stufe: x.key })}>{x.name}</button>)}
            </div>
          </div>
        </div>
        <p className="ga-hl-hinweistext">{HL_ARTEN.find(x => x.key === art)?.text} {HL_STUFEN.find(x => x.key === a.stufe)?.text}.</p>

        {/* Wette – eingeklappt, bis man sie einschaltet */}
        {wettbar && (
          <div className={`ga-hl-wettzeile ${mitWette ? 'an' : ''}`}>
            <label className="ga-hl-schalter">
              <input type="checkbox" checked={a.wetten} onChange={e => setze({ wetten: e.target.checked })} />
              <span><Icon name="star" size={14} /> Sternis setzen</span>
            </label>
            {mitWette ? (
              <div className="ga-hl-wett-felder">
                <label className="feld">
                  <span>Einsatz</span>
                  <input type="number" className="ga-input sm" min={1} max={cfgW?.maxEinsatz} value={a.einsatz}
                    onChange={e => setze({ einsatz: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} />
                </label>
                <label className="feld breit">
                  <span>Ziel: <b>{ziel} in Folge</b></span>
                  <input type="range" className="ga-hl-range" min={cfgW?.minZiel} max={cfgW?.maxZiel} value={ziel} onChange={e => setze({ ziel: Number(e.target.value) })} />
                </label>
                <div className="ga-hl-quote">
                  {!q ? <span className="ga-muted">Quote …</span>
                    : q.quote < 1.1 ? <span>Zu leicht – höheres Ziel wählen</span>
                      : <><span className="q">×{komma(q.quote)}</span><span>= <b>{Math.floor(einsatz * q.quote).toLocaleString('de-DE')}</b> Sternis</span></>}
                </div>
                <p className="ga-muted klein">
                  Schaffst du {ziel} richtige in Folge, bekommst du Einsatz × Quote. Ein Fehler vorher: Einsatz weg.
                  {q ? ` Trefferquote hier ≈ ${Math.round(q.p * 100)} %${q.antworten < 300 ? ' (geschätzt)' : ''}.` : ''}
                  {cfgW?.zeit ? ` ${cfgW.zeit} s pro Antwort, solange die Wette läuft.` : ''}
                  {kontostand < einsatz ? ' Nicht genug Sternis.' : ''}
                </p>
              </div>
            ) : <span className="ga-muted klein">Einsatz auf eine Serie – je schwerer, desto höher die Quote</span>}
          </div>
        )}

        <div className="ga-hl-spielen">
          <button className="ga-btn primary ga-hl-losbtn" disabled={spielenAus} onClick={() => starten()}>
            <Icon name="play" size={17} /> {mitWette ? `Spielen · ${einsatz.toLocaleString('de-DE')} Sternis` : 'Spielen'}
          </button>
          <span className="ga-muted klein">{regionName} · {katName(kategorie)} · {HL_ART_NAME[art]} · {HL_STUFE_NAME[a.stufe]}</span>
        </div>
        {!info?.eingeloggt && <p className="ga-muted klein" style={{ margin: '10px 0 0' }}>Ohne Login spielbar – XP, Sternis, Wetten und Rangliste nur <Link href="/login?redirect=/geo/higher-lower">eingeloggt</Link>.</p>}
      </section>

      {/* ───────────── Mit Freunden + Tagesrunde ───────────── */}
      <div className="ga-hl-unten">
        {info?.config.mehrspieler.an && <MitFreunden info={info} busy={busy} onNeu={raumNeu} auswahl={`${regionName} · ${katName(kategorie)} · ${HL_ART_NAME[art]} · ${HL_STUFE_NAME[a.stufe]}`} />}

        {info?.config.arten.tag && (
          <section className="ga-card ga-hl-tageskarte">
            <h2 className="ga-hl-h"><Icon name="calendar" size={16} /> Tagesrunde</h2>
            <p className="ga-muted klein">Heute für alle gleich: Welt · Mix · Mittel. Ein Fehler beendet die Runde, ein Versuch pro Tag.
              {info.config.tagBonus.some(b => b > 0) ? ` Platz 1–3: ${info.config.tagBonus.join(' / ')} Sternis.` : ''}</p>
            {!info.eingeloggt ? <Link href="/login?redirect=/geo/higher-lower" className="ga-btn sm">Einloggen zum Mitspielen</Link>
              : tagGespielt ? <p className="ga-hl-tag-ok"><Icon name="check" size={15} /> Heute: <b>{info.tagesrunde!.richtige} richtige</b></p>
                : <button className="ga-btn sm primary" disabled={busy} onClick={() => starten({ kategorie: MIX, art: 'tag' })}><Icon name="play" size={14} /> Tagesrunde spielen</button>}
          </section>
        )}
      </div>

      <div className="ga-hl-unten zwei">
        {info && <HlRangliste region={a.region} kategorie={kategorie} art={art} stufe={a.stufe} titel={`${regionName} · ${katName(kategorie)} · ${HL_ART_NAME[art]} · ${HL_STUFE_NAME[a.stufe]}`} tick={tick} />}
        {info && (
          <section className="ga-card ga-hl-bonus">
            <h2 className="ga-hl-h"><Icon name="fire" size={16} /> So gibt’s Punkte</h2>
            <div className="ga-hl-bonus-liste">
              {info.config.stufen.map((st, i) => <span key={i} className={`s${Math.min(i, 5)}`}><b>×{komma(st.faktor)}</b> ab {st.ab}</span>)}
            </div>
            <p className="ga-muted klein" style={{ margin: '10px 0 0' }}>
              {info.config.grund} Punkte × Serien-Bonus pro richtiger Antwort. Am Ende: Punkte ÷ {komma(info.config.xpTeiler)} = XP, Punkte ÷ {komma(info.config.sterniTeiler)} = Sternis
              {info.config.rekordBonus ? `, neuer Rekord (ab ${info.config.rekordMin}) +${info.config.rekordBonus} Sternis` : ''}.
              Tastatur: ↑ höher, ↓ niedriger. Am Handy: auf der Karte hoch oder runter wischen.
            </p>
          </section>
        )}
      </div>

      {waehler && info && (
        <KategorieFenster
          region={a.region} regionName={regionName} aktiv={kategorie} kats={katsHier}
          rekorde={info.rekorde ?? {}} art={art} stufe={a.stufe}
          onWahl={k => { setze({ kategorie: k }); setWaehler(false) }}
          onClose={() => setWaehler(false)}
        />
      )}

      {ergebnis && (
        <ErgebnisFenster e={ergebnis} info={info} busy={busy}
          onNochmal={() => starten({ kategorie: ergebnis.runde.kategorie, art: ergebnis.runde.art })}
          onClose={() => setErgebnis(null)} />
      )}
    </div>
  )
}

/* ───────────── Fenster: Kategorie wählen ───────────── */

function Fenster({ titel, onClose, children, breit }: { titel: string; onClose: () => void; children: React.ReactNode; breit?: boolean }) {
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', on)
    const alt = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', on); document.body.style.overflow = alt }
  }, [onClose])
  return (
    <div className="ga-hl-modal" role="dialog" aria-modal="true" aria-label={titel} onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`ga-hl-modal-box ${breit ? 'breit' : ''}`}>
        <div className="ga-hl-modal-kopf">
          <h2>{titel}</h2>
          <button className="ga-icon-btn" onClick={onClose} aria-label="Schließen"><Icon name="x" size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function KategorieFenster({ region, regionName, aktiv, kats, rekorde, art, stufe, onWahl, onClose }: {
  region: HlRegion; regionName: string; aktiv: string; kats: Set<string>; rekorde: Record<string, number>; art: HlArt; stufe: HlStufe
  onWahl: (k: string) => void; onClose: () => void
}) {
  const [suche, setSuche] = useState('')
  const [gruppe, setGruppe] = useState<HlGruppe | 'alle'>('alle')
  const s = suche.trim() ? normalize(suche) : ''
  const liste = HL_KATEGORIEN.filter(k => kats.has(k.key) && (gruppe === 'alle' || k.gruppe === gruppe) && (!s || normalize(k.name).includes(s)))
  const rek = (k: string) => rekorde[`${region}|${k}|${art}|${stufe}`]
  return (
    <Fenster titel={`Kategorie wählen · ${regionName}`} onClose={onClose} breit>
      <div className="ga-hl-modal-filter">
        <input className="ga-input sm" autoFocus placeholder="Suchen, z. B. Bier, Berg, Olympia …" value={suche} onChange={e => setSuche(e.target.value)} />
        <div className="ga-seg sm">
          <button className={gruppe === 'alle' ? 'active' : ''} onClick={() => setGruppe('alle')}>Alle</button>
          {GRUPPEN.map(g => <button key={g.key} className={gruppe === g.key ? 'active' : ''} onClick={() => setGruppe(g.key)}>{g.name}</button>)}
        </div>
      </div>
      <div className="ga-hl-modal-liste">
        {!s && gruppe === 'alle' && (
          <button className={`ga-hl-katbtn mix ${aktiv === MIX ? 'active' : ''}`} onClick={() => onWahl(MIX)}>
            <span className="ic">🎲</span><span className="nm"><b>Mix</b> – jede Frage eine andere Kategorie</span>
            {rek(MIX) ? <span className="rek"><Icon name="trophy" size={12} /> {rek(MIX)}</span> : null}
          </button>
        )}
        {GRUPPEN.filter(g => gruppe === 'alle' || g.key === gruppe).map(g => {
          const ks = liste.filter(k => k.gruppe === g.key)
          if (!ks.length) return null
          return (
            <div key={g.key}>
              <p className="ga-hl-gruppe-h">{g.name}</p>
              <div className="ga-hl-kats">
                {ks.map(k => (
                  <button key={k.key} className={`ga-hl-katbtn ${aktiv === k.key ? 'active' : ''}`} onClick={() => onWahl(k.key)} title={`${k.quelle}${k.jahr ? ` (${k.jahr})` : ''}`}>
                    <span className="ic">{k.icon}</span>
                    <span className="nm">{k.name}</span>
                    {rek(k.key) ? <span className="rek"><Icon name="trophy" size={12} /> {rek(k.key)}</span> : null}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
        {!liste.length && s && <p className="ga-muted">Nichts gefunden.</p>}
      </div>
    </Fenster>
  )
}

/* ───────────── Fenster: Ergebnis ───────────── */

function ErgebnisFenster({ e, info, busy, onNochmal, onClose }: { e: Ergebnis; info: HlInfo | null; busy: boolean; onNochmal: () => void; onClose: () => void }) {
  const r = e.runde
  const kat = HL_KAT[r.kat]
  const xp = (e.belohnung?.xp ?? []).reduce((s, g) => s + g.amount, 0)
  const st = (e.belohnung?.sternis ?? []).reduce((s, g) => s + g.amount, 0)
  const l = e.letzte
  const tag = r.art === 'tag'
  const knopf = useRef<HTMLButtonElement>(null)
  useEffect(() => { knopf.current?.focus() }, [])
  return (
    <Fenster titel="Runde vorbei" onClose={onClose}>
      <div className="ga-hl-ergebnis">
        <div className="kopf">
          <span className="gross">{r.richtige}</span>
          <div>
            <b>{r.richtige === 1 ? 'richtige Antwort' : 'richtige Antworten'}</b>
            <span className="ga-muted">{HL_REGIONEN.find(x => x.key === r.region)?.name} · {katName(r.kategorie)} · {HL_ART_NAME[r.art]}{tag ? '' : ` · ${HL_STUFE_NAME[r.stufe]}`}</span>
          </div>
        </div>
        {e.belohnung?.rekord && r.richtige >= (info?.config.rekordMin ?? 5) && <p className="ga-hl-rekord"><Icon name="trophy" size={15} /> Neuer persönlicher Rekord!</p>}
        {l && !l.richtig && l.rechts.wert != null && kat && l.grund !== 'sprint-ende' && (
          <p className="letzte">
            {l.grund === 'zeit' ? 'Zeit abgelaufen – ' : 'Daneben – '}
            {l.rechts.name}: <b>{fmtWert(l.rechts.wert, kat)}</b>{r.links.name !== l.rechts.name ? <>, {r.links.name}: <b>{r.links.text}</b></> : null}
          </p>
        )}
        <div className="ga-hl-erg-zahlen">
          <div><b>{r.punkte.toLocaleString('de-DE')}</b><span>Punkte</span></div>
          <div><b>{r.besteSerie}</b><span>beste Serie</span></div>
          {info?.eingeloggt && <div><b>+{xp}</b><span>XP</span></div>}
          {info?.eingeloggt && <div><b>+{(st + e.gewinnWette).toLocaleString('de-DE')}</b><span>Sternis</span></div>}
        </div>
        {r.einsatz > 0 && (
          <p className={`ga-hl-wett-erg ${r.wette === 'gewonnen' ? 'ok' : 'bad'}`}>
            <Icon name="star" size={14} /> Wette {r.einsatz} auf {r.ziel} in Folge: {r.wette === 'gewonnen' ? `gewonnen, +${Math.floor(r.einsatz * Number(r.quote)).toLocaleString('de-DE')}` : 'verloren'}
          </p>
        )}
        {!info?.eingeloggt && <p className="ga-muted klein">Eingeloggt hättest du dafür XP und Sternis bekommen.</p>}
        <div className="ga-hl-erg-knoepfe">
          {!tag && <button ref={knopf} className="ga-btn primary" disabled={busy} onClick={onNochmal}><Icon name="refresh" size={15} /> Nochmal</button>}
          <button ref={tag ? knopf : undefined} className="ga-btn" onClick={onClose}>{tag ? 'Schließen' : 'Andere Auswahl'}</button>
        </div>
      </div>
    </Fenster>
  )
}

/* ───────────── Mit Freunden spielen ───────────── */

function MitFreunden({ info, busy, onNeu, auswahl }: { info: HlInfo; busy: boolean; onNeu: (m: 'duell' | 'team', einsatz: number) => void; auswahl: string }) {
  const m = info.config.mehrspieler
  const [einsatz, setEinsatz] = useState(0)
  if (!info.eingeloggt) {
    return (
      <section className="ga-card ga-hl-freunde">
        <h2 className="ga-hl-h"><Icon name="users" size={16} /> Mit Freunden spielen</h2>
        <p className="ga-muted klein">Duell gegeneinander oder als Team miteinander – dafür bitte <Link href="/login?redirect=/geo/higher-lower">einloggen</Link>.</p>
      </section>
    )
  }
  return (
    <section className="ga-card ga-hl-freunde">
      <h2 className="ga-hl-h"><Icon name="users" size={16} /> Mit Freunden spielen <span className="ga-muted">· {auswahl}</span></h2>
      <div className="ga-hl-freunde-wahl">
        <div className="ga-hl-modus">
          <b><Icon name="bolt" size={15} /> Duell</b>
          <span>Gegeneinander, bis zu {m.maxDuell} Spieler. Alle bekommen dieselben Paare – wer am weitesten kommt, gewinnt.</span>
          {m.topf && (
            <label className="ga-hl-topf-feld">
              <Icon name="star" size={13} /> Einsatz
              <input type="number" className="ga-input sm" min={0} max={m.maxEinsatz} value={einsatz} onChange={e => setEinsatz(Math.max(0, Math.min(m.maxEinsatz, Math.floor(Number(e.target.value) || 0))))} />
              <span className="ga-muted">{einsatz > 0 ? 'Sieger bekommt den Topf' : 'ohne Topf'}</span>
            </label>
          )}
          <button className="ga-btn primary sm" disabled={busy} onClick={() => onNeu('duell', einsatz)}><Icon name="link" size={14} /> Duell erstellen</button>
        </div>
        <div className="ga-hl-modus">
          <b><Icon name="users" size={15} /> Team</b>
          <span>Miteinander, bis zu {m.maxTeam} Spieler. Reihum ist jemand dran, die anderen schlagen vor. Alle bekommen dieselben Punkte.</span>
          <button className="ga-btn sm" disabled={busy} onClick={() => onNeu('team', 0)}><Icon name="link" size={14} /> Team erstellen</button>
        </div>
      </div>
      <p className="ga-muted klein" style={{ margin: '10px 0 0' }}>Du bekommst einen Einladungslink. Einstellungen kannst du im Warteraum noch ändern.</p>
    </section>
  )
}

/* ───────────── Noch gesperrt: Countdown bis zur Freischaltung ───────────── */

function Sperre({ bis, onFrei }: { bis: string; onFrei: () => void }) {
  const ziel = Date.parse(bis)
  const [jetzt, setJetzt] = useState(0)
  useEffect(() => {
    const t = setInterval(() => {
      const n = Date.now()
      setJetzt(n)
      if (n >= ziel) { clearInterval(t); setTimeout(onFrei, 1500) }
    }, 1000)
    return () => clearInterval(t)
  }, [ziel, onFrei])
  const rest = jetzt ? Math.max(0, ziel - jetzt) : null
  const teile = rest == null ? null : [
    { n: Math.floor(rest / 86400000), l: 'Tage' },
    { n: Math.floor((rest % 86400000) / 3600000), l: 'Stunden' },
    { n: Math.floor((rest % 3600000) / 60000), l: 'Minuten' },
    { n: Math.floor((rest % 60000) / 1000), l: 'Sekunden' },
  ]
  const datum = new Date(ziel).toLocaleString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  return (
    <div className="ga-page ga-hl">
      <section className="ga-hl-hero ga-hl-sperre">
        <div className="ga-hl-sperre-icon"><Icon name="lock" size={30} /></div>
        <p className="ga-eyebrow">Bald im Atlas</p>
        <h1 className="ga-hl-titel">Higher <span>Lower</span></h1>
        <p className="ga-muted">Welches Land hat mehr? Über 60 Kategorien, Serien-Bonus, Sternis-Wetten, Duell und Team.</p>
        <div className="ga-hl-countdown" aria-live="polite">
          {(teile ?? [{ n: 0, l: 'Tage' }, { n: 0, l: 'Stunden' }, { n: 0, l: 'Minuten' }, { n: 0, l: 'Sekunden' }]).map(x => (
            <div key={x.l}><b>{teile ? String(x.n).padStart(2, '0') : '–'}</b><span>{x.l}</span></div>
          ))}
        </div>
        <p className="ga-hl-sperre-datum">{rest === 0 ? 'Gleich geht’s los …' : <>Freischaltung am <b>{datum} Uhr</b></>}</p>
        <Link href="/geo" className="ga-btn"><Icon name="back" size={15} /> Zurück zum Atlas</Link>
      </section>
    </div>
  )
}