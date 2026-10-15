'use client'

// Geo-Admin → Higher Lower: Übersicht (Runden, Einsätze, Auszahlungen, Trefferquoten), alle Einstellungen
// (Punkte, Serien-Bonus, XP/Sternis, Spielarten, Wetten mit Quoten-Vorschau), Kategorien an/aus und Werte korrigieren.

import { useCallback, useEffect, useState } from 'react'
import Icon from '../../_components/Icon'
import { HL_KATEGORIEN, HL_KAT } from '../../_data/hl'
import { HL_ARTEN, HL_STUFEN, MIX, fmtWert, quoteFuer, type HlConfig, type HlStufe } from '../../_lib/hl'
import { adminPost, countdown, fmtDate, toLocalInput } from './shared'

interface Korrektur { wert: number | null; jahr: number | null; quelle: string | null; von: string | null; am: string }
interface HlAdmin {
  canWrite: boolean
  savedAt: string | null
  config: HlConfig
  korrekturen: Record<string, Record<string, Korrektur>>
  stats: { runden: number; runden_tag: number; spieler: number; einsatz: number; ausgezahlt: number; sternis: number; beste: number }
  kategorien: { kategorie: string; n: number; r: number; f: number }[]
  top: { name: string; richtige: number; kategorie: string; region: string; art: string; stufe: string }[]
  stand: string
}
type WertZeile = { id: string; name: string; original: number | null; jahr: number | null; korrektur: Korrektur | null }

const PFAD = '/api/geo/admin/hl'
const komma = (n: number) => String(n).replace('.', ',')
const kopie = <T,>(x: T): T => JSON.parse(JSON.stringify(x))

