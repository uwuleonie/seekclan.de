'use client'

// /admin2/personen → Tab „Personen“: ALLE an einem Ort – Website-Konten, Minecraft-Spieler mit Rang und Clan-Mitglieder.
// Eine Zeile antippen → rechts öffnet sich die Person mit allem (Rang, Minecraft, Clan-Akte, Abzeichen, Verlauf, Konto).

import { useMemo, useState } from 'react'
import { useAuth } from '../../../lib/auth-context'
import { darf, darfRangGeben } from '@/app/lib/rechte-def'
import { card, gradBtn, inp, RangSchild, type Person, type RangVoll } from './typen'

type Filter = 'alle' | 'clan' | 'team' | 'konten' | 'ohne-mc' | 'gesperrt' | number

const vor = (iso: string | null | undefined) => {
  if (!iso) return '–'
  const t = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  return t <= 0 ? 'heute' : t === 1 ? 'gestern' : t < 30 ? `vor ${t} Tagen` : new Date(iso).toLocaleDateString('de-DE')
}

export default function PersonenListe({ personen, laedt, raenge, suche, setSuche, oeffnen, ausgewaehlt, neuLaden, flash }: {
  personen: Person[]; laedt: boolean; raenge: RangVoll[]; suche: string; setSuche: (s: string) => void
  oeffnen: (p: Person) => void; ausgewaehlt: string | null; neuLaden: () => void; flash: (t: string, f?: boolean) => void
}) {
  const { user } = useAuth()
  const [filter, setFilter] = useState<Filter>('alle')
  const [neuName, setNeuName] = useState('')
  const [neuRang, setNeuRang] = useState<number | ''>('')
  const [busy, setBusy] = useState(false)
  const rang = (id: number) => raenge.find(r => r.id === id)

  const passt = (p: Person, f: Filter) => {
    const r = rang(p.rangId)
    if (f === 'clan') return !!r?.clan
    if (f === 'team') return !!r?.team
    if (f === 'konten') return !!p.userId
    if (f === 'ohne-mc') return !!p.userId && !p.uuid
    if (f === 'gesperrt') return p.gesperrt || !!p.deaktiviert
    if (typeof f === 'number') return p.rangId === f
    return true
  }
  const gezeigt = useMemo(() => personen.filter(p => passt(p, filter)), [personen, filter, raenge]) // eslint-disable-line react-hooks/exhaustive-deps
  const zahl = (f: Filter) => personen.filter(p => passt(p, f)).length

  const rangGeben = async () => {
    setBusy(true)
    const r = await fetch('/api/admin2/personen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mcName: neuName.trim(), rangId: neuRang }) })
    const d = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) { flash(d.error || 'Fehler', true); return }
    flash(`${neuName.trim()} hat jetzt den Rang ${rang(Number(neuRang))?.anzeige ?? ''}`)
    setNeuName(''); setNeuRang(''); neuLaden()
  }

  const chip = (f: Filter, text: string, farbe?: string) => {
    const an = filter === f
    return (
      <button key={String(f)} onClick={() => setFilter(an && f !== 'alle' ? 'alle' : f)} className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap"
        style={an ? { background: farbe ?? 'var(--foreground)', color: farbe ? '#111' : 'var(--background)' } : { background: farbe ? `${farbe}1f` : 'var(--muted-bg)', color: farbe ?? 'var(--muted)' }}>
        {text} ({zahl(f)})
      </button>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input style={{ ...inp, minWidth: 240, flex: '1 1 240px' }} value={suche} onChange={e => setSuche(e.target.value)} placeholder="Name, Konto oder Minecraft-Name suchen …" />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {chip('alle', 'Alle')}
        {chip('clan', 'Clan')}
        {chip('team', 'Team')}
        {chip('konten', 'Website-Konten')}
        {chip('ohne-mc', 'Konten ohne Minecraft')}
        {chip('gesperrt', 'Gesperrt/deaktiviert')}
        <span className="w-px mx-1" style={{ background: 'var(--card-border)' }} />
        {raenge.filter(r => personen.some(p => p.rangId === r.id)).map(r => chip(r.id, r.anzeige, r.farbe))}
      </div>
      {!suche && <p className="text-xs" style={{ color: 'var(--muted)' }}>Ohne Suche: alle Website-Konten, alle mit besonderem Rang und alle Clan-Akten. Spieler nur mit Standard-Rang und ohne Konto findest du über die Suche.</p>}

      {laedt && !personen.length ? <p className="text-sm" style={{ color: 'var(--muted)' }}>Lädt …</p> : !gezeigt.length ? (
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Niemand gefunden.</p>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--card-border)' }}>
          {gezeigt.map((p, i) => {
            const r = rang(p.rangId)
            const an = ausgewaehlt === p.key
            return (
              <button key={p.key} type="button" onClick={() => oeffnen(p)} className="w-full flex flex-wrap items-center gap-3 px-4 py-2.5 text-left transition-colors"
                style={{ background: an ? '#7C3AED22' : i % 2 ? 'transparent' : 'var(--card-bg)', borderTop: i ? '1px solid var(--card-border)' : undefined, outline: an ? '1px solid #7C3AED66' : undefined }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/player-heads/${encodeURIComponent(p.mcName || p.name)}/64?v=2`} alt="" className="w-8 h-8 rounded-md flex-shrink-0" loading="lazy" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>{p.name}</span>
                    {p.userId ? <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: 'var(--muted-bg)', color: 'var(--muted)' }}>Konto{p.username && p.username !== p.name ? `: ${p.username}` : ''}</span>
                      : <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: 'var(--muted-bg)', color: 'var(--muted)' }}>nur Minecraft</span>}
                    {p.userId && !p.uuid && <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: '#f59e0b22', color: '#f59e0b' }}>ohne Minecraft</span>}
                    {p.clanId && <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: '#22c55e22', color: '#4ade80' }}>Clan-Akte</span>}
                    {p.gesperrt && <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: '#ef444422', color: '#f87171' }}>gesperrt</span>}
                    {p.deaktiviert && <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: '#ef444422', color: '#f87171' }}>deaktiviert</span>}
                  </div>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>
                    {p.mcName && p.mcName !== p.name ? `Minecraft: ${p.mcName} · ` : ''}{p.userId ? `letzter Login ${vor(p.letzterLogin)}` : p.vergebenVon ? `Rang von ${p.vergebenVon}` : 'Spieler'}
                  </p>
                </div>
                <RangSchild rang={r} klein />
              </button>
            )
          })}
        </div>
      )}

      {darf(user, 'raenge.vergeben') && (
        <div style={card} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>Jemandem ohne Konto einen Rang geben – Minecraft-Name (muss nicht online sein)</label>
            <input style={{ ...inp, width: '100%' }} value={neuName} onChange={e => setNeuName(e.target.value)} placeholder="z. B. Notch" />
          </div>
          <select style={inp} value={neuRang} onChange={e => setNeuRang(e.target.value ? Number(e.target.value) : '')}>
            <option value="">Rang wählen …</option>
            {raenge.filter(r => darfRangGeben(user, null, r)).map(r => <option key={r.id} value={r.id}>{r.anzeige}</option>)}
          </select>
          <button disabled={!neuName.trim() || !neuRang || busy} className="px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-40" style={gradBtn} onClick={rangGeben}>
            {busy ? 'Suche …' : 'Rang geben'}
          </button>
        </div>
      )}
    </div>
  )
}
