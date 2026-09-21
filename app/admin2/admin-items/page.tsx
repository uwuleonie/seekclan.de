'use client'

import React, { useEffect, useState } from 'react'

// ── Typen ──────────────────────────────────────────────────────────────────

type EggDef = {
  item_id: string
  week: number
  name: string
  effect: string
}

type PlayerItem = {
  id: number
  uuid: string
  player_name: string
  item_id: string
  granted_at: string
  granted_by: string | null
  cooldown_until: number | null
  last_totem_death: string | null
}

// ── Hilfsfunktionen ────────────────────────────────────────────────────────

function formatCooldown(epochSeconds: number | null): string {
  if (!epochSeconds) return '—'
  const now = Math.floor(Date.now() / 1000)
  const remaining = epochSeconds - now
  if (remaining <= 0) return 'Abgelaufen'
  const h = Math.floor(remaining / 3600)
  const m = Math.floor((remaining % 3600) / 60)
  const s = remaining % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function eggWeek(itemId: string): number {
  return parseInt(itemId.replace('dragon_egg_', ''))
}

// ── Komponente ─────────────────────────────────────────────────────────────

export default function AdminItemsPage() {
  const [definitions, setDefinitions] = useState<EggDef[]>([])
  const [items, setItems] = useState<PlayerItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Vergabe-Formular
  const [giveUuid, setGiveUuid] = useState('')
  const [givePlayerName, setGivePlayerName] = useState('')
  const [giveItemId, setGiveItemId] = useState('dragon_egg_1')
  const [giveLoading, setGiveLoading] = useState(false)
  const [giveMsg, setGiveMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // Filter
  const [filterPlayer, setFilterPlayer] = useState('')
  const [filterWeek, setFilterWeek] = useState('')

  // Aktiv-Tab
  const [tab, setTab] = useState<'vergabe' | 'uebersicht'>('uebersicht')

  // ── Daten laden ──────────────────────────────────────────────────────────

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin2/admin-items')
      if (!res.ok) throw new Error('Kein Zugriff')
      const data = await res.json()
      setDefinitions(data.definitions)
      setItems(data.items)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // ── Item vergeben ─────────────────────────────────────────────────────────

  async function handleGive(e: React.FormEvent) {
    e.preventDefault()
    if (!giveUuid || !givePlayerName || !giveItemId) return
    setGiveLoading(true)
    setGiveMsg(null)
    try {
      const res = await fetch('/api/admin2/admin-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid: giveUuid, player_name: givePlayerName, item_id: giveItemId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setGiveMsg({ type: 'err', text: data.error ?? 'Fehler' })
      } else {
        setGiveMsg({ type: 'ok', text: '✓ Item vergeben!' })
        setGiveUuid('')
        setGivePlayerName('')
        load()
      }
    } finally {
      setGiveLoading(false)
    }
  }

  // ── Item entziehen ────────────────────────────────────────────────────────

  async function handleRemove(id: number, playerName: string, itemId: string) {
    if (!confirm(`${itemId} von ${playerName} entziehen?`)) return
    await fetch('/api/admin2/admin-items', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    load()
  }

  // ── Cooldown resetten ─────────────────────────────────────────────────────

  async function handleResetCooldown(uuid: string, itemId: string, playerName: string) {
    if (!confirm(`Cooldown für ${itemId} von ${playerName} zurücksetzen?`)) return
    await fetch('/api/admin2/admin-items', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uuid, item_id: itemId }),
    })
    load()
  }

  // ── Gefilterte Items ──────────────────────────────────────────────────────

  const filteredItems = items.filter(item => {
    if (filterPlayer && !item.player_name.toLowerCase().includes(filterPlayer.toLowerCase())) return false
    if (filterWeek && item.item_id !== `dragon_egg_${filterWeek}`) return false
    return true
  })

  // Übersicht: wie viele Spieler haben welches Ei
  const eggStats = definitions.map(def => ({
    ...def,
    count: items.filter(i => i.item_id === def.item_id).length,
    players: items.filter(i => i.item_id === def.item_id).map(i => i.player_name),
  }))

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ padding: 32, color: '#c4b5fd' }}>Lade Admin-Items...</div>
  )
  if (error) return (
    <div style={{ padding: 32, color: '#f87171' }}>Fehler: {error}</div>
  )

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

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1100, margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: G.lightPurple, margin: 0 }}>
          🥚 UCL-Dracheneier
        </h1>
        <p style={{ color: G.muted, margin: '6px 0 0', fontSize: 14 }}>
          Übersicht und Vergabe der UCL 26/27 Tippspiel-Dracheneier
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {(['uebersicht', 'vergabe'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 18px',
              borderRadius: 8,
              border: `1px solid ${tab === t ? G.purple : G.border}`,
              background: tab === t ? G.purple : G.bg,
              color: tab === t ? '#fff' : G.muted,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: tab === t ? 600 : 400,
            }}
          >
            {t === 'uebersicht' ? '📋 Übersicht' : '➕ Vergeben'}
          </button>
        ))}
        <button
          onClick={load}
          style={{
            marginLeft: 'auto', padding: '8px 14px', borderRadius: 8,
            border: `1px solid ${G.border}`, background: G.bg,
            color: G.muted, cursor: 'pointer', fontSize: 13,
          }}
        >
          ↻ Aktualisieren
        </button>
      </div>

      {/* ── TAB: Übersicht ───────────────────────────────────────────────────── */}
      {tab === 'uebersicht' && (
        <>
          {/* Ei-Statistik-Karten */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 28 }}>
            {eggStats.map(egg => (
              <div key={egg.item_id} style={{
                background: G.bg,
                border: `1px solid ${G.border}`,
                borderRadius: 10,
                padding: '14px 16px',
              }}>
                <div style={{ fontSize: 13, color: G.gold, fontWeight: 600, marginBottom: 4 }}>
                  Woche {egg.week}
                </div>
                <div style={{ fontSize: 12, color: G.text, marginBottom: 6 }}>{egg.effect}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: egg.count > 0 ? G.green : G.muted }}>
                  {egg.count} / 1
                </div>
                <div style={{ fontSize: 11, color: G.muted, marginTop: 2 }}>
                  {egg.players.length > 0 ? egg.players.join(', ') : 'Noch nicht vergeben'}
                </div>
              </div>
            ))}
          </div>

          {/* Filter */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <input
              placeholder="Spieler filtern..."
              value={filterPlayer}
              onChange={e => setFilterPlayer(e.target.value)}
              style={{
                padding: '8px 12px', borderRadius: 8,
                border: `1px solid ${G.border}`, background: G.bg,
                color: G.text, fontSize: 13, width: 200,
              }}
            />
            <select
              value={filterWeek}
              onChange={e => setFilterWeek(e.target.value)}
              style={{
                padding: '8px 12px', borderRadius: 8,
                border: `1px solid ${G.border}`, background: '#1e1b2e',
                color: G.text, fontSize: 13,
              }}
            >
              <option value="">Alle Wochen</option>
              {definitions.map(d => (
                <option key={d.item_id} value={String(d.week)}>Woche {d.week}</option>
              ))}
            </select>
          </div>

          {/* Items-Tabelle */}
          <div style={{
            background: G.bg, border: `1px solid ${G.border}`,
            borderRadius: 12, overflow: 'hidden',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${G.border}` }}>
                  {['Spieler', 'Item', 'Vergeben von', 'Vergeben am', 'Cooldown', 'Aktionen'].map(h => (
                    <th key={h} style={{
                      padding: '10px 14px', textAlign: 'left',
                      color: G.muted, fontWeight: 600,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 20, textAlign: 'center', color: G.muted }}>
                      Keine Einträge gefunden.
                    </td>
                  </tr>
                ) : filteredItems.map(item => {
                  const def = definitions.find(d => d.item_id === item.item_id)
                  const hasCooldown = item.cooldown_until && item.cooldown_until > Math.floor(Date.now() / 1000)
                  return (
                    <tr key={item.id} style={{ borderBottom: `1px solid ${G.border}` }}>
                      <td style={{ padding: '10px 14px', color: G.text, fontWeight: 600 }}>
                        {item.player_name}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ color: G.gold }}>Woche {eggWeek(item.item_id)}</span>
                        <br />
                        <span style={{ color: G.muted, fontSize: 11 }}>{def?.effect ?? item.item_id}</span>
                        {item.last_totem_death && item.item_id === 'dragon_egg_6' && (
                          <div style={{ color: G.purple, fontSize: 11, marginTop: 2 }}>
                            Letzter Tod: {new Date(item.last_totem_death).toLocaleString('de-DE')}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px', color: G.muted }}>
                        {item.granted_by ?? '—'}
                      </td>
                      <td style={{ padding: '10px 14px', color: G.muted }}>
                        {new Date(item.granted_at).toLocaleDateString('de-DE')}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        {hasCooldown ? (
                          <span style={{ color: G.red }}>{formatCooldown(item.cooldown_until)}</span>
                        ) : (
                          <span style={{ color: G.green }}>Bereit</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {hasCooldown && (
                            <button
                              onClick={() => handleResetCooldown(item.uuid, item.item_id, item.player_name)}
                              style={{
                                padding: '4px 10px', borderRadius: 6, fontSize: 12,
                                border: `1px solid ${G.border}`, background: G.bg,
                                color: G.gold, cursor: 'pointer',
                              }}
                            >
                              CD reset
                            </button>
                          )}
                          <button
                            onClick={() => handleRemove(item.id, item.player_name, item.item_id)}
                            style={{
                              padding: '4px 10px', borderRadius: 6, fontSize: 12,
                              border: '1px solid rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.1)',
                              color: G.red, cursor: 'pointer',
                            }}
                          >
                            Entziehen
                          </button>
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

      {/* ── TAB: Vergeben ─────────────────────────────────────────────────────── */}
      {tab === 'vergabe' && (
        <div style={{
          background: G.bg, border: `1px solid ${G.border}`,
          borderRadius: 12, padding: 24, maxWidth: 480,
        }}>
          <h2 style={{ color: G.lightPurple, fontSize: 16, margin: '0 0 20px', fontWeight: 600 }}>
            Drachenbein vergeben
          </h2>

          <form onSubmit={handleGive}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', color: G.muted, fontSize: 12, marginBottom: 6 }}>
                Spieler-UUID *
              </label>
              <input
                value={giveUuid}
                onChange={e => setGiveUuid(e.target.value)}
                placeholder="550e8400-e29b-41d4-a716-..."
                required
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 8, boxSizing: 'border-box',
                  border: `1px solid ${G.border}`, background: 'rgba(0,0,0,0.3)',
                  color: G.text, fontSize: 13,
                }}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', color: G.muted, fontSize: 12, marginBottom: 6 }}>
                Minecraft-Name *
              </label>
              <input
                value={givePlayerName}
                onChange={e => setGivePlayerName(e.target.value)}
                placeholder="uwuleonie"
                required
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 8, boxSizing: 'border-box',
                  border: `1px solid ${G.border}`, background: 'rgba(0,0,0,0.3)',
                  color: G.text, fontSize: 13,
                }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', color: G.muted, fontSize: 12, marginBottom: 6 }}>
                Drachenbein *
              </label>
              <select
                value={giveItemId}
                onChange={e => setGiveItemId(e.target.value)}
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 8, boxSizing: 'border-box',
                  border: `1px solid ${G.border}`, background: '#1e1b2e',
                  color: G.text, fontSize: 13,
                }}
              >
                {definitions.map(def => {
                  const alreadyGiven = items.some(i => i.item_id === def.item_id)
                  return (
                    <option key={def.item_id} value={def.item_id}>
                      Woche {def.week} — {def.effect}{alreadyGiven ? ' ✓ bereits vergeben' : ''}
                    </option>
                  )
                })}
              </select>
            </div>

            {giveMsg && (
              <div style={{
                padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 13,
                background: giveMsg.type === 'ok' ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
                border: `1px solid ${giveMsg.type === 'ok' ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}`,
                color: giveMsg.type === 'ok' ? G.green : G.red,
              }}>
                {giveMsg.text}
              </div>
            )}

            <button
              type="submit"
              disabled={giveLoading}
              style={{
                width: '100%', padding: '10px', borderRadius: 8,
                border: 'none', background: G.purple,
                color: '#fff', fontSize: 14, fontWeight: 600,
                cursor: giveLoading ? 'not-allowed' : 'pointer',
                opacity: giveLoading ? 0.7 : 1,
              }}
            >
              {giveLoading ? 'Vergebe...' : '✓ Drachenbein vergeben'}
            </button>
          </form>

          <p style={{ color: G.muted, fontSize: 12, marginTop: 14 }}>
            Das Item wird in der Datenbank gespeichert. Der Spieler kann es beim nächsten
            Einloggen per <code style={{ color: G.lightPurple }}>/adminitems</code> abholen
            oder erhält es direkt im Inventar wenn er online ist.
          </p>
        </div>
      )}
    </div>
  )
}