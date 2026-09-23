'use client'

import React, { useEffect, useState } from 'react'

type EggDef = { item_id: string; week: number; effect: string }

type PlayerItem = {
  id: number
  uuid: string
  player_name: string
  item_id: string
  in_menu: boolean
  granted_at: string
  granted_by: string | null
  cooldown_until: string | number | null
  last_totem_death: string | null
}

const G = {
  bg: 'rgba(255,255,255,0.03)',
  border: 'rgba(139,92,246,0.2)',
  purple: '#7c3aed',
  lightPurple: '#c4b5fd',
  text: '#e2e8f0',
  muted: '#94a3b8',
  green: '#4ade80',
  red: '#f87171',
  gold: '#fbbf24',
}

function remaining(until: string | number | null): number {
  if (until == null) return 0
  return Math.max(0, Number(until) - Math.floor(Date.now() / 1000))
}

function formatSeconds(s: number): string {
  if (s <= 0) return 'Bereit'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s % 60}s`
  return `${s}s`
}

export default function AdminItemsPage() {
  const [definitions, setDefinitions] = useState<EggDef[]>([])
  const [items, setItems] = useState<PlayerItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'uebersicht' | 'vergabe'>('uebersicht')

  const [playerName, setPlayerName] = useState('')
  const [itemId, setItemId] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin2/admin-items')
      if (!res.ok) throw new Error('Kein Zugriff')
      const data = await res.json()
      setDefinitions(data.definitions)
      setItems(data.items)
      const free = (data.definitions as EggDef[]).find(
        d => !(data.items as PlayerItem[]).some(i => i.item_id === d.item_id)
      )
      setItemId(prev => prev || free?.item_id || '')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleGive(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/api/admin2/admin-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_name: playerName, item_id: itemId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMsg({ type: 'err', text: data.error ?? 'Fehler' })
      } else {
        setMsg({ type: 'ok', text: `✓ Ei an ${data.player_name} vergeben — liegt in /adminitems.` })
        setPlayerName('')
        setItemId('')
        load()
      }
    } catch {
      setMsg({ type: 'err', text: 'Netzwerkfehler.' })
    } finally {
      setBusy(false)
    }
  }

  async function patch(action: 'reset_cooldown' | 'return_to_menu', item: PlayerItem) {
    const text = action === 'reset_cooldown'
      ? `Cooldown von ${item.player_name} zurücksetzen?`
      : `Ei von ${item.player_name} zurück ins Menü setzen?\n\nNur benutzen, wenn das Ei wirklich verloren ist — sonst hat der Spieler es danach doppelt.`
    if (!confirm(text)) return
    await fetch('/api/admin2/admin-items', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, uuid: item.uuid, item_id: item.item_id }),
    })
    load()
  }

  async function remove(item: PlayerItem) {
    if (!confirm(`Ei (Woche ${item.item_id.replace('dragon_egg_', '')}) von ${item.player_name} entziehen?`)) return
    await fetch('/api/admin2/admin-items', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id }),
    })
    load()
  }

  if (loading) return <div style={{ padding: 32, color: G.lightPurple }}>Lade Dracheneier...</div>
  if (error) return <div style={{ padding: 32, color: G.red }}>Fehler: {error}</div>

  const inp: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 8, boxSizing: 'border-box',
    border: `1px solid ${G.border}`, background: 'rgba(0,0,0,0.3)', color: G.text, fontSize: 13,
  }
  const btn = (color: string, bg: string): React.CSSProperties => ({
    padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
    border: `1px solid ${color}55`, background: bg, color,
  })

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1100, margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: G.lightPurple, margin: 0 }}>🥚 UCL-Dracheneier</h1>
        <p style={{ color: G.muted, margin: '6px 0 0', fontSize: 14 }}>
          Jedes Ei gibt es genau einmal. Vergebene Eier landen im /adminitems-Menü des Spielers.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {(['uebersicht', 'vergabe'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 18px', borderRadius: 8, fontSize: 14, cursor: 'pointer',
            border: `1px solid ${tab === t ? G.purple : G.border}`,
            background: tab === t ? G.purple : G.bg,
            color: tab === t ? '#fff' : G.muted, fontWeight: tab === t ? 600 : 400,
          }}>
            {t === 'uebersicht' ? '📋 Übersicht' : '➕ Vergeben'}
          </button>
        ))}
        <button onClick={load} style={{
          marginLeft: 'auto', padding: '8px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
          border: `1px solid ${G.border}`, background: G.bg, color: G.muted,
        }}>↻</button>
      </div>

      {tab === 'uebersicht' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 28 }}>
            {definitions.map(def => {
              const owner = items.find(i => i.item_id === def.item_id)
              return (
                <div key={def.item_id} style={{ background: G.bg, border: `1px solid ${G.border}`, borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: 13, color: G.gold, fontWeight: 600 }}>Woche {def.week}</div>
                  <div style={{ fontSize: 12, color: G.text, margin: '4px 0 8px' }}>{def.effect}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: owner ? G.green : G.muted }}>
                    {owner ? owner.player_name : 'Noch nicht vergeben'}
                  </div>
                  {owner && (
                    <div style={{ fontSize: 11, color: G.muted, marginTop: 2 }}>
                      {owner.in_menu ? '📦 liegt im Menü' : '🎒 herausgenommen'}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div style={{ background: G.bg, border: `1px solid ${G.border}`, borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${G.border}` }}>
                  {['Spieler', 'Ei', 'Ort', 'Cooldown', 'Vergeben', 'Aktionen'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: G.muted, fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: G.muted }}>Noch keine Eier vergeben.</td></tr>
                ) : items.map(item => {
                  const def = definitions.find(d => d.item_id === item.item_id)
                  const cd = remaining(item.cooldown_until)
                  return (
                    <tr key={item.id} style={{ borderBottom: `1px solid ${G.border}` }}>
                      <td style={{ padding: '10px 14px', color: G.text, fontWeight: 600 }}>{item.player_name}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ color: G.gold }}>Woche {def?.week}</span>
                        <div style={{ color: G.muted, fontSize: 11 }}>{def?.effect}</div>
                        {item.item_id === 'dragon_egg_6' && item.last_totem_death && (
                          <div style={{ color: G.lightPurple, fontSize: 11 }}>
                            Letzter Totem-Tod: {new Date(item.last_totem_death).toLocaleString('de-DE')}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px', color: G.muted }}>{item.in_menu ? '📦 Menü' : '🎒 Draußen'}</td>
                      <td style={{ padding: '10px 14px', color: cd > 0 ? G.red : G.green }}>{formatSeconds(cd)}</td>
                      <td style={{ padding: '10px 14px', color: G.muted }}>
                        {new Date(item.granted_at).toLocaleDateString('de-DE')}
                        <div style={{ fontSize: 11 }}>von {item.granted_by ?? '—'}</div>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {cd > 0 && (
                            <button onClick={() => patch('reset_cooldown', item)} style={btn(G.gold, G.bg)}>CD reset</button>
                          )}
                          {!item.in_menu && (
                            <button onClick={() => patch('return_to_menu', item)} style={btn(G.lightPurple, G.bg)}>Ins Menü</button>
                          )}
                          <button onClick={() => remove(item)} style={btn(G.red, 'rgba(248,113,113,0.1)')}>Entziehen</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'vergabe' && (
        <div style={{ background: G.bg, border: `1px solid ${G.border}`, borderRadius: 12, padding: 24, maxWidth: 480 }}>
          <h2 style={{ color: G.lightPurple, fontSize: 16, margin: '0 0 20px', fontWeight: 600 }}>Drachenei vergeben</h2>
          <form onSubmit={handleGive}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', color: G.muted, fontSize: 12, marginBottom: 6 }}>Minecraft-Name *</label>
              <input value={playerName} onChange={e => setPlayerName(e.target.value)} placeholder="uwuleonie" required style={inp} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', color: G.muted, fontSize: 12, marginBottom: 6 }}>Ei *</label>
              <select value={itemId} onChange={e => setItemId(e.target.value)} required style={{ ...inp, background: '#1e1b2e' }}>
                <option value="">— Ei wählen —</option>
                {definitions.map(def => {
                  const owner = items.find(i => i.item_id === def.item_id)
                  return (
                    <option key={def.item_id} value={def.item_id} disabled={!!owner}>
                      Woche {def.week} — {def.effect}{owner ? ` (vergeben an ${owner.player_name})` : ''}
                    </option>
                  )
                })}
              </select>
            </div>

            {msg && (
              <div style={{
                padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 13,
                background: msg.type === 'ok' ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
                border: `1px solid ${msg.type === 'ok' ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}`,
                color: msg.type === 'ok' ? G.green : G.red,
              }}>{msg.text}</div>
            )}

            <button type="submit" disabled={busy || !itemId} style={{
              width: '100%', padding: 10, borderRadius: 8, border: 'none', background: G.purple,
              color: '#fff', fontSize: 14, fontWeight: 600,
              cursor: busy ? 'not-allowed' : 'pointer', opacity: busy || !itemId ? 0.6 : 1,
            }}>
              {busy ? 'Vergebe...' : '✓ Ei vergeben'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}