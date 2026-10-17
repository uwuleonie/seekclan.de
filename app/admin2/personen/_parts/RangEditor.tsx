'use client'

// /admin2/raenge → Ränge & Rechte: Ränge anlegen und bearbeiten.
// Website: Rechte (zum Anhaken, aus app/lib/rechte-def.ts), Farbe, Clan/Team. Minecraft: Prefixe, Farbe, Permissions.

import { useState } from 'react'
import { RECHTE, ALLE_RECHTE, mcFarbe } from '@/app/lib/rechte-def'
import { MC_COLORS, renderMcText } from './mc'
import { card, ghostBtn, gradBtn, inp, RangSchild, type RangVoll } from './typen'

type Form = {
  id?: number
  name: string; display_name: string; beschreibung: string; web_farbe: string; schluessel: string
  priority: number; is_default: boolean; clan: boolean; team: boolean; nur_ingame: boolean; can_assign_up_to_priority: number
  rechte: string[]
  chat_prefix: string; tab_prefix: string; tab_suffix: string; color: string; name_color: string; permissions: string[]
}
const LEER: Form = {
  name: '', display_name: '', beschreibung: '', web_farbe: '', schluessel: '', priority: 0, is_default: false, clan: false, team: false, nur_ingame: false,
  can_assign_up_to_priority: -1, rechte: [], chat_prefix: '', tab_prefix: '', tab_suffix: '', color: '§7', name_color: '', permissions: [],
}
const GRUPPEN = [...new Set(RECHTE.map(r => r.gruppe))]

