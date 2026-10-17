'use client'

// Admin → Clan & Abzeichen → Historie: Clan-Verlauf pflegen (öffentlich unter /clan-history).
//   - Eintrag anlegen für jede Zeit (Standard: jetzt), ändern, löschen
//   - Alten Verlauf importieren + Clan-Liste aus dem Spiel abgleichen (Vorschau zuerst)
// Rangwechsel in den / aus dem Clan tragen sich selbst ein (app/lib/clan-historie.ts).

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../../lib/auth-context'
import { darf } from '@/app/lib/rechte-def'
import { ARTEN, ART_FARBE, ART_NAME, RANG_VORSCHLAEGE, satz, zeitText, type Art, type Eintrag } from '@/app/lib/clan-historie-def'

type Plan = {
  eintraege: number; schonImportiert: number; umgestellt: boolean
  neueAkten: { name: string; uuid: string | null; rang: string; beitritt: string | null }[]
  datum: { name: string; alt: string | null; neu: string | null; grund: 'leer' | 'automatisch' | 'abweichend' }[]
  raenge: { name: string; von: string; zu: string }[]
  verknuepfen: { name: string }[]
  andererRang: { name: string; rang: string }[]
}
type Formular = { id?: number; zeit: string; genau: boolean; art: Art; spieler: string; von: string; rang: string; notiz: string }

const QUELLE: Record<string, string> = { gomme: 'Spiel', discord: 'Discord', website: 'von Hand', automatisch: 'automatisch' }
/** ISO → Wert für <input type="datetime-local"> in Ortszeit */
const lokal = (iso: string | Date) => { const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16) }
const tag = (iso: string | null) => (iso ? zeitText({ zeit: iso, genau: false }) : 'leer')

