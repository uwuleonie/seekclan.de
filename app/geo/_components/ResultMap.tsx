'use client'

// Kleine Karte für ein geteiltes Ergebnis: richtig = grün, Fehler = rot, Rest grau.

import { useEffect, useState } from 'react'
import { buildScene, mergeQuizzes, type Scene } from '../_lib/scene'
import { needsItems, resolveDefs } from '../_lib/items'
import type { QuizDef } from '../_lib/types'

export default function ResultMap({ defs, solved, mistakes }: { defs: QuizDef[]; solved: string[]; mistakes: string[] }) {
  const [scene, setScene] = useState<Scene | null>(null)
  const [err, setErr] = useState(false)
  useEffect(() => {
    let alive = true
    ;(async () => {
      const ds = needsItems(defs) ? await resolveDefs(defs) : defs
      const sc = await buildScene(mergeQuizzes(ds))
      if (alive) setScene(sc)
    })().catch(() => { if (alive) setErr(true) })
    return () => { alive = false }
  }, [defs])
  if (err) return null
  if (!scene) return <div className="ga-map-loading">Karte wird gezeichnet …</div>

  const ok = new Set(solved), bad = new Set(mistakes)
  const stateOfShape = new Map<string, 'ok' | 'bad' | 'open'>()
  for (const it of scene.items) {
    const st = bad.has(it.key) && !ok.has(it.key) ? 'bad' : ok.has(it.key) ? (bad.has(it.key) ? 'late' : 'ok') : 'open'
    for (const a of it.areas ?? []) if (!stateOfShape.has(a)) stateOfShape.set(a, st === 'late' ? 'bad' : st as 'ok' | 'bad' | 'open')
  }
  const vb = scene.viewBox
  const r = Math.max(vb.w, vb.h) / 160
  return (
    <svg className="ga-result-map" viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} role="img" aria-label="Ergebnis auf der Karte">
      {scene.context.map(c => <path key={c.key} d={c.d} className="ctx" />)}
      {scene.shapes.map(s => <path key={s.key} d={s.d} className={`a ${stateOfShape.get(s.key) ?? 'none'} ${s.look === 'line' ? 'line' : ''}`} />)}
      {scene.items.filter(i => i.pt).map(i => (
        <circle key={i.key} cx={i.pt![0]} cy={i.pt![1]} r={r} className={`p ${bad.has(i.key) ? 'bad' : ok.has(i.key) ? 'ok' : 'open'}`} />
      ))}
    </svg>
  )
}