export default function RangEditor({ raenge, darfBearbeiten, istOrga, neuLaden, flash }: {
  raenge: RangVoll[]; darfBearbeiten: boolean; istOrga: boolean; neuLaden: () => Promise<void>; flash: (t: string, f?: boolean) => void
}) {
  const [form, setForm] = useState<Form | null>(null)
  const [feld, setFeld] = useState<keyof Form | null>(null)
  const [neuePerm, setNeuePerm] = useState('')
  const [busy, setBusy] = useState(false)

  const bearbeiten = (r: RangVoll) => setForm({
    id: r.id, name: r.name, display_name: r.display_name, beschreibung: r.beschreibung ?? '', web_farbe: r.web_farbe ?? '', schluessel: r.schluessel ?? '',
    priority: r.priority, is_default: r.is_default, clan: r.clan, team: r.team, nur_ingame: r.nurIngame, can_assign_up_to_priority: r.can_assign_up_to_priority ?? -1, rechte: r.rechte,
    chat_prefix: r.chat_prefix ?? '', tab_prefix: r.tab_prefix ?? '', tab_suffix: r.tab_suffix ?? '', color: r.color || '§7', name_color: r.name_color ?? '', permissions: r.permissions ?? [],
  })
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => (f ? { ...f, [k]: v } : f))
  const farbcode = (code: string) => {
    if (!form || !feld || !['display_name', 'chat_prefix', 'tab_prefix', 'tab_suffix', 'color', 'name_color'].includes(feld)) return
    set(feld, ((form[feld] as string) + code) as never)
  }
  const recht = (key: string, an: boolean) => set('rechte', an ? [...form!.rechte, key] : form!.rechte.filter(x => x !== key))

  const speichern = async () => {
    if (!form) return
    setBusy(true)
    const r = await fetch('/api/admin2/ranks', { method: form.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const d = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) return flash(d.error || 'Fehler beim Speichern', true)
    flash('Rang gespeichert')
    setForm(null)
    neuLaden()
  }
  const loeschen = async (r: RangVoll) => {
    if (!confirm(`Rang „${r.anzeige}“ wirklich löschen?`)) return
    const res = await fetch('/api/admin2/ranks', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id }) })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) return flash(d.error || 'Fehler', true)
    flash('Rang gelöscht')
    neuLaden()
  }

  const gesperrt = (r: RangVoll) => r.rechte.includes(ALLE_RECHTE) && !istOrga
  const vorschauFarbe = form ? (/^#[0-9a-f]{6}$/i.test(form.web_farbe) ? form.web_farbe : mcFarbe(form.color) ?? '#9ca3af') : '#9ca3af'

  return (
    <div className="space-y-5">
      {darfBearbeiten && !form && (
        <div className="flex justify-end">
          <button onClick={() => setForm({ ...LEER })} className="px-5 py-2 rounded-xl text-sm font-medium text-white" style={gradBtn}>+ Neuer Rang</button>
        </div>
      )}

      {form && (
        <div style={card} className="space-y-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-bold text-lg" style={{ color: 'var(--foreground)' }}>{form.id ? 'Rang bearbeiten' : 'Neuer Rang'}</h2>
            <RangSchild rang={{ anzeige: form.display_name.replace(/[§&][0-9a-fk-or]/gi, '') || 'Vorschau', farbe: vorschauFarbe }} />
          </div>

          {/* Allgemein */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>Allgemein</h3>
            <div className="grid sm:grid-cols-3 gap-3">
              <Feld label="Interner Name (z. B. vip)"><input style={{ ...inp, width: '100%' }} value={form.name} onChange={e => set('name', e.target.value)} /></Feld>
              <Feld label="Anzeigename (§-Codes erlaubt)"><input style={{ ...inp, width: '100%' }} value={form.display_name} onFocus={() => setFeld('display_name')} onChange={e => set('display_name', e.target.value)} /></Feld>
              <Feld label="Priorität (höher = wichtiger, oben im Tab)"><input type="number" style={{ ...inp, width: '100%' }} value={form.priority} onChange={e => set('priority', Number(e.target.value))} /></Feld>
            </div>
            <Feld label="Beschreibung (steht auf /team unter dem Rang)"><input style={{ ...inp, width: '100%' }} value={form.beschreibung} onChange={e => set('beschreibung', e.target.value)} /></Feld>
            <div className="grid sm:grid-cols-3 gap-3">
              <Feld label="Farbe auf der Website (leer = Minecraft-Farbe)">
                <div className="flex gap-2">
                  <input type="color" value={/^#[0-9a-f]{6}$/i.test(form.web_farbe) ? form.web_farbe : vorschauFarbe} onChange={e => set('web_farbe', e.target.value)} className="h-9 w-12 rounded" />
                  <input style={{ ...inp, flex: 1 }} value={form.web_farbe} onChange={e => set('web_farbe', e.target.value)} placeholder="#a855f7" />
                </div>
              </Feld>
              <Feld label="Darf Ränge vergeben bis Priorität (-1 = gar nicht)"><input type="number" style={{ ...inp, width: '100%' }} value={form.can_assign_up_to_priority} onChange={e => set('can_assign_up_to_priority', Number(e.target.value))} /></Feld>
              <Feld label="Fester Schlüssel (für Quiz-Freigaben im Atlas)"><input style={{ ...inp, width: '100%' }} value={form.schluessel} onChange={e => set('schluessel', e.target.value)} placeholder="z. B. clan-mod" /></Feld>
            </div>
            <div className="flex flex-wrap gap-4 text-sm" style={{ color: 'var(--foreground)' }}>
              <Haken an={form.clan} setzen={v => set('clan', v)} text="Clan-Rang – Personen stehen auf /clan" />
              <Haken an={form.team} setzen={v => set('team', v)} text="Team-Rang – Personen stehen auf /team" />
              <Haken an={form.is_default} setzen={v => set('is_default', v)} text="Standard-Rang (bekommt jeder ohne Rang)" />
              <Haken an={form.nur_ingame} setzen={v => set('nur_ingame', v)} text="Nur im Spiel – auf der Website zählt die Person wie der Standard-Rang (keine Rechte, nicht auf /clan oder /team)" />
            </div>
          </section>

          {/* Website-Rechte */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>Rechte auf der Website</h3>
            {istOrga && (
              <Haken an={form.rechte.includes(ALLE_RECHTE)} setzen={v => recht(ALLE_RECHTE, v)} text="Alle Rechte (auch künftige) – nur für die Orga" />
            )}
            {form.rechte.includes(ALLE_RECHTE) ? (
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Dieser Rang darf alles.</p>
            ) : (
              <div className="grid md:grid-cols-2 gap-3">
                {GRUPPEN.map(g => (
                  <div key={g} className="rounded-lg p-3 space-y-2" style={{ background: 'var(--muted-bg)' }}>
                    <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>{g}</p>
                    {RECHTE.filter(r => r.gruppe === g).map(r => (
                      <label key={r.key} className="flex gap-2 text-sm cursor-pointer" style={{ color: 'var(--foreground)' }}>
                        <input type="checkbox" className="mt-1" checked={form.rechte.includes(r.key)} onChange={e => recht(r.key, e.target.checked)} />
                        <span><b className="font-medium">{r.name}</b><br /><span className="text-xs" style={{ color: 'var(--muted)' }}>{r.text}</span></span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Minecraft */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>Im Spiel</h3>
            <div className="flex flex-wrap gap-1 items-center">
              <span className="text-xs mr-2" style={{ color: 'var(--muted)' }}>Farbcode ins zuletzt gewählte Feld:</span>
              {MC_COLORS.map(c => <button key={c.code} title={`${c.label} (${c.code})`} onClick={() => farbcode(c.code)} className="w-6 h-6 rounded border border-white/20 hover:scale-125 transition-transform" style={{ background: c.hex }} />)}
              <button onClick={() => farbcode('§l')} className="px-2 h-6 rounded text-xs font-bold" style={ghostBtn}>§l</button>
              <button onClick={() => farbcode('§r')} className="px-2 h-6 rounded text-xs" style={ghostBtn}>§r</button>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <Feld label="Chat-Prefix"><input style={{ ...inp, width: '100%' }} value={form.chat_prefix} onFocus={() => setFeld('chat_prefix')} onChange={e => set('chat_prefix', e.target.value)} /></Feld>
              <Feld label="Tab-Prefix"><input style={{ ...inp, width: '100%' }} value={form.tab_prefix} onFocus={() => setFeld('tab_prefix')} onChange={e => set('tab_prefix', e.target.value)} /></Feld>
              <Feld label="Tab-Suffix"><input style={{ ...inp, width: '100%' }} value={form.tab_suffix} onFocus={() => setFeld('tab_suffix')} onChange={e => set('tab_suffix', e.target.value)} /></Feld>
              <Feld label="Namensfarbe (§-Code)"><input style={{ ...inp, width: '100%' }} value={form.color} onFocus={() => setFeld('color')} onChange={e => set('color', e.target.value)} /></Feld>
            </div>
            <div className="rounded-lg px-3 py-2 text-sm font-mono" style={{ background: '#1e1e1e' }}>
              <span style={{ color: '#aaa' }}>Tab: </span>{renderMcText(`${form.tab_prefix}${form.color}Spielername${form.tab_suffix}`)}
              <span style={{ color: '#aaa' }} className="ml-4">Chat: </span>{renderMcText(`${form.chat_prefix}${form.color}Spielername§r: Hallo`)}
            </div>
            <Feld label="Minecraft-Permissions (mit - davor = entziehen)">
              <div className="flex flex-wrap gap-1.5 mb-2">
                {form.permissions.map(p => (
                  <span key={p} className="text-xs px-2 py-1 rounded font-mono flex items-center gap-1" style={ghostBtn}>
                    {p}<button onClick={() => set('permissions', form.permissions.filter(x => x !== p))} style={{ color: 'var(--muted)' }}>✕</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input style={{ ...inp, flex: 1 }} value={neuePerm} onChange={e => setNeuePerm(e.target.value)} placeholder="z. B. seekcore.fly"
                  onKeyDown={e => { if (e.key === 'Enter' && neuePerm.trim()) { set('permissions', [...new Set([...form.permissions, neuePerm.trim()])]); setNeuePerm('') } }} />
                <button className="px-3 rounded-lg text-sm" style={ghostBtn} onClick={() => { if (neuePerm.trim()) { set('permissions', [...new Set([...form.permissions, neuePerm.trim()])]); setNeuePerm('') } }}>Hinzufügen</button>
              </div>
            </Feld>
          </section>

          <div className="flex gap-2 justify-end">
            <button onClick={() => setForm(null)} className="px-4 py-2 rounded-xl text-sm" style={ghostBtn}>Abbrechen</button>
            <button onClick={speichern} disabled={busy} className="px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50" style={gradBtn}>{busy ? 'Speichert …' : 'Speichern'}</button>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-3">
        {raenge.map(r => (
          <div key={r.id} style={{ ...card, borderLeft: `4px solid ${r.farbe}` }} className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <RangSchild rang={r} />
              <span className="text-xs" style={{ color: 'var(--muted)' }}>Prio {r.priority} · {r.personen} {r.personen === 1 ? 'Person' : 'Personen'}</span>
              {r.is_default && <span className="text-[11px] px-1.5 py-0.5 rounded" style={ghostBtn}>Standard</span>}
              {r.clan && <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: '#22c55e22', color: '#4ade80' }}>/clan</span>}
              {r.team && <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: '#6366f122', color: '#a5b4fc' }}>/team</span>}
              {r.nurIngame && <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: '#f59e0b22', color: '#fbbf24' }}>nur im Spiel</span>}
            </div>
            {r.beschreibung && <p className="text-xs" style={{ color: 'var(--muted)' }}>{r.beschreibung}</p>}
            <p className="text-xs" style={{ color: 'var(--foreground)' }}>
              {r.rechte.includes(ALLE_RECHTE) ? 'Alle Rechte' : r.rechte.length ? r.rechte.map(k => RECHTE.find(x => x.key === k)?.name ?? k).join(' · ') : 'Keine Website-Rechte'}
            </p>
            <div className="text-xs font-mono px-2 py-1 rounded" style={{ background: '#1e1e1e' }}>{renderMcText(`${r.tab_prefix}${r.color}Spielername`)}</div>
            {darfBearbeiten && !gesperrt(r) && (
              <div className="flex gap-2 pt-1">
                <button onClick={() => bearbeiten(r)} className="px-3 py-1.5 rounded-lg text-xs" style={ghostBtn}>Bearbeiten</button>
                {!r.is_default && <button onClick={() => loeschen(r)} className="px-3 py-1.5 rounded-lg text-xs" style={{ ...ghostBtn, color: '#f87171' }}>Löschen</button>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function Feld({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>{label}</label>{children}</div>
}
function Haken({ an, setzen, text }: { an: boolean; setzen: (v: boolean) => void; text: string }) {
  return <label className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: 'var(--foreground)' }}><input type="checkbox" checked={an} onChange={e => setzen(e.target.checked)} /> {text}</label>
}
