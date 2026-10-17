'use client'

// /admin2/raenge → Umstellung (einmalig, nur Orga): altes System → neue Ränge.
// 1. Alte Minecraft-Ränge: wohin kommen ihre Spieler, und welcher neue Rang übernimmt Prefixe/Farbe/Permissions?
// 2. Vorschau: wer bekommt welchen Rang (Clan-Liste aus dem Spiel vor alten Clan-Rollen/MC-Rängen, sonst der höchste)
// 3. Umstellen – danach zählen die alten Website-Rollen nicht mehr.

import { RECHTE } from '@/app/lib/rechte-def'
import { useEffect, useMemo, useState } from 'react'
import { card, ghostBtn, gradBtn, inp } from './typen'

type NeuRang = { id: number; schluessel: string; anzeige: string; prioritaet: number; farbe: string }
type AltRang = { id: number; name: string; anzeige: string; chatPrefix: string; tabPrefix: string; spieler: number; ziel: number }
type VPerson = { name: string; uuid: string | null; konto: boolean; ziel: number; quellen: string[]; akte: boolean; neueAkte: boolean; konflikt: boolean; verliert: string[] }
type Daten = { neueRaenge: NeuRang[]; alteRaenge: AltRang[]; personen: VPerson[]; ohneUuid: string[] }