export default function Historie({ canWrite }: { canWrite: boolean }) {
  const { user } = useAuth()
  const meinName = user?.minecraft_username ?? user?.username ?? ''
  const leer = (): Formular => ({ zeit: lokal(new Date()), genau: true, art: 'beigetreten', spieler: '', von: meinName, rang: '', notiz: '' })
  const [form, setForm] = useState<Formular>(leer)
  const [liste, setListe] = useState<Eintrag[]>([])
  const [gesamt, setGesamt] = useState(0)
  const [seite, setSeite] = useState(0)
  const [suche, setSuche] = useState('')
  const [msg, setMsg] = useState<{ t: string; f?: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [planOffen, setPlanOffen] = useState(false)
  const [ueberschreiben, setUeberschreiben] = useState(false)
  const darfImport = canWrite && darf(user, 'raenge.vergeben')

  const melden = (t: string, f = false) => { setMsg({ t, f }); setTimeout(() => setMsg(null), f ? 7000 : 3500) }
  const set = <K extends keyof Formular>(k: K, v: Formular[K]) => setForm(f => ({ ...f, [k]: v }))

  const laden = useCallback((s = 0) => {
    const q = new URLSearchParams({ seite: String(s) })
    if (suche.trim()) q.set('q', suche.trim())
    fetch(`/api/clan/historie?${q}`, { cache: 'no-store' }).then(r => r.json()).then(d => {
      setListe(alt => (s === 0 ? d.eintraege ?? [] : [...alt, ...(d.eintraege ?? [])])); setGesamt(d.gesamt ?? 0); setSeite(s)
    })
  }, [suche])
  useEffect(() => { const t = setTimeout(() => laden(0), 250); return () => clearTimeout(t) }, [laden])
  const planLaden = () => fetch('/api/admin2/clan-historie/import', { cache: 'no-store' }).then(r => r.json()).then(d => setPlan(d.error ? null : d))
  useEffect(() => { planLaden() }, [])

  const speichern = async () => {
    if (!form.spieler.trim()) { melden('Name fehlt', true); return }
    setBusy(true)
    const body = { ...form, zeit: new Date(form.zeit).toISOString() }
    const r = await fetch('/api/admin2/clan-historie', { method: form.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const d = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) { melden(d.error || 'Fehler', true); return }
    melden(form.id ? 'Eintrag geändert' : 'Eingetragen'); setForm(leer()); laden(0)
  }

  const loeschen = async (e: Eintrag) => {
    if (!confirm(`Eintrag löschen?\n„${satz(e)}“ (${zeitText(e)})`)) return
    const r = await fetch('/api/admin2/clan-historie', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: e.id }) })
    if (r.ok) { melden('Gelöscht'); laden(0) } else melden('Fehler beim Löschen', true)
  }

  const bearbeiten = (e: Eintrag) => {
    setForm({ id: e.id, zeit: lokal(e.zeit), genau: e.genau, art: e.art, spieler: e.spieler, von: e.von ?? '', rang: e.rang ?? '', notiz: e.notiz ?? '' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const importieren = async () => {
    if (!plan) return
    if (!confirm(`Import ausführen?\n\n• ${plan.eintraege} Verlaufs-Einträge (ersetzt einen früheren Import)\n• ${plan.neueAkten.length} neue Clan-Akten\n• ${plan.datum.filter(d => ueberschreiben || d.grund !== 'abweichend').length} Beitrittsdaten\n• ${plan.raenge.length} Clan-Ränge vergeben`)) return
    setBusy(true)
    const r = await fetch('/api/admin2/clan-historie/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ueberschreiben }) })
    const d = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) { melden(d.error || 'Import fehlgeschlagen', true); return }
    melden(`Import fertig: ${d.historieFehlt ? 'Verlauf übersprungen (Tabelle fehlt)' : `${d.eintraege} Einträge`}, ${d.neueAkten} neue Akten, ${d.daten} Daten, ${d.raenge} Ränge`)
    planLaden(); laden(0)
  }

  const inp = { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }
  const karte = { background: 'var(--card-bg)', border: '1px solid var(--card-border)' }
  const zeigeRang = form.art === 'befoerdert' || form.art === 'degradiert' || form.art === 'beigetreten'

  return (
    <div className="space-y-6">
      {msg && <div className="rounded-xl px-4 py-3 text-sm" style={{ background: msg.f ? '#ef44441a' : '#22c55e1a', color: msg.f ? '#f87171' : '#4ade80' }}>{msg.t}</div>}

      {/* Eintrag anlegen / ändern */}
      {canWrite && (
        <div className="rounded-2xl p-5 space-y-3" style={karte}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-bold" style={{ color: 'var(--foreground)' }}>{form.id ? 'Eintrag ändern' : 'Neuer Eintrag'}</h2>
            <a href="/clan-history" target="_blank" className="text-xs underline" style={{ color: 'var(--muted)' }}>/clan-history ansehen ↗</a>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="text-xs" style={{ color: 'var(--muted)' }}>Wann
              <input type={form.genau ? 'datetime-local' : 'date'} value={form.genau ? form.zeit : form.zeit.slice(0, 10)}
                onChange={e => set('zeit', form.genau ? e.target.value : `${e.target.value}T12:00`)} className="mt-1 w-full px-3 py-2 rounded-xl text-sm" style={inp} />
              <span className="flex items-center gap-2 mt-1.5">
                <input type="checkbox" checked={!form.genau} onChange={e => set('genau', !e.target.checked)} /> nur Tag bekannt
                <button type="button" onClick={() => set('zeit', lokal(new Date()))} className="ml-auto underline">jetzt</button>
              </span>
            </label>
            <label className="text-xs" style={{ color: 'var(--muted)' }}>Was
              <select value={form.art} onChange={e => set('art', e.target.value as Art)} className="mt-1 w-full px-3 py-2 rounded-xl text-sm" style={inp}>
                {ARTEN.map(a => <option key={a} value={a}>{ART_NAME[a]}</option>)}
              </select>
            </label>
            <label className="text-xs" style={{ color: 'var(--muted)' }}>Wer (Minecraft-Name)
              <input value={form.spieler} onChange={e => set('spieler', e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl text-sm" style={inp} placeholder="z. B. Niffino" />
            </label>
            <label className="text-xs" style={{ color: 'var(--muted)' }}>Von wem (optional)
              <input value={form.von} onChange={e => set('von', e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl text-sm" style={inp} placeholder="z. B. uwuleonie" />
            </label>
            {zeigeRang && (
              <label className="text-xs" style={{ color: 'var(--muted)' }}>Rang (optional)
                <input list="ga-hist-raenge" value={form.rang} onChange={e => set('rang', e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl text-sm" style={inp} placeholder="z. B. Clan-Moderator" />
                <datalist id="ga-hist-raenge">{RANG_VORSCHLAEGE.map(r => <option key={r} value={r} />)}</datalist>
              </label>
            )}
            <label className={`text-xs ${zeigeRang ? 'lg:col-span-3' : 'lg:col-span-4'} sm:col-span-2`} style={{ color: 'var(--muted)' }}>Notiz (optional, z. B. Grund)
              <input value={form.notiz} onChange={e => set('notiz', e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl text-sm" style={inp} />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm flex-1 min-w-[200px]" style={{ color: 'var(--foreground)' }}>
              <span style={{ color: ART_FARBE[form.art] }}>●</span> {satz({ art: form.art, spieler: form.spieler || '…', von: form.von || null, rang: form.rang || null, notiz: form.notiz || null })}
            </p>
            {form.id && <button onClick={() => setForm(leer())} className="px-4 py-2 rounded-xl text-sm" style={inp}>Abbrechen</button>}
            <button onClick={speichern} disabled={busy} className="px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-40" style={{ background: '#7C3AED' }}>{form.id ? 'Speichern' : 'Eintragen'}</button>
          </div>
        </div>
      )}

      {/* Import */}
      {plan && (
        <div className="rounded-2xl p-5 space-y-3" style={{ ...karte, borderColor: plan.schonImportiert > 0 ? 'var(--card-border)' : '#7C3AED66' }}>
          <button onClick={() => setPlanOffen(o => !o)} className="w-full flex items-center justify-between gap-3 text-left">
            <h2 className="font-bold" style={{ color: 'var(--foreground)' }}>
              Alter Verlauf & Clan-Liste {plan.schonImportiert > 0 ? <span className="text-xs font-normal" style={{ color: '#4ade80' }}>· importiert ({plan.schonImportiert} Einträge)</span> : <span className="text-xs font-normal" style={{ color: '#c4b5fd' }}>· noch nicht importiert</span>}
            </h2>
            <span style={{ color: 'var(--muted)' }}>{planOffen ? '−' : '+'}</span>
          </button>
          {planOffen && (
            <div className="space-y-3 text-sm" style={{ color: 'var(--foreground)' }}>
              {plan.schonImportiert < 0 && <p style={{ color: '#fbbf24' }}>Die Tabelle clan_historie fehlt noch – Akten und Ränge werden trotzdem eingetragen, der Verlauf erst, wenn die Tabelle da ist.</p>}
              <ul className="space-y-1 text-sm">
                <li>• <b>{plan.eintraege}</b> Einträge aus dem Spiel-Verlauf (ab 19.10.2025) und der Discord-Liste (ab 16.03.2025)</li>
                <li>• <b>{plan.neueAkten.length}</b> Leute aus der Clan-Liste haben noch keine Clan-Akte → wird angelegt</li>
                <li>• <b>{plan.verknuepfen.length}</b> vorhandene Akten bekommen ihre Minecraft-UUID aus der Liste</li>
                <li>• <b>{plan.datum.filter(d => d.grund !== 'abweichend').length}</b> Beitrittsdaten fehlen oder sind von der Umstellung → aus dem Verlauf (unbekannt = leer)</li>
                <li>• <b>{plan.datum.filter(d => d.grund === 'abweichend').length}</b> Beitrittsdaten weichen vom Verlauf ab → nur mit Haken unten</li>
                <li>• <b>{plan.raenge.length}</b> haben noch keinen Clan-Rang → bekommen den Rang aus der Clan-Liste</li>
                {plan.andererRang.length > 0 && <li>• {plan.andererRang.length} haben einen anderen Rang, der bleibt: {plan.andererRang.map(a => `${a.name} (${a.rang})`).join(', ')}</li>}
              </ul>
              {plan.neueAkten.length > 0 && (
                <details><summary className="cursor-pointer text-xs" style={{ color: 'var(--muted)' }}>Neue Akten ansehen</summary>
                  <div className="mt-2 grid sm:grid-cols-2 lg:grid-cols-3 gap-1 text-xs">{plan.neueAkten.map(a => <span key={a.name}>{a.name} · {a.rang} · seit {tag(a.beitritt)}</span>)}</div>
                </details>
              )}
              {plan.datum.length > 0 && (
                <details><summary className="cursor-pointer text-xs" style={{ color: 'var(--muted)' }}>Beitrittsdaten ansehen</summary>
                  <div className="mt-2 grid sm:grid-cols-2 gap-1 text-xs">
                    {plan.datum.map(d => <span key={d.name} style={{ color: d.grund === 'abweichend' ? '#fbbf24' : undefined }}>{d.name}: {tag(d.alt)} → {tag(d.neu)}{d.grund === 'abweichend' ? ' (weicht ab)' : d.grund === 'automatisch' ? ' (von der Umstellung)' : ''}</span>)}
                  </div>
                </details>
              )}
              {darfImport ? (
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
                    <input type="checkbox" checked={ueberschreiben} onChange={e => setUeberschreiben(e.target.checked)} /> abweichende Beitrittsdaten auch durch den Verlauf ersetzen
                  </label>
                  <button onClick={importieren} disabled={busy} className="ml-auto px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-40" style={{ background: '#7C3AED' }}>{busy ? 'Läuft …' : plan.schonImportiert > 0 ? 'Erneut importieren' : 'Import ausführen'}</button>
                </div>
              ) : <p className="text-xs" style={{ color: 'var(--muted)' }}>🔒 Import nur mit „Clan verwalten“ und „Ränge vergeben“.</p>}
            </div>
          )}
        </div>
      )}

      {/* Liste */}
      <div className="rounded-2xl overflow-hidden" style={karte}>
        <div className="flex flex-wrap items-center gap-2 p-4" style={{ borderBottom: '1px solid var(--card-border)' }}>
          <h2 className="font-bold mr-auto" style={{ color: 'var(--foreground)' }}>Einträge ({gesamt})</h2>
          <input value={suche} onChange={e => setSuche(e.target.value)} placeholder="Name suchen …" className="px-3 py-2 rounded-xl text-sm" style={inp} />
        </div>
        {!liste.length ? <p className="p-4 text-sm" style={{ color: 'var(--muted)' }}>Keine Einträge.</p> : liste.map((e, i) => (
          <div key={e.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm" style={{ borderTop: i ? '1px solid var(--card-border)' : undefined }}>
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: ART_FARBE[e.art] }} />
            <span className="w-[130px] text-xs flex-shrink-0" style={{ color: 'var(--muted)' }}>{zeitText(e)}{e.genau ? '' : ' *'}</span>
            <span className="flex-1 min-w-[200px]" style={{ color: 'var(--foreground)' }}>{satz(e)}{e.notiz && e.art !== 'sonstiges' ? <span style={{ color: 'var(--muted)' }}> · {e.notiz}</span> : null}</span>
            <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: 'var(--muted-bg)', color: 'var(--muted)' }}>{QUELLE[e.quelle] ?? e.quelle}</span>
            {canWrite && (
              <span className="flex gap-1">
                <button onClick={() => bearbeiten(e)} className="px-2 py-1 rounded-lg text-xs" style={inp}>Ändern</button>
                <button onClick={() => loeschen(e)} className="px-2 py-1 rounded-lg text-xs" style={{ ...inp, color: '#f87171' }}>Löschen</button>
              </span>
            )}
          </div>
        ))}
        {liste.length < gesamt && <button onClick={() => laden(seite + 1)} className="w-full py-3 text-sm" style={{ color: 'var(--muted)', borderTop: '1px solid var(--card-border)' }}>Ältere laden ({gesamt - liste.length} weitere)</button>}
      </div>
    </div>
  )
}
