'use client'

import { useEffect, useState } from 'react'

type Rule = {
  id: number
  sort_order: number
  category: string
  title: string
  content: string
  updated_at: string
}

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/rules')
      .then(r => r.json())
      .then(d => { setRules(d.rules || []); setLoading(false) })
  }, [])

  // Group by category
  const grouped = rules.reduce((acc, rule) => {
    if (!acc[rule.category]) acc[rule.category] = []
    acc[rule.category].push(rule)
    return acc
  }, {} as Record<string, Rule[]>)

  const categories = Object.keys(grouped)

  const lastUpdated = rules.length > 0
    ? new Date(Math.max(...rules.map(r => new Date(r.updated_at).getTime())))
    : null

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <div className="max-w-3xl mx-auto px-6 py-16">

        {/* Header */}
        <div className="mb-12">
          <p style={{ fontSize: '11px', letterSpacing: '0.15em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '12px' }}>
            seekclan.de
          </p>
          <h1 style={{
            fontFamily: '"Playfair Display", Georgia, serif',
            fontSize: '42px',
            fontWeight: 700,
            background: 'linear-gradient(135deg, #4F46E5, #7C3AED, #C026D3)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            marginBottom: '12px',
            lineHeight: 1.2,
          }}>
            Regelwerk
          </h1>
          {lastUpdated && (
            <p style={{ fontSize: '12px', color: 'var(--muted)' }}>
              Zuletzt aktualisiert: {lastUpdated.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          )}
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ height: '80px', borderRadius: '16px', background: 'var(--card)', opacity: 0.5 }} />
            ))}
          </div>
        ) : rules.length === 0 ? (
          <div style={{
            background: 'var(--card)', border: '1px solid var(--card-border)',
            borderRadius: '20px', padding: '48px', textAlign: 'center',
          }}>
            <p style={{ fontSize: '32px', marginBottom: '12px' }}>📋</p>
            <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Das Regelwerk wird noch vorbereitet.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
            {categories.map(category => (
              <div key={category}>
                {/* Category header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <h2 style={{
                    fontSize: '11px', fontWeight: 700, letterSpacing: '0.15em',
                    textTransform: 'uppercase', color: 'var(--muted)',
                  }}>
                    {category}
                  </h2>
                  <div style={{ flex: 1, height: '1px', background: 'var(--card-border)' }} />
                </div>

                {/* Rules */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {grouped[category].map((rule, idx) => (
                    <div key={rule.id} style={{
                      background: 'var(--card)',
                      border: '1px solid var(--card-border)',
                      borderRadius: '16px',
                      padding: '20px 24px',
                      display: 'flex',
                      gap: '16px',
                    }}>
                      {/* Number */}
                      <div style={{
                        flexShrink: 0,
                        width: '32px', height: '32px',
                        borderRadius: '10px',
                        background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '12px', fontWeight: 700, color: 'white',
                        marginTop: '2px',
                      }}>
                        {idx + 1}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 600, color: 'var(--foreground)', marginBottom: '6px', fontSize: '15px' }}>
                          {rule.title}
                        </p>
                        <p style={{
                          color: 'var(--muted)', fontSize: '14px', lineHeight: 1.6,
                          whiteSpace: 'pre-wrap',
                        }}>
                          {rule.content}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer note */}
        <p style={{ marginTop: '48px', fontSize: '12px', color: 'var(--muted)', textAlign: 'center' }}>
          Bei Fragen oder Unklarheiten wende dich an das Team.
        </p>
      </div>
    </div>
  )
}