export default function AdminHl({ flash }: { flash: (msg: string, bad?: boolean) => void }) {
  const [d, setD] = useState<HlAdmin | null>(null)
  const [cfg, setCfg] = useState<HlConfig | null>(null)
  const [busy, setBusy] = useState(false)
  const [offen, setOffen] = useState<string | null>(null)
  const [suche, setSuche] = useState('')

  const [tick, setTick] = useState(0)
  const laden = useCallback(() => setTick(t => t + 1), [])
  useEffect(() => {
    let alive = true
    fetch(PFAD, { cache: 'no-store' })
      .then(async r => {
        const j = await r.json()
        if (!alive) return
        if (!r.ok) flash(j.error || 'Fehler beim Laden', true)
        else { setD(j); setCfg(kopie(j.config)) }
      })
      .catch(() => flash('Fehler beim Laden', true))
    return () => { alive = false }
  }, [tick, flash])

  if (!d || !cfg) return <div className="ga-map-loading">Lädt …</div>
  const ro = !d.canWrite
  const set = (fn: (c: HlConfig) => void) => setCfg(c => { const n = kopie(c!); fn(n); return n })
  const num = (v: string) => (v === '' ? 0 : Number(v))
  const save = async () => {
    setBusy(true)
    try { await adminPost({ action: 'config', config: cfg }, PFAD); flash('Higher Lower gespeichert'); laden() }
    catch (e) { flash(e instanceof Error ? e.message : 'Fehler', true) } finally { setBusy(false) }
  }
  const s = d.stats
  const kats = HL_KATEGORIEN.filter(k => !suche.trim() || k.name.toLowerCase().includes(suche.trim().toLowerCase()))

  return (
    <div className="ga-adm-cols">
      <section className="ga-card">
        <h3 className="ga-adm-h">Übersicht</h3>
        <div className="ga-stat-row" style={{ marginTop: 6 }}>
          <div><b>{s.runden.toLocaleString('de-DE')}</b><span>Runden</span></div>
          <div><b>{s.runden_tag.toLocaleString('de-DE')}</b><span>Runden (24 Std.)</span></div>
          <div><b>{s.spieler.toLocaleString('de-DE')}</b><span>Spieler</span></div>
          <div><b>{s.beste}</b><span>beste Serie</span></div>
        </div>
        <div className="ga-stat-row" style={{ marginTop: 10 }}>
          <div><b>{s.einsatz.toLocaleString('de-DE')}</b><span>Sternis gesetzt</span></div>
          <div><b>{s.ausgezahlt.toLocaleString('de-DE')}</b><span>aus Wetten ausgezahlt</span></div>
          <div><b>{s.sternis.toLocaleString('de-DE')}</b><span>Sternis aus Runden</span></div>
        </div>
        <p className="ga-muted" style={{ fontSize: 12.5 }}>Daten-Stand: {d.stand} · Werte neu bauen: <code>node scripts/geo/build-higherlower.mjs</code></p>
        {d.top.length > 0 && (
          <>
            <span className="ga-adm-label" style={{ marginTop: 12 }}>Beste Runden</span>
            <table className="ga-adm-mini"><tbody>
              {d.top.map((t, i) => <tr key={i}><td>{t.name}</td><td><b>{t.richtige}</b></td><td className="ga-muted">{t.kategorie === MIX ? 'Mix' : HL_KAT[t.kategorie]?.name ?? t.kategorie} · {t.region} · {t.art} · {t.stufe}</td></tr>)}
            </tbody></table>
          </>
        )}
      </section>

      <section className="ga-card">
        <h3 className="ga-adm-h">Punkte & Belohnung</h3>
        <label className="ga-row" style={{ gap: 6 }}><input type="checkbox" checked={cfg.aktiv} disabled={ro} onChange={e => set(c => { c.aktiv = e.target.checked })} /> Higher Lower für alle sichtbar (aus = nur Admins)</label>
        <div className="ga-hl-adm-freigabe">
          <span className="ga-adm-label" style={{ marginTop: 12 }}>Freischaltung für alle</span>
          <p className="ga-muted ga-adm-hint">Bis dahin sehen normale Nutzer einen Countdown, Admins können schon spielen.</p>
          <div className="ga-row ga-wrap" style={{ gap: 8 }}>
            <input type="datetime-local" className="ga-input" style={{ width: 230 }} disabled={ro}
              value={cfg.freigabe ? toLocalInput(new Date(cfg.freigabe)) : ''}
              onChange={e => set(c => { c.freigabe = e.target.value ? new Date(e.target.value).toISOString() : null })} />
            {!ro && <button className="ga-btn ghost sm" onClick={() => set(c => { c.freigabe = null })}>Sofort freischalten</button>}
          </div>
          <FreigabeStatus freigabe={cfg.freigabe} />
        </div>
        <div className="ga-adm-grid">
          <label>Punkte pro richtiger Antwort<input className="ga-input" type="number" min={0} value={cfg.grund} disabled={ro} onChange={e => set(c => { c.grund = num(e.target.value) })} /></label>
          <label>Punkte ÷ … = XP<input className="ga-input" type="number" min={1} value={cfg.xpTeiler} disabled={ro} onChange={e => set(c => { c.xpTeiler = num(e.target.value) })} /></label>
          <label>Punkte ÷ … = Sternis<input className="ga-input" type="number" min={1} value={cfg.sterniTeiler} disabled={ro} onChange={e => set(c => { c.sterniTeiler = num(e.target.value) })} /></label>
          <label>Sternis-Grenze pro Tag (0 = keine)<input className="ga-input" type="number" min={0} value={cfg.tagesLimit} disabled={ro} onChange={e => set(c => { c.tagesLimit = num(e.target.value) })} /></label>
          <label>Rekord-Bonus (Sternis)<input className="ga-input" type="number" min={0} value={cfg.rekordBonus} disabled={ro} onChange={e => set(c => { c.rekordBonus = num(e.target.value) })} /></label>
          <label>Rekord zählt ab … richtigen<input className="ga-input" type="number" min={1} value={cfg.rekordMin} disabled={ro} onChange={e => set(c => { c.rekordMin = num(e.target.value) })} /></label>
        </div>
        <span className="ga-adm-label" style={{ marginTop: 14 }}>Serien-Bonus (Multiplikator wächst mit der Serie)</span>
        {cfg.stufen.map((st, i) => (
          <div key={i} className="ga-row" style={{ gap: 8, marginBottom: 6 }}>
            ab <input className="ga-input sm" style={{ width: 80 }} type="number" min={0} value={st.ab} disabled={ro || i === 0} onChange={e => set(c => { c.stufen[i].ab = num(e.target.value) })} /> in Folge
            × <input className="ga-input sm" style={{ width: 80 }} type="number" step="0.1" min={0} value={st.faktor} disabled={ro} onChange={e => set(c => { c.stufen[i].faktor = num(e.target.value) })} />
            {!ro && i > 0 && <button className="ga-icon-btn sm" onClick={() => set(c => { c.stufen.splice(i, 1) })} aria-label="Stufe entfernen"><Icon name="x" size={13} /></button>}
          </div>
        ))}
        {!ro && <button className="ga-btn ghost sm" onClick={() => set(c => { const l = c.stufen.at(-1)!; c.stufen.push({ ab: l.ab + 10, faktor: l.faktor + 1 }) })}><Icon name="plus" size={14} /> Stufe hinzufügen</button>}
        <p className="ga-muted ga-adm-hint" style={{ marginTop: 8 }}>
          Beispiel 20 richtige in Folge: {(() => { let p = 0; for (let k = 1; k <= 20; k++) { let f = 1; for (const st of cfg.stufen) if (k >= st.ab) f = st.faktor; p += Math.round(cfg.grund * f) } return `${p.toLocaleString('de-DE')} Punkte → ${Math.floor(p / cfg.xpTeiler)} XP, ${Math.floor(p / cfg.sterniTeiler)} Sternis` })()}
        </p>
      </section>

      <section className="ga-card">
        <h3 className="ga-adm-h">Spielarten</h3>
        <div className="ga-row ga-wrap" style={{ gap: 14 }}>
          {HL_ARTEN.map(a => (
            <label key={a.key} className="ga-row" style={{ gap: 6 }}><input type="checkbox" checked={cfg.arten[a.key]} disabled={ro} onChange={e => set(c => { c.arten[a.key] = e.target.checked })} /> {a.name}</label>
          ))}
        </div>
        <div className="ga-adm-grid">
          <label>Leben (Spielart „Leben“)<input className="ga-input" type="number" min={1} max={20} value={cfg.leben} disabled={ro} onChange={e => set(c => { c.leben = num(e.target.value) })} /></label>
          <label>Sprint: Sekunden<input className="ga-input" type="number" min={10} value={cfg.sprintSek} disabled={ro} onChange={e => set(c => { c.sprintSek = num(e.target.value) })} /></label>
          <label>Sprint: Strafe pro Fehler (s)<input className="ga-input" type="number" min={0} value={cfg.sprintStrafe} disabled={ro} onChange={e => set(c => { c.sprintStrafe = num(e.target.value) })} /></label>
        </div>
        <span className="ga-adm-label" style={{ marginTop: 12 }}>Tagesrunde: Sternis für Platz 1 / 2 / 3 (am nächsten Tag)</span>
        <div className="ga-row" style={{ gap: 8 }}>
          {[0, 1, 2].map(i => <input key={i} className="ga-input sm" style={{ width: 80 }} type="number" min={0} value={cfg.tagBonus[i]} disabled={ro} onChange={e => set(c => { c.tagBonus[i] = num(e.target.value) })} />)}
        </div>
      </section>

      <section className="ga-card">
        <h3 className="ga-adm-h">Mehrspieler</h3>
        <p className="ga-muted ga-adm-hint">Duell = gegeneinander mit denselben Paaren, optional mit Topf (Sieger bekommt alle Einsätze, Gleichstand wird geteilt). Team = eine gemeinsame Runde, reihum, alle bekommen dieselben XP/Sternis.</p>
        <label className="ga-row" style={{ gap: 6 }}><input type="checkbox" checked={cfg.mehrspieler.an} disabled={ro} onChange={e => set(c => { c.mehrspieler.an = e.target.checked })} /> Duell und Team erlaubt</label>
        <label className="ga-row" style={{ gap: 6, marginTop: 6 }}><input type="checkbox" checked={cfg.mehrspieler.topf} disabled={ro} onChange={e => set(c => { c.mehrspieler.topf = e.target.checked })} /> Topf im Duell (Sternis setzen)</label>
        <div className="ga-adm-grid">
          <label>Höchstens Spieler im Duell<input className="ga-input" type="number" min={2} max={20} value={cfg.mehrspieler.maxDuell} disabled={ro} onChange={e => set(c => { c.mehrspieler.maxDuell = num(e.target.value) })} /></label>
          <label>Höchstens Spieler im Team<input className="ga-input" type="number" min={2} max={10} value={cfg.mehrspieler.maxTeam} disabled={ro} onChange={e => set(c => { c.mehrspieler.maxTeam = num(e.target.value) })} /></label>
          <label>Höchster Einsatz pro Spieler<input className="ga-input" type="number" min={1} value={cfg.mehrspieler.maxEinsatz} disabled={ro} onChange={e => set(c => { c.mehrspieler.maxEinsatz = num(e.target.value) })} /></label>
        </div>
      </section>

      <section className="ga-card">
        <h3 className="ga-adm-h">Wetten</h3>
        <p className="ga-muted ga-adm-hint">Quote = Rückgabe ÷ Trefferquote<sup>Ziel</sup>. Die Trefferquote kommt aus den echten Runden der letzten 120 Tage (je Region × Kategorie × Stufe); solange es weniger Antworten als unten eingestellt gibt, wird sie mit dem Startwert gemischt.</p>
        <label className="ga-row" style={{ gap: 6 }}><input type="checkbox" checked={cfg.wetten.an} disabled={ro} onChange={e => set(c => { c.wetten.an = e.target.checked })} /> Wetten erlaubt</label>
        <div className="ga-adm-grid">
          <label>Rückgabe (0,85 = 15 % gehen im Schnitt verloren)<input className="ga-input" type="number" step="0.01" min={0.1} max={1.5} value={cfg.wetten.rueckgabe} disabled={ro} onChange={e => set(c => { c.wetten.rueckgabe = num(e.target.value) })} /></label>
          <label>Höchstquote<input className="ga-input" type="number" min={1} value={cfg.wetten.maxQuote} disabled={ro} onChange={e => set(c => { c.wetten.maxQuote = num(e.target.value) })} /></label>
          <label>Kleinstes Ziel<input className="ga-input" type="number" min={1} value={cfg.wetten.minZiel} disabled={ro} onChange={e => set(c => { c.wetten.minZiel = num(e.target.value) })} /></label>
          <label>Größtes Ziel<input className="ga-input" type="number" min={1} value={cfg.wetten.maxZiel} disabled={ro} onChange={e => set(c => { c.wetten.maxZiel = num(e.target.value) })} /></label>
          <label>Höchster Einsatz<input className="ga-input" type="number" min={1} value={cfg.wetten.maxEinsatz} disabled={ro} onChange={e => set(c => { c.wetten.maxEinsatz = num(e.target.value) })} /></label>
          <label>Sekunden pro Antwort bei Wette (0 = kein Limit)<input className="ga-input" type="number" min={0} value={cfg.wetten.zeit} disabled={ro} onChange={e => set(c => { c.wetten.zeit = num(e.target.value) })} /></label>
          {HL_STUFEN.map(x => (
            <label key={x.key}>Start-Trefferquote {x.name}<input className="ga-input" type="number" step="0.01" min={0.3} max={0.99} value={cfg.wetten.startP[x.key]} disabled={ro} onChange={e => set(c => { c.wetten.startP[x.key as HlStufe] = num(e.target.value) })} /></label>
          ))}
          <label>Ab so vielen Antworten nur echte Quote<input className="ga-input" type="number" min={0} value={cfg.wetten.minAntworten} disabled={ro} onChange={e => set(c => { c.wetten.minAntworten = num(e.target.value) })} /></label>
        </div>
        <span className="ga-adm-label" style={{ marginTop: 12 }}>Quoten-Vorschau (mit Startwerten, Kategorie mittelschwer)</span>
        <table className="ga-adm-mini">
          <thead><tr><th>Ziel</th>{HL_STUFEN.map(x => <th key={x.key}>{x.name}</th>)}</tr></thead>
          <tbody>
            {[5, 10, 15, 20, 30, 40].map(z => (
              <tr key={z}><td>{z}</td>{HL_STUFEN.map(x => {
                const q = quoteFuer(cfg.wetten.startP[x.key], z, cfg.wetten.rueckgabe, cfg.wetten.maxQuote)
                return <td key={x.key}>{q < 1.1 ? <span className="ga-muted">zu leicht</span> : `×${komma(q)}`}</td>
              })}</tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="ga-card" style={{ gridColumn: '1 / -1' }}>
        <div className="ga-row" style={{ justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <h3 className="ga-adm-h" style={{ margin: 0 }}>Kategorien ({HL_KATEGORIEN.length})</h3>
          <input className="ga-input sm" style={{ width: 220 }} placeholder="Suchen …" value={suche} onChange={e => setSuche(e.target.value)} />
        </div>
        <p className="ga-muted ga-adm-hint">Aus = taucht nirgends auf. Wetten aus = man kann nicht darauf wetten. Eigene Höchstquote = z. B. für sehr leichte Kategorien. Trefferquote = letzte 30 Tage, alle Stufen.</p>
        <div className="ga-adm-table">
          <table>
            <thead><tr><th>Kategorie</th><th>Länder (Welt/EU/SA)</th><th>Quelle</th><th>Runden 30 T.</th><th>Aus</th><th>Wetten aus</th><th>Höchstquote</th><th></th></tr></thead>
            <tbody>
              {kats.map(k => {
                const st = d.kategorien.find(x => x.kategorie === k.key)
                const kc = cfg.kategorien[k.key] ?? {}
                const nk = Object.keys(d.korrekturen[k.key] ?? {}).length
                const setK = (p: Partial<typeof kc>) => set(c => {
                  const n = { ...(c.kategorien[k.key] ?? {}), ...p }
                  for (const key of Object.keys(n) as (keyof typeof n)[]) if (!n[key]) delete n[key]
                  if (Object.keys(n).length) c.kategorien[k.key] = n; else delete c.kategorien[k.key]
                })
                return (
                  <tr key={k.key} className={offen === k.key ? 'sel' : ''}>
                    <td>{k.icon} {k.name} <span className="ga-muted" style={{ fontSize: 12 }}>· {k.gruppe}</span></td>
                    <td className="ga-muted">{k.regionen.welt ?? '–'} / {k.regionen.europa ?? '–'} / {k.regionen.suedamerika ?? '–'}</td>
                    <td className="ga-muted" style={{ fontSize: 12.5 }}>{k.url ? <a href={k.url} target="_blank" rel="noopener noreferrer">{k.quelle}</a> : k.quelle}{k.jahr ? ` (${k.jahr})` : ''}</td>
                    <td>{st ? `${st.n} · ${st.r + st.f ? Math.round((st.r / (st.r + st.f)) * 100) : 0} %` : <span className="ga-muted">–</span>}</td>
                    <td><input type="checkbox" checked={!!kc.aus} disabled={ro} onChange={e => setK({ aus: e.target.checked })} /></td>
                    <td><input type="checkbox" checked={!!kc.wettenAus} disabled={ro} onChange={e => setK({ wettenAus: e.target.checked })} /></td>
                    <td><input className="ga-input sm" style={{ width: 80 }} type="number" min={1} placeholder="–" value={kc.maxQuote ?? ''} disabled={ro} onChange={e => setK({ maxQuote: e.target.value === '' ? undefined : num(e.target.value) })} /></td>
                    <td><button className="ga-btn ghost sm" onClick={() => setOffen(offen === k.key ? null : k.key)}>Werte{nk ? ` (${nk} geändert)` : ''}</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {offen && <WerteEditor key={offen} kat={offen} ro={ro} flash={flash} onChange={laden} onClose={() => setOffen(null)} />}

      {!ro && (
        <div className="ga-adm-savebar">
          <button className="ga-btn primary" disabled={busy} onClick={save}><Icon name="check" size={15} /> Higher Lower speichern</button>
          <button className="ga-btn ghost" disabled={busy} onClick={() => setCfg(kopie(d.config))}>Änderungen verwerfen</button>
          <span className="ga-muted" style={{ fontSize: 12.5 }}>Zuletzt gespeichert: {fmtDate(d.savedAt)}</span>
        </div>
      )}
    </div>
  )
}

function WerteEditor({ kat, ro, flash, onChange, onClose }: { kat: string; ro: boolean; flash: (m: string, bad?: boolean) => void; onChange: () => void; onClose: () => void }) {
  const k = HL_KAT[kat]
  const [zeilen, setZeilen] = useState<WertZeile[] | null>(null)
  const [edit, setEdit] = useState<Record<string, { wert: string; jahr: string; quelle: string }>>({})
  const [filter, setFilter] = useState('')

  const [tick, setTick] = useState(0)
  const laden = useCallback(() => setTick(t => t + 1), [])
  useEffect(() => {
    let alive = true
    fetch(`${PFAD}?werte=${encodeURIComponent(kat)}`, { cache: 'no-store' })
      .then(async r => {
        const j = await r.json()
        if (!alive) return
        if (r.ok) setZeilen(j.werte); else flash(j.error || 'Fehler', true)
      })
      .catch(() => flash('Fehler beim Laden', true))
    return () => { alive = false }
  }, [kat, flash, tick])

  const speichern = async (id: string, wert: number | null) => {
    const e = edit[id]
    try {
      await adminPost({ action: 'korrektur', kat, id, wert, jahr: e?.jahr || null, quelle: e?.quelle || null }, PFAD)
      flash(wert === null ? 'Land aus der Kategorie genommen' : 'Wert gespeichert')
      setEdit(x => { const n = { ...x }; delete n[id]; return n })
      laden(); onChange()
    } catch (err) { flash(err instanceof Error ? err.message : 'Fehler', true) }
  }
  const zuruecksetzen = async (id: string) => {
    try { await adminPost({ action: 'korrekturWeg', kat, id }, PFAD); flash('Originalwert gilt wieder'); laden(); onChange() }
    catch (err) { flash(err instanceof Error ? err.message : 'Fehler', true) }
  }

  const f = filter.trim().toLowerCase()
  return (
    <section className="ga-card" style={{ gridColumn: '1 / -1' }}>
      <div className="ga-row" style={{ justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <h3 className="ga-adm-h" style={{ margin: 0 }}>{k?.icon} {k?.name}: Werte</h3>
        <div className="ga-row" style={{ gap: 8 }}>
          <input className="ga-input sm" style={{ width: 180 }} placeholder="Land suchen …" value={filter} onChange={e => setFilter(e.target.value)} />
          <button className="ga-btn ghost sm" onClick={onClose}><Icon name="x" size={14} /> Schließen</button>
        </div>
      </div>
      <p className="ga-muted ga-adm-hint">Original aus: {k?.quelle}{k?.jahr ? ` (${k.jahr})` : ''}. Eine Korrektur ersetzt den Wert sofort im Spiel (Einheit: {k?.einheit || 'Zahl'}).</p>
      {!zeilen ? <p className="ga-muted">Lädt …</p> : (
        <div className="ga-adm-table" style={{ maxHeight: 520, overflowY: 'auto' }}>
          <table>
            <thead><tr><th>Land</th><th>Original</th><th>Jahr</th><th>Korrektur</th><th>Jahr</th><th>Quelle</th><th></th></tr></thead>
            <tbody>
              {zeilen.filter(z => !f || z.name.toLowerCase().includes(f)).map(z => {
                const e = edit[z.id]
                return (
                  <tr key={z.id} className={z.korrektur ? 'sel' : ''}>
                    <td>{z.name}</td>
                    <td>{z.original != null && k ? fmtWert(z.original, k) : '–'}</td>
                    <td className="ga-muted">{z.jahr ?? '–'}</td>
                    <td>
                      {z.korrektur && !e ? (
                        <span>{z.korrektur.wert === null ? <i>entfernt</i> : k ? fmtWert(z.korrektur.wert, k) : z.korrektur.wert} <span className="ga-muted" style={{ fontSize: 11.5 }}>· {z.korrektur.von}, {fmtDate(z.korrektur.am)}</span></span>
                      ) : !ro ? (
                        <input className="ga-input sm" style={{ width: 120 }} type="number" step="any" placeholder={z.original != null ? String(z.original) : 'Wert'}
                          value={e?.wert ?? ''} onChange={ev => setEdit(x => ({ ...x, [z.id]: { wert: ev.target.value, jahr: x[z.id]?.jahr ?? '', quelle: x[z.id]?.quelle ?? '' } }))} />
                      ) : null}
                    </td>
                    <td>{e && <input className="ga-input sm" style={{ width: 76 }} type="number" placeholder="Jahr" value={e.jahr} onChange={ev => setEdit(x => ({ ...x, [z.id]: { ...x[z.id], jahr: ev.target.value } }))} />}{!e && z.korrektur?.jahr}</td>
                    <td>{e && <input className="ga-input sm" style={{ width: 160 }} placeholder="Quelle" value={e.quelle} onChange={ev => setEdit(x => ({ ...x, [z.id]: { ...x[z.id], quelle: ev.target.value } }))} />}{!e && <span className="ga-muted" style={{ fontSize: 12 }}>{z.korrektur?.quelle}</span>}</td>
                    <td>
                      {!ro && (
                        <div className="ga-row" style={{ gap: 4 }}>
                          {e && e.wert !== '' && <button className="ga-btn primary sm" onClick={() => speichern(z.id, Number(e.wert))}>Speichern</button>}
                          {z.korrektur && <button className="ga-btn ghost sm" onClick={() => zuruecksetzen(z.id)}>Original</button>}
                          {!z.korrektur && <button className="ga-btn ghost sm" title="Land aus dieser Kategorie nehmen" onClick={() => speichern(z.id, null)}>Raus</button>}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

/** Zeigt, ob Higher Lower noch gesperrt ist (aktualisiert sich jede halbe Minute) */
function FreigabeStatus({ freigabe }: { freigabe: string | null }) {
  const [jetzt, setJetzt] = useState(0)
  useEffect(() => {
    const t0 = setTimeout(() => setJetzt(Date.now()), 0)
    const t = setInterval(() => setJetzt(Date.now()), 30000)
    return () => { clearTimeout(t0); clearInterval(t) }
  }, [])
  if (!jetzt) return null
  const zu = freigabe && Date.parse(freigabe) > jetzt
  return (
    <p className="ga-muted" style={{ fontSize: 12.5, margin: '6px 0 0' }}>
      {zu ? `Gesperrt bis ${fmtDate(freigabe)} (${countdown(freigabe!, jetzt)})` : 'Freigeschaltet – alle können spielen.'} Speichern nicht vergessen.
    </p>
  )
}