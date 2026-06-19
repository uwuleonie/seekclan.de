'use client'

import { useState, useEffect } from 'react'

type Rule = {
  id: number
  category: string
  title: string
  content: string
  sort_order: number
}

export default function RegelwerkPage() {
  const [rules, setRules] = useState<Rule[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/smp/rules').then(r => r.json()).then(data => {
      setRules(data.rules || [])
      setLoading(false)
    })
  }, [])

  const rulesByCategory = rules.reduce((acc, rule) => {
    if (!acc[rule.category]) acc[rule.category] = []
    acc[rule.category].push(rule)
    return acc
  }, {} as Record<string, Rule[]>)

  if (loading) return <p style={{ color: 'var(--muted)' }}>Laden...</p>

  return (
    <div className="space-y-6">
      {Object.keys(rulesByCategory).length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>Noch keine Regeln vorhanden.</p>
      ) : (
        Object.entries(rulesByCategory).map(([category, categoryRules]) => (
          <div key={category} className="card rounded-2xl p-6">
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
              <span className="px-2 py-0.5 rounded-lg text-xs text-white" style={{ background: '#16A34A' }}>{category}</span>
            </h2>
            <div className="space-y-4">
              {categoryRules.map(rule => (
                <div key={rule.id}>
                  <p className="font-medium mb-1" style={{ color: 'var(--foreground)' }}>{rule.title}</p>
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>{rule.content}</p>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
