'use client'

// Geo-Admin → XP & Level: alle Grundwerte (XP pro Eintrag, %-Stufen, fehlerfrei, Mehrspieler),
// Schwierigkeiten mit Faktor, Level-Formel mit Vorschau, Geo-Sternis (Belohnungen und Preise), Standard-Rechte der Spielarten, Ton, Ranglisten.

import { useState } from 'react'
import Icon from '../../_components/Icon'
import { DIFFICULTIES, MODE_KEYS, MODE_LABEL, sternisBetween, sternisForLevel, totalXpFor, xpForLevel, type GeoConfig, type ModeKey, type ModeRule } from '../../_lib/xp'
import { adminPost, fmtDate, RulePicker, type AdminData } from './shared'

export default function AdminXp({ data, reload, flash }: { data: AdminData; reload: () => void; flash: (msg: string, bad?: boolean) => void }) {
  const [cfg, setCfg] = useState<GeoConfig>(() => JSON.parse(JSON.stringify(data.config)))
  const [busy, setBusy] = useState(false)
  const ro = !data.canWrite
  const set = (fn: (c: GeoConfig) => void) => setCfg(c => { const n = JSON.parse(JSON.stringify(c)) as GeoConfig; fn(n); return n })

  const save = async () => {
    setBusy(true)
    try { await adminPost({ action: 'config', config: cfg }); flash('Einstellungen gespeichert'); reload() } catch (e) { flash(e instanceof Error ? e.message : 'Fehler', true) } finally { setBusy(false) }
  }

  const num = (v: string) => (v === '' ? 0 : Number(v))

  return (
    <div className="ga-adm-cols">
      <section className="ga-card">
        <h3 className="ga-adm-h">XP pro Aktion</h3>
        <p className="ga-muted ga-adm-hint">Alle Werte werden mit dem Faktor der Schwierigkeit, dem Faktor des Quiz, dem persönlichen Faktor des Nutzers und einem laufenden Boost multipliziert.</p>
        <div className="ga-adm-grid">
          <label>Ort/Frage erstmals richtig<input className="ga-input" type="number" min={0} value={cfg.xp.item} disabled={ro} onChange={e => set(c => { c.xp.item = num(e.target.value) })} /></label>
          <label>Fehlerfrei durchgespielt (einmal pro Quiz)<input className="ga-input" type="number" min={0} value={cfg.xp.perfect} disabled={ro} onChange={e => set(c => { c.xp.perfect = num(e.target.value) })} /></label>
          <label>Mehrspieler-Faktor<input className="ga-input" type="number" step="0.05" min={1} value={cfg.xp.multiplayer} disabled={ro} onChange={e => set(c => { c.xp.multiplayer = num(e.target.value) })} /></label>
        </div>
        <span className="ga-adm-label" style={{ marginTop: 12 }}>Bonus für % eines Quiz (jeder Eintrag zählt, sobald er einmal richtig war)</span>
        {cfg.xp.milestones.map((m, i) => (
          <div key={i} className="ga-row" style={{ gap: 8, marginBottom: 6 }}>
            <input className="ga-input" style={{ width: 80 }} type="number" min={1} max={100} value={m.pct} disabled={ro} onChange={e => set(c => { c.xp.milestones[i].pct = num(e.target.value) })} /> %
            <input className="ga-input" style={{ width: 100 }} type="number" min={0} value={m.xp} disabled={ro} onChange={e => set(c => { c.xp.milestones[i].xp = num(e.target.value) })} /> XP
            {!ro && <button className="ga-icon-btn sm" onClick={() => set(c => { c.xp.milestones.splice(i, 1) })} aria-label="Stufe entfernen"><Icon name="x" size={13} /></button>}
          </div>
        ))}
        {!ro && <button className="ga-btn ghost sm" onClick={() => set(c => { c.xp.milestones.push({ pct: 90, xp: 50 }) })}><Icon name="plus" size={14} /> Stufe hinzufügen</button>}
      </section>

      <section className="ga-card">
        <h3 className="ga-adm-h">Schwierigkeiten</h3>
        <p className="ga-muted ga-adm-hint">Jedes Quiz hat eine Schwierigkeit (automatisch aus Thema und Anzahl, im Reiter „Quizzes“ änderbar).</p>
        <table className="ga-adm-mini">
          <thead><tr><th>Stufe</th><th>Name</th><th>XP-Faktor</th><th>Farbe</th></tr></thead>
          <tbody>
            {DIFFICULTIES.map(d => (
              <tr key={d}>
                <td className="ga-muted">{d}</td>
                <td><input className="ga-input sm" value={cfg.difficulties[d].label} disabled={ro} onChange={e => set(c => { c.difficulties[d].label = e.target.value })} /></td>
                <td><input className="ga-input sm" style={{ width: 80 }} type="number" step="0.1" min={0} value={cfg.difficulties[d].factor} disabled={ro} onChange={e => set(c => { c.difficulties[d].factor = num(e.target.value) })} /></td>
                <td><input type="color" value={cfg.difficulties[d].color} disabled={ro} onChange={e => set(c => { c.difficulties[d].color = e.target.value })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="ga-card">
        <h3 className="ga-adm-h">Level-Formel</h3>
        <p className="ga-muted ga-adm-hint">XP bis zum nächsten Level = Grundwert × Wachstum<sup>(Level − 1)</sup>. Wachstum 1,15 = jedes Level braucht 15 % mehr.</p>
        <div className="ga-adm-grid">
          <label>Grundwert (Level 1 → 2)<input className="ga-input" type="number" min={1} value={cfg.level.base} disabled={ro} onChange={e => set(c => { c.level.base = num(e.target.value) })} /></label>
          <label>Wachstum pro Level<input className="ga-input" type="number" step="0.01" min={1} max={3} value={cfg.level.growth} disabled={ro} onChange={e => set(c => { c.level.growth = num(e.target.value) })} /></label>
        </div>
        <table className="ga-adm-mini" style={{ marginTop: 10 }}>
          <thead><tr><th>Level</th><th>XP für dieses Level</th><th>XP gesamt</th></tr></thead>
          <tbody>
            {[2, 3, 5, 10, 15, 20, 25, 30, 40, 50].map(l => (
              <tr key={l}><td>{l}</td><td>{xpForLevel(l - 1, cfg).toLocaleString('de-DE')}</td><td>{totalXpFor(l, cfg).toLocaleString('de-DE')}</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="ga-card">
        <h3 className="ga-adm-h">Geo-Sternis</h3>
        <p className="ga-muted ga-adm-hint">Währung zum Freikaufen von Quizzes, die noch nicht freigeschaltet sind. Freigekauft bleibt für immer offen. „Erstes Mal“: jeder Eintrag einmal richtig oder ein kompletter Durchlauf. „Nochmal“: jeder weitere komplette Durchlauf (nicht Sprint, nicht „Nur Fehler“).</p>
        <div className="ga-adm-grid">
          <label>Sternis für Level 2<input className="ga-input" type="number" min={0} value={cfg.sternis.levelStart} disabled={ro} onChange={e => set(c => { c.sternis.levelStart = num(e.target.value) })} /></label>
          <label>Wachstum pro Level<input className="ga-input" type="number" step="0.01" min={1} max={2} value={cfg.sternis.levelGrowth} disabled={ro} onChange={e => set(c => { c.sternis.levelGrowth = num(e.target.value) })} /></label>
          <label>Pause pro Quiz für „Nochmal“ (Minuten)<input className="ga-input" type="number" min={0} value={cfg.sternis.repeatPause} disabled={ro} onChange={e => set(c => { c.sternis.repeatPause = num(e.target.value) })} /></label>
          <label>Höchstens pro Tag aus „Nochmal“ (0 = egal)<input className="ga-input" type="number" min={0} value={cfg.sternis.repeatDailyMax} disabled={ro} onChange={e => set(c => { c.sternis.repeatDailyMax = num(e.target.value) })} /></label>
        </div>
        <table className="ga-adm-mini" style={{ marginTop: 10 }}>
          <thead><tr><th>Schwierigkeit</th><th>Erstes Mal</th><th>Nochmal</th><th>Freikaufen kostet</th></tr></thead>
          <tbody>
            {DIFFICULTIES.map(d => (
              <tr key={d}>
                <td>{cfg.difficulties[d].label}</td>
                {(['first', 'repeat', 'price'] as const).map(k => (
                  <td key={k}><input className="ga-input sm" style={{ width: 90 }} type="number" min={0} value={cfg.sternis[k][d]} disabled={ro} onChange={e => set(c => { c.sternis[k][d] = num(e.target.value) })} /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <table className="ga-adm-mini" style={{ marginTop: 10 }}>
          <thead><tr><th>Level</th><th>Sternis für dieses Level</th><th>Sternis bis hier gesamt</th></tr></thead>
          <tbody>
            {[2, 3, 5, 10, 15, 20, 30, 40, 50].map(l => (
              <tr key={l}><td>{l}</td><td>{sternisForLevel(l, cfg).toLocaleString('de-DE')}</td><td>{sternisBetween(1, l, cfg).toLocaleString('de-DE')}</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="ga-card">
        <h3 className="ga-adm-h">Spielarten (Standard für alle Quizzes)</h3>
        <p className="ga-muted ga-adm-hint">Wer welche Spielart nutzen darf. Pro Quiz lässt sich das im Reiter „Quizzes“ überschreiben. Admins dürfen immer alles.</p>
        <div className="ga-adm-modes">
          {MODE_KEYS.map(k => (
            <label key={k}><span>{MODE_LABEL[k]}</span>
              <RulePicker disabled={ro} allowDefault={false} value={cfg.modes[k] ?? 'all'}
                onChange={v => set(c => { c.modes[k as ModeKey] = (v ?? 'all') as ModeRule })} />
            </label>
          ))}
        </div>
        <div className="ga-row ga-wrap" style={{ marginTop: 12 }}>
          <label className="ga-row" style={{ gap: 6 }}><input type="checkbox" checked={cfg.sound} disabled={ro} onChange={e => set(c => { c.sound = e.target.checked })} /> Ton bei „+XP“</label>
          <label className="ga-row" style={{ gap: 6 }}><input type="checkbox" checked={cfg.leaderboards} disabled={ro} onChange={e => set(c => { c.leaderboards = e.target.checked })} /> Ranglisten anzeigen</label>
        </div>
      </section>

      {!ro && (
        <div className="ga-adm-savebar">
          <button className="ga-btn primary" disabled={busy} onClick={save}><Icon name="check" size={15} /> Einstellungen speichern</button>
          <button className="ga-btn ghost" disabled={busy} onClick={() => setCfg(JSON.parse(JSON.stringify(data.config)))}>Änderungen verwerfen</button>
          <span className="ga-muted" style={{ fontSize: 12.5 }}>Zuletzt gespeichert: {fmtDate(data.configSavedAt)}</span>
        </div>
      )}
    </div>
  )
}