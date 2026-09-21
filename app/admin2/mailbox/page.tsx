'use client'

import React, { useEffect, useState } from 'react'

type MailboxEntry = {
  id: number
  receiver_uuid: string
  receiver_name: string
  item_data: string
  sender_name: string | null
  sent_at: string
}

export default function MailboxAdminPage() {
  const [items, setItems] = useState<MailboxEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filterPlayer, setFilterPlayer] = useState('')

  // Formular
  const [form, setForm] = useState({
    receiver_uuid: '',
    receiver_name: '',
    item_data: '',
    sender_name: '',
  })
  const [formLoading, setFormLoading] = useState(false)
  const [formMsg, setFormMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [tab, setTab] = useState<'uebersicht' | 'senden'>('uebersicht')

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

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin2/mailbox')
      const data = await res.json()
      setItems(data.items ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    setFormLoading(true)
    setFormMsg(null)
    try {
      const res = await fetch('/api/admin2/mailbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setFormMsg({ type: 'err', text: data.error ?? 'Fehler' })
      } else {
        setFormMsg({ type: 'ok', text: '✓ Item in Mailbox gelegt!' })
        setForm({ receiver_uuid: '', receiver_name: '', item_data: '', sender_name: '' })
        load()
      }
    } finally {
      setFormLoading(false)
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Item von ${name} löschen?`)) return
    await fetch('/api/admin2/mailbox', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    load()
  }

  const filtered = items.filter(i =>
    !filterPlayer || i.receiver_name.toLowerCase().includes(filterPlayer.toLowerCase())
  )

  // Statistik: Items pro Spieler
  const perPlayer = items.reduce((acc, i) => {
    acc[i.receiver_name] = (acc[i.receiver_name] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  const inp: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 8, boxSizing: 'border-box',
    border: `1px solid ${G.border}`, background: 'rgba(0,0,0,0.3)',
    color: G.text, fontSize: 13,
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1000, margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: G.lightPurple, margin: 0 }}>
          📬 Mailbox
        </h1>
        <p style={{ color: G.muted, margin: '6px 0 0', fontSize: 14 }}>
          Items in Spieler-Mailboxen verwalten
        </p>
      </div>

      {/* Statistik-Karten */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ background: G.bg, border: `1px solid ${G.border}`, borderRadius: 10, padding: '14px 20px' }}>
          <div style={{ fontSize: 12, color: G.muted }}>Items gesamt</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: G.lightPurple }}>{items.length}</div>
        </div>
        <div style={{ background: G.bg, border: `1px solid ${G.border}`, borderRadius: 10, padding: '14px 20px' }}>
          <div style={{ fontSize: 12, color: G.muted }}>Spieler mit Items</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: G.gold }}>{Object.keys(perPlayer).length}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {(['uebersicht', 'senden'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 18px', borderRadius: 8,
            border: `1px solid ${tab === t ? G.purple : G.border}`,
            background: tab === t ? G.purple : G.bg,
            color: tab === t ? '#fff' : G.muted,
            cursor: 'pointer', fontSize: 14, fontWeight: tab === t ? 600 : 400,
          }}>
            {t === 'uebersicht' ? '📋 Übersicht' : '➕ Item senden'}
          </button>
        ))}
        <button onClick={load} style={{
          marginLeft: 'auto', padding: '8px 14px', borderRadius: 8,
          border: `1px solid ${G.border}`, background: G.bg,
          color: G.muted, cursor: 'pointer', fontSize: 13,
        }}>↻</button>
      </div>

      {/* ── Übersicht ─────────────────────────────────────────────────────────── */}
      {tab === 'uebersicht' && (
        <>
          <input
            placeholder="Spieler filtern..."
            value={filterPlayer}
            onChange={e => setFilterPlayer(e.target.value)}
            style={{ ...inp, width: 220, marginBottom: 16 }}
          />

          {loading ? (
            <div style={{ color: G.muted }}>Lade...</div>
          ) : (
            <div style={{
              background: G.bg, border: `1px solid ${G.border}`,
              borderRadius: 12, overflow: 'hidden',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${G.border}` }}>
                    {['Empfänger', 'Von', 'Gesendet am', 'Item-Data (gekürzt)', 'Aktionen'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: G.muted, fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: 20, textAlign: 'center', color: G.muted }}>
                        Keine Items in der Mailbox.
                      </td>
                    </tr>
                  ) : filtered.map(item => (
                    <tr key={item.id} style={{ borderBottom: `1px solid ${G.border}` }}>
                      <td style={{ padding: '10px 14px', color: G.text, fontWeight: 600 }}>
                        {item.receiver_name}
                        <div style={{ fontSize: 11, color: G.muted, fontWeight: 400 }}>{item.receiver_uuid}</div>
                      </td>
                      <td style={{ padding: '10px 14px', color: G.muted }}>{item.sender_name ?? '—'}</td>
                      <td style={{ padding: '10px 14px', color: G.muted }}>
                        {new Date(item.sent_at).toLocaleString('de-DE')}
                      </td>
                      <td style={{ padding: '10px 14px', color: G.muted, fontFamily: 'monospace', fontSize: 11 }}>
                        {item.item_data.substring(0, 30)}...
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <button
                          onClick={() => handleDelete(item.id, item.receiver_name)}
                          style={{
                            padding: '4px 10px', borderRadius: 6, fontSize: 12,
                            border: '1px solid rgba(248,113,113,0.3)',
                            background: 'rgba(248,113,113,0.1)',
                            color: G.red, cursor: 'pointer',
                          }}
                        >
                          Löschen
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── Item senden ───────────────────────────────────────────────────────── */}
      {tab === 'senden' && (
        <div style={{
          background: G.bg, border: `1px solid ${G.border}`,
          borderRadius: 12, padding: 24, maxWidth: 500,
        }}>
          <h2 style={{ color: G.lightPurple, fontSize: 16, margin: '0 0 20px', fontWeight: 600 }}>
            Item in Mailbox legen
          </h2>

          <p style={{ color: G.muted, fontSize: 13, marginBottom: 16 }}>
            Die Item-Data ist ein Base64-serialisierter ItemStack im Bukkit-Format.
            Nutze den Ingame-Befehl <code style={{ color: G.lightPurple }}>/giveadminitem</code> um
            Admin-Items direkt zu vergeben — die landen automatisch in der Mailbox wenn der Spieler offline ist.
          </p>

          <form onSubmit={handleSend}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', color: G.muted, fontSize: 12, marginBottom: 6 }}>Spieler-UUID *</label>
              <input value={form.receiver_uuid} onChange={e => setForm(f => ({ ...f, receiver_uuid: e.target.value }))}
                placeholder="550e8400-e29b-41d4-a716-..." required style={inp} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', color: G.muted, fontSize: 12, marginBottom: 6 }}>Minecraft-Name *</label>
              <input value={form.receiver_name} onChange={e => setForm(f => ({ ...f, receiver_name: e.target.value }))}
                placeholder="uwuleonie" required style={inp} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', color: G.muted, fontSize: 12, marginBottom: 6 }}>Item-Data (Base64) *</label>
              <textarea value={form.item_data} onChange={e => setForm(f => ({ ...f, item_data: e.target.value }))}
                placeholder="rO0ABXNyAC9vcmcuYnVra2l0..." required
                style={{ ...inp, minHeight: 80, resize: 'vertical' }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', color: G.muted, fontSize: 12, marginBottom: 6 }}>Absender-Name</label>
              <input value={form.sender_name} onChange={e => setForm(f => ({ ...f, sender_name: e.target.value }))}
                placeholder="Admin" style={inp} />
            </div>

            {formMsg && (
              <div style={{
                padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 13,
                background: formMsg.type === 'ok' ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
                border: `1px solid ${formMsg.type === 'ok' ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}`,
                color: formMsg.type === 'ok' ? G.green : G.red,
              }}>{formMsg.text}</div>
            )}

            <button type="submit" disabled={formLoading} style={{
              width: '100%', padding: '10px', borderRadius: 8,
              border: 'none', background: G.purple, color: '#fff',
              fontSize: 14, fontWeight: 600,
              cursor: formLoading ? 'not-allowed' : 'pointer',
              opacity: formLoading ? 0.7 : 1,
            }}>
              {formLoading ? 'Sende...' : '📬 In Mailbox legen'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}