export default function Umstellung({ flash, fertig }: { flash: (t: string, f?: boolean) => void; fertig: () => void }) {
  const [d, setD] = useState<Daten | null>(null)
  const [mcZiel, setMcZiel] = useState<Record<number, number>>({})
  const [prefixVon, setPrefixVon] = useState<Record<number, number | null>>({})
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState<'alle' | 'konflikt' | 'ohne'>('alle')

  const laden = async (ziel = mcZiel) => {
    const r = await fetch('/api/admin2/raenge/umstellung', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mcZiel: ziel }) })
    const x = await r.json().catch(() => ({}))
    if (!r.ok) return flash(x.error || 'Fehler', true)
    setD(x)
    setMcZiel(m => Object.keys(m).length ? m : Object.fromEntries(x.alteRaenge.map((a: AltRang) => [a.id, a.ziel])))
    // Vorschlag Prefix-Quelle: alter Rang mit gleichem Ziel und den meisten Spielern
    setPrefixVon(p => Object.keys(p).length ? p : Object.fromEntries(x.neueRaenge.map((n: NeuRang) => {
      const q = (x.alteRaenge as AltRang[]).filter(a => a.ziel === n.id).sort((a, b) => b.spieler - a.spieler)[0]
      return [n.id, q?.id ?? null]
    })))
  }
  useEffect(() => { laden() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const rang = (id: number) => d?.neueRaenge.find(r => r.id === id)
  const zaehlung = useMemo(() => {
    const m = new Map<number, number>()
    for (const p of d?.personen ?? []) m.set(p.ziel, (m.get(p.ziel) ?? 0) + 1)
    return m
  }, [d])
  const gezeigt = (d?.personen ?? []).filter(p => filter === 'alle' || (filter === 'konflikt' ? p.konflikt || p.verliert?.length > 0 : !p.uuid))

  const ausfuehren = async () => {
    if (!confirm('Jetzt umstellen? Die alten Website-Rollen zählen danach nicht mehr. Clan-Daten (Beitritt, Stufe, Abzeichen) bleiben erhalten.')) return
    setBusy(true)
    const r = await fetch('/api/admin2/raenge/umstellung', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mcZiel, prefixVon, ausfuehren: true }) })
    const x = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) return flash(x.error || 'Umstellung fehlgeschlagen', true)
    flash(`Fertig: ${x.gesetzt} Personen umgestellt, ${x.neueAkten} neue Clan-Akten${x.geloescht?.length ? `, alte Ränge entfernt: ${x.geloescht.join(', ')}` : ''}${x.ohneUuid?.length ? ` · ohne Minecraft-UUID: ${x.ohneUuid.join(', ')}` : ''}`)
    fertig()
  }

  if (!d) return <p className="text-sm" style={{ color: 'var(--muted)' }}>Lädt …</p>
  if (d.neueRaenge.length < 2) return <div style={card} className="text-sm" >Die neuen Ränge fehlen noch. Bitte erst die Datenbank-Befehle ausführen.</div>

  return (
    <div className="space-y-5">
      <div style={card} className="space-y-2 text-sm" >
        <p style={{ color: 'var(--foreground)' }}><b>So funktioniert die Umstellung</b></p>
        <ul className="list-disc pl-5 space-y-1" style={{ color: 'var(--muted)' }}>
          <li>Quellen: Website-Rolle, Clan-Rolle (/clan), alter Minecraft-Rang und die Clan-Liste aus dem Spiel.</li>
          <li>Steht jemand in der Clan-Liste aus dem Spiel, zählt dieser Rang statt der alten Clan-Rolle und des alten Minecraft-Rangs. Die alte Website-Rolle zählt weiter mit – hat jemand mehrere, gewinnt der höchste Rang.</li>
          <li>Jede Person hat danach nur noch EINEN Rang. Wer dadurch Website-Rechte verliert (z. B. Server-Team, das jetzt Clan-Mod ist), ist unten rot markiert – du kannst es danach unter „Personen“ oder bei den Rechten des Rangs ändern.</li>
          <li>Nichts aus /clan geht verloren: Beitrittsdatum, Stufe, Discord und Abzeichen bleiben. Neue Clan-Mitglieder aus der Spiel-Liste bekommen heute als Beitritt.</li>
          <li>Alte Minecraft-Ränge, die danach niemand mehr hat, werden gelöscht.</li>
        </ul>
      </div>

      {d.alteRaenge.length > 0 && (
        <div style={card} className="space-y-3">
          <h3 className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>1. Alte Minecraft-Ränge</h3>
          <div className="space-y-2">
            {d.alteRaenge.map(a => (
              <div key={a.id} className="flex flex-wrap items-center gap-3 text-sm">
                <span className="min-w-[160px]" style={{ color: 'var(--foreground)' }}>{a.anzeige.replace(/[§&][0-9a-fk-or]/gi, '')} <span style={{ color: 'var(--muted)' }}>({a.spieler} Spieler)</span></span>
                <span style={{ color: 'var(--muted)' }}>→</span>
                <select style={inp} value={mcZiel[a.id] ?? a.ziel} onChange={e => { const z = { ...mcZiel, [a.id]: Number(e.target.value) }; setMcZiel(z); laden(z) }}>
                  {d.neueRaenge.map(n => <option key={n.id} value={n.id}>{n.anzeige}</option>)}
                </select>
              </div>
            ))}
          </div>
          <h3 className="font-bold text-sm pt-2" style={{ color: 'var(--foreground)' }}>Prefixe, Farbe und Minecraft-Permissions übernehmen</h3>
          <div className="grid sm:grid-cols-2 gap-2">
            {d.neueRaenge.map(n => (
              <div key={n.id} className="flex items-center gap-2 text-sm">
                <span className="min-w-[110px] font-semibold" style={{ color: n.farbe }}>{n.anzeige}</span>
                <select style={{ ...inp, flex: 1 }} value={prefixVon[n.id] ?? ''} onChange={e => setPrefixVon(p => ({ ...p, [n.id]: e.target.value ? Number(e.target.value) : null }))}>
                  <option value="">nichts übernehmen</option>
                  {d.alteRaenge.map(a => <option key={a.id} value={a.id}>von „{a.anzeige.replace(/[§&][0-9a-fk-or]/gi, '')}“</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={card} className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-bold text-sm mr-auto" style={{ color: 'var(--foreground)' }}>2. Vorschau: {d.personen.length} Personen</h3>
          {d.neueRaenge.filter(n => zaehlung.get(n.id)).map(n => <span key={n.id} className="text-xs px-2 py-1 rounded-full" style={{ background: `${n.farbe}22`, color: n.farbe }}>{n.anzeige}: {zaehlung.get(n.id)}</span>)}
        </div>
        <div className="flex gap-2">
          {(['alle', 'konflikt', 'ohne'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className="px-3 py-1 rounded-full text-xs" style={filter === f ? { background: 'var(--foreground)', color: 'var(--background)' } : ghostBtn}>
              {f === 'alle' ? 'Alle' : f === 'konflikt' ? `Mehrere Quellen (${d.personen.filter(p => p.konflikt || p.verliert?.length > 0).length})` : `Ohne Minecraft (${d.personen.filter(p => !p.uuid).length})`}
            </button>
          ))}
        </div>
        <div className="max-h-[480px] overflow-y-auto rounded-lg" style={{ border: '1px solid var(--card-border)' }}>
          {gezeigt.map((p, i) => {
            const r = rang(p.ziel)
            return (
              <div key={`${p.name}-${i}`} className="px-3 py-2 text-sm flex flex-wrap gap-x-3 gap-y-1 items-baseline" style={{ borderTop: i ? '1px solid var(--card-border)' : undefined, background: p.konflikt ? '#f59e0b0d' : undefined }}>
                <b style={{ color: 'var(--foreground)' }}>{p.name}</b>
                <span className="text-xs font-semibold" style={{ color: r?.farbe }}>{r?.anzeige}</span>
                {!p.uuid && <span className="text-[11px]" style={{ color: '#f59e0b' }}>ohne Minecraft-UUID{p.konto ? ' – Rang gilt fürs Website-Konto' : ''}</span>}
                {p.neueAkte && <span className="text-[11px]" style={{ color: '#4ade80' }}>neu auf /clan</span>}
                {p.verliert?.length > 0 && <span className="text-[11px] font-semibold" style={{ color: '#f87171' }}>verliert Website-Rechte: {p.verliert.map(k => RECHTE.find(r => r.key === k)?.name ?? k).join(', ')}</span>}
                <span className="text-[11px] w-full" style={{ color: 'var(--muted)' }}>{p.quellen.join(' · ')}</span>
              </div>
            )
          })}
        </div>
        {d.ohneUuid.length > 0 && (
          <p className="text-xs" style={{ color: '#f59e0b' }}>Clan-Mitglieder ohne gefundene Minecraft-UUID (beim Umstellen wird noch bei Mojang nachgeschaut): {d.ohneUuid.join(', ')}</p>
        )}
      </div>

      <div className="flex justify-end">
        <button onClick={ausfuehren} disabled={busy} className="px-6 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50" style={gradBtn}>
          {busy ? 'Stellt um … (kann bis zu einer Minute dauern)' : '3. Jetzt umstellen'}
        </button>
      </div>
    </div>
  )
}
