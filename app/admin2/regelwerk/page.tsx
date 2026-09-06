'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '../../lib/auth-context'

type Rule = {
  id: number
  sort_order: number
  category: string
  title: string
  content: string
  updated_at: string
}

const EMPTY_FORM = { category: 'Allgemein', title: '', content: '', sort_order: 0 }

export default function AdminRegelwerkPage() {
  const { user } = useAuth()
  const [rules, setRules] = useState<Rule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // Form state
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/admin2/rules')
    const data = await res.json()
    setRules(data.rules || [])
    setLoading(false)
  }

  useEffect(() => { if (user) load() }, [user])

  const openCreate = () => {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setShowForm(true)
    setError('')
  }

  const openEdit = (rule: Rule) => {
    setForm({ category: rule.category, title: rule.title, content: rule.content, sort_order: rule.sort_order })
    setEditingId(rule.id)
    setShowForm(true)
    setError('')
  }

  const save = async () => {
    if (!form.title.trim() || !form.content.trim()) { setError('Titel und Inhalt erforderlich'); return }
    setSaving(true); setError('')
    const res = await fetch('/api/admin2/rules', {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, ...(editingId ? { id: editingId } : {}) }),
    })
    if (res.ok) {
      setShowForm(false)
      setEditingId(null)
      setForm(EMPTY_FORM)
      await load()
    } else {
      const d = await res.json()
      setError(d.error || 'Fehler beim Speichern')
    }
    setSaving(false)
  }

  const deleteRule = async (id: number) => {
    if (!confirm('Regel wirklich löschen?')) return
    await fetch('/api/admin2/rules', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    await load()
  }

  const grouped = rules.reduce((acc, rule) => {
    if (!acc[rule.category]) acc[rule.category] = []
    acc[rule.category].push(rule)
    return acc
  }, {} as Record<string, Rule[]>)

  const inputStyle = {
    width: '100%', padding: '10px 14px',
    background: 'var(--muted-bg)', border: '1px solid var(--card-border)',
    borderRadius: '10px', color: 'var(--foreground)',
    fontFamily: 'inherit', fontSize: '14px',
    outline: 'none', boxSizing: 'border-box' as const,
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Regelwerk</h1>
          <p style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '4px' }}>
            Öffentlich sichtbar unter{' '}
            <a href="/rules" target="_blank" style={{ color: 'var(--accent, #7C3AED)', textDecoration: 'underline' }}>
              seekclan.de/rules
            </a>
          </p>
        </div>
        <button
          onClick={openCreate}
          className="btn-gradient text-white px-5 py-2.5 rounded-xl font-semibold text-sm"
        >
          + Regel hinzufügen
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px',
        }}>
          <div style={{
            background: 'var(--card)', border: '1px solid var(--card-border)',
            borderRadius: '20px', padding: '28px',
            width: '100%', maxWidth: '560px',
            display: 'flex', flexDirection: 'column', gap: '16px',
          }}>
            <div className="flex items-center justify-between">
              <h2 style={{ fontWeight: 700, color: 'var(--foreground)', fontSize: '16px' }}>
                {editingId ? 'Regel bearbeiten' : 'Neue Regel'}
              </h2>
              <button onClick={() => setShowForm(false)} style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px' }}>×</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Kategorie</label>
                <input style={inputStyle} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="z.B. Allgemein, Chat, SMP" />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Reihenfolge</label>
                <input style={inputStyle} type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Titel</label>
              <input style={inputStyle} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Regelbezeichnung" />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Inhalt</label>
              <textarea
                style={{ ...inputStyle, minHeight: '120px', resize: 'vertical', lineHeight: 1.6 }}
                value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                placeholder="Beschreibung der Regel..."
              />
            </div>

            {error && <p style={{ color: '#ef4444', fontSize: '13px' }}>{error}</p>}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowForm(false)} style={{
                padding: '10px 20px', borderRadius: '12px', border: '1px solid var(--card-border)',
                background: 'var(--muted-bg)', color: 'var(--muted)', cursor: 'pointer', fontSize: '13px',
              }}>Abbrechen</button>
              <button onClick={save} disabled={saving} className="btn-gradient text-white px-5 py-2.5 rounded-xl font-semibold text-sm" style={{ opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Speichern...' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rules list */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[1, 2, 3].map(i => <div key={i} style={{ height: '64px', borderRadius: '14px', background: 'var(--card)', opacity: 0.5 }} />)}
        </div>
      ) : rules.length === 0 ? (
        <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: '20px', padding: '48px', textAlign: 'center' }}>
          <p style={{ fontSize: '28px', marginBottom: '10px' }}>📋</p>
          <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Noch keine Regeln vorhanden.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {Object.keys(grouped).map(category => (
            <div key={category}>
              <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '12px' }}>
                {category}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {grouped[category].map(rule => (
                  <div key={rule.id} style={{
                    background: 'var(--card)', border: '1px solid var(--card-border)',
                    borderRadius: '14px', padding: '16px 20px',
                    display: 'flex', alignItems: 'flex-start', gap: '16px',
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '10px', color: 'var(--muted)' }}>#{rule.sort_order}</span>
                        <p style={{ fontWeight: 600, color: 'var(--foreground)', fontSize: '14px' }}>{rule.title}</p>
                      </div>
                      <p style={{ color: 'var(--muted)', fontSize: '13px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{rule.content}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                      <button onClick={() => openEdit(rule)} style={{
                        padding: '6px 14px', borderRadius: '10px', border: '1px solid var(--card-border)',
                        background: 'var(--muted-bg)', color: 'var(--muted)', cursor: 'pointer', fontSize: '12px',
                      }}>✏️ Bearbeiten</button>
                      <button onClick={() => deleteRule(rule.id)} style={{
                        padding: '6px 14px', borderRadius: '10px', border: '1px solid rgba(239,68,68,0.3)',
                        background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer', fontSize: '12px',
                      }}>🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}