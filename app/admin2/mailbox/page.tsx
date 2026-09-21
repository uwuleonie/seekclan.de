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

type Template = {
  id: number
  name: string
  item_data: string
  uploaded_by: string
  uploaded_at: string
}

export default function MailboxAdminPage() {
  const [items, setItems] = useState<MailboxEntry[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [filterPlayer, setFilterPlayer] = useState('')
  const [tab, setTab] = useState<'uebersicht' | 'senden' | 'templates'>('uebersicht')

  // Formular
  const [receiverName, setReceiverName] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [senderName, setSenderName] = useState('')
  const [formLoading, setFormLoading] = useState(false)
  const [formMsg, setFormMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

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
      const [itemsRes, templatesRes] = await Promise.all([
        fetch('/api/admin2/mailbox'),
        fetch('/api/admin2/admin-items/templates'),
      ])
      const itemsData = await itemsRes.json()
      const templatesData = await templatesRes.json()
      setItems(itemsData.items ?? [])
      setTemplates(templatesData.templates ?? [])
      if (templatesData.templates?.length > 0 && !selectedTemplateId) {
        setSelectedTemplateId(String(templatesData.templates[0].id))
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // Mojang UUID lookup + Item in Mailbox legen
  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!receiverName || !selectedTemplateId) return
    setFormLoading(true)
    setFormMsg(null)

    try {
      // 1. UUID von Mojang holen
      const mojangRes = await fetch(`https://api.mojang.com/users/profiles/minecraft/${receiverName}`)
      if (!mojangRes.ok) {
        setFormMsg({ type: 'err', text: `Spieler "${receiverName}" nicht bei Mojang gefunden.` })
        return
      }
      const mojang = await mojangRes.json()
      const uuid = [
        mojang.id.slice(0, 8),
        mojang.id.slice(8, 12),
        mojang.id.slice(12, 16),
        mojang.id.slice(16, 20),
        mojang.id.slice(20),
      ].join('-')

      // 2. Template holen
      const template = templates.find(t => String(t.id) === selectedTemplateId)
      if (!template) {
        setFormMsg({ type: 'err', text: 'Template nicht gefunden.' })
        return
      }

      // 3. In Mailbox legen
      const res = await fetch('/api/admin2/mailbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiver_uuid: uuid,
          receiver_name: mojang.name,
          item_data: template.item_data,
          sender_name: senderName || 'Admin',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFormMsg({ type: 'err', text: data.error ?? 'Fehler' })
      } else {
        setFormMsg({ type: 'ok', text: `✓ "${template.name}" in Mailbox von ${mojang.name} gelegt!` })
        setReceiverName('')
        load()
      }
    } catch (err) {
      setFormMsg({ type: 'err', text: 'Netzwerkfehler.' })
    } finally {
      setFormLoading(false)
    }
  }

  async function handleDeleteItem(id: number, name: string) {
    if (!confirm(`Item von ${name} löschen?`)) return
    await fetch('/api/admin2/mailbox', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    load()
  }

  async function handleDeleteTemplate(id: number, name: string) {
    if (!confirm(`Template "${name}" löschen?`)) return
    await fetch('/api/admin2/admin-items/templates', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    load()
  }

  const filtered = items.filter(i =>
    !filterPlayer || i.receiver_name.toLowerCase().includes(filterPlayer.toLowerCase())
  )

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

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: G.lightPurple, margin: 0 }}>📬 Mailbox</h1>
        <p style={{ color: G.muted, margin: '6px 0 0', fontSize: 14 }}>Items in Spieler-Mailboxen verwalten</p>
      </div>

      {/* Statistik */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ background: G.bg, border: `1px solid ${G.border}`, borderRadius: 10, padding: '14px 20px' }}>
          <div style={{ fontSize: 12, color: G.muted }}>Items gesamt</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: G.lightPurple }}>{items.length}</div>
        </div>
        <div style={{ background: G.bg, border: `1px solid ${G.border}`, borderRadius: 10, padding: '14px 20px' }}>
          <div style={{ fontSize: 12, color: G.muted }}>Spieler mit Items</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: G.gold }}>{Object.keys(perPlayer).length}</div>
        </div>
        <div style={{ background: G.bg, border: `1px solid ${G.border}`, borderRadius: 10, padding: '14px 20px' }}>
          <div style={{ fontSize: 12, color: G.muted }}>Gespeicherte Templates</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: G.green }}>{templates.length}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {(['uebersicht', 'senden', 'templates'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 18px', borderRadius: 8,
            border: `1px solid ${tab === t ? G.purple : G.border}`,
            background: tab === t ? G.purple : G.bg,
            color: tab === t ? '#fff' : G.muted,
            cursor: 'pointer', fontSize: 14, fontWeight: tab === t ? 600 : 400,
          }}>
            {t === 'uebersicht' ? '📋 Übersicht' : t === 'senden' ? '➕ Item senden' : '📦 Templates'}
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
          <input placeholder="Spieler filtern..." value={filterPlayer}
            onChange={e => setFilterPlayer(e.target.value)}
            style={{ ...inp, width: 220, marginBottom: 16 }} />
          {loading ? <div style={{ color: G.muted }}>Lade...</div> : (
            <div style={{ background: G.bg, border: `1px solid ${G.border}`, borderRadius: 12, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${G.border}` }}>
                    {['Empfänger', 'Von', 'Gesendet am', 'Aktionen'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: G.muted, fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={4} style={{ padding: 20, textAlign: 'center', color: G.muted }}>Keine Items.</td></tr>
                  ) : filtered.map(item => (
                    <tr key={item.id} style={{ borderBottom: `1px solid ${G.border}` }}>
                      <td style={{ padding: '10px 14px', color: G.text, fontWeight: 600 }}>{item.receiver_name}</td>
                      <td style={{ padding: '10px 14px', color: G.muted }}>{item.sender_name ?? '—'}</td>
                      <td style={{ padding: '10px 14px', color: G.muted }}>{new Date(item.sent_at).toLocaleString('de-DE')}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <button onClick={() => handleDeleteItem(item.id, item.receiver_name)} style={{
                          padding: '4px 10px', borderRadius: 6, fontSize: 12,
                          border: '1px solid rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.1)',
                          color: G.red, cursor: 'pointer',
                        }}>Löschen</button>
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
        <div style={{ background: G.bg, border: `1px solid ${G.border}`, borderRadius: 12, padding: 24, maxWidth: 480 }}>
          <h2 style={{ color: G.lightPurple, fontSize: 16, margin: '0 0 20px', fontWeight: 600 }}>Item in Mailbox legen</h2>

          {templates.length === 0 && (
            <div style={{ padding: '12px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13,
              background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', color: G.gold }}>
              ⚠ Noch keine Templates vorhanden. Nutze ingame <code>/uploaditem &lt;name&gt;</code> um Items hochzuladen.
            </div>
          )}

          <form onSubmit={handleSend}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', color: G.muted, fontSize: 12, marginBottom: 6 }}>Minecraft-Name *</label>
              <input value={receiverName} onChange={e => setReceiverName(e.target.value)}
                placeholder="uwuleonie" required style={inp} />
              <div style={{ fontSize: 11, color: G.muted, marginTop: 4 }}>UUID wird automatisch von Mojang abgerufen.</div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', color: G.muted, fontSize: 12, marginBottom: 6 }}>Item *</label>
              <select value={selectedTemplateId} onChange={e => setSelectedTemplateId(e.target.value)}
                required style={{ ...inp, background: '#1e1b2e' }}>
                <option value="">— Template wählen —</option>
                {templates.map(t => (
                  <option key={t.id} value={String(t.id)}>
                    {t.name} (hochgeladen von {t.uploaded_by})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', color: G.muted, fontSize: 12, marginBottom: 6 }}>Absender-Name</label>
              <input value={senderName} onChange={e => setSenderName(e.target.value)}
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

            <button type="submit" disabled={formLoading || templates.length === 0} style={{
              width: '100%', padding: '10px', borderRadius: 8, border: 'none',
              background: G.purple, color: '#fff', fontSize: 14, fontWeight: 600,
              cursor: formLoading ? 'not-allowed' : 'pointer', opacity: formLoading ? 0.7 : 1,
            }}>
              {formLoading ? 'Sende...' : '📬 In Mailbox legen'}
            </button>
          </form>
        </div>
      )}

      {/* ── Templates ─────────────────────────────────────────────────────────── */}
      {tab === 'templates' && (
        <>
          <p style={{ color: G.muted, fontSize: 13, marginBottom: 16 }}>
            Templates werden ingame mit <code style={{ color: G.lightPurple }}>/uploaditem &lt;name&gt;</code> hochgeladen.
            Das Item in der Hand wird als Base64 gespeichert und steht dann im "Item senden"-Tab zur Verfügung.
          </p>
          <div style={{ background: G.bg, border: `1px solid ${G.border}`, borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${G.border}` }}>
                  {['Name', 'Hochgeladen von', 'Datum', 'Aktionen'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: G.muted, fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {templates.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding: 20, textAlign: 'center', color: G.muted }}>Noch keine Templates.</td></tr>
                ) : templates.map(t => (
                  <tr key={t.id} style={{ borderBottom: `1px solid ${G.border}` }}>
                    <td style={{ padding: '10px 14px', color: G.text, fontWeight: 600 }}>{t.name}</td>
                    <td style={{ padding: '10px 14px', color: G.muted }}>{t.uploaded_by}</td>
                    <td style={{ padding: '10px 14px', color: G.muted }}>{new Date(t.uploaded_at).toLocaleString('de-DE')}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <button onClick={() => handleDeleteTemplate(t.id, t.name)} style={{
                        padding: '4px 10px', borderRadius: 6, fontSize: 12,
                        border: '1px solid rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.1)',
                        color: G.red, cursor: 'pointer',
                      }}>Löschen</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}