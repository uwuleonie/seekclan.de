'use client'

import React, { useMemo, useState } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Runder K.O.-Baum (UCL + UWCL)
// Finale in der Mitte, jede Runde ein Ring weiter außen.
// Obere Hälfte = Baumhälfte 1, untere Hälfte = Baumhälfte 2.
// Aktuell nur Struktur mit Platzhaltern — Teams/Ergebnisse kommen später.
// ─────────────────────────────────────────────────────────────────────────────

type Comp = 'ucl' | 'uwcl'
type Level = 'final' | 'hf' | 'vf' | 'af' | 'entry' | 'po'

type BracketNode = {
  id: number
  lvl: Level
  label: string        // Kurztext im Feld
  title: string        // Überschrift im Infofeld
  desc: string         // Beschreibung im Infofeld
  r0: number
  r1: number
  a0: number
  a1: number
  parent: number | null
}

const SIZE = 680
const CX = SIZE / 2
const CY = SIZE / 2

const GOLD = '#c9a84c'
const GOLD_L = '#e8c96a'
const MUTED = 'rgba(180,210,255,0.5)'

// Grundfarbe pro Ring (UCL blau, UWCL lila) + Deckkraft
const RING_STYLE: Record<Comp, Record<Level, { fill: string; op: number }>> = {
  ucl: {
    final: { fill: GOLD, op: 0.35 },
    hf:    { fill: '#3d5afe', op: 0.42 },
    vf:    { fill: '#3d5afe', op: 0.32 },
    af:    { fill: '#3d5afe', op: 0.24 },
    entry: { fill: '#0099ff', op: 0.16 },
    po:    { fill: '#94a3b8', op: 0.12 },
  },
  uwcl: {
    final: { fill: GOLD, op: 0.35 },
    hf:    { fill: '#9c27b0', op: 0.42 },
    vf:    { fill: '#9c27b0', op: 0.30 },
    af:    { fill: '#9c27b0', op: 0.22 },
    entry: { fill: '#ce93d8', op: 0.16 },
    po:    { fill: '#94a3b8', op: 0.12 },
  },
}

const LEVEL_NAME: Record<Level, string> = {
  final: 'Finale',
  hf: 'Halbfinale',
  vf: 'Viertelfinale',
  af: 'Achtelfinale',
  entry: 'Teilnehmer',
  po: 'Playoff-Team',
}

function pt(r: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)]
}

function sectorPath(r0: number, r1: number, a0: number, a1: number) {
  const gap = 0.7
  const s = a0 + gap, e = a1 - gap
  const large = e - s > 180 ? 1 : 0
  const [x0, y0] = pt(r1, s)
  const [x1, y1] = pt(r1, e)
  const [x2, y2] = pt(r0, e)
  const [x3, y3] = pt(r0, s)
  return `M${x0} ${y0}A${r1} ${r1} 0 ${large} 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 ${large} 0 ${x3} ${y3}Z`
}

function buildNodes(comp: Comp): BracketNode[] {
  const nodes: BracketNode[] = []
  const add = (n: Omit<BracketNode, 'id'>) => {
    const node = { ...n, id: nodes.length }
    nodes.push(node)
    return node
  }

  const final = add({
    lvl: 'final', label: 'Finale', title: 'Finale',
    desc: 'Sieger Halbfinale 1 vs Sieger Halbfinale 2 · ein Spiel',
    r0: 0, r1: comp === 'ucl' ? 58 : 66, a0: 0, a1: 360, parent: null,
  })

  if (comp === 'ucl') {
    // Radien: HF, VF, AF, Teilnehmer AF, Playoff-Teams
    const R = [[62, 104], [108, 150], [154, 196], [200, 246], [250, 306]]
    // Feste Baumstruktur je Hälfte (Quelle: UEFA-Bracket seit 2024/25)
    const SEC: Record<string, { seed: string; po: string; hi: string; lo: string }> = {
      A: { seed: '1/2', po: 'IV',  hi: '15/16', lo: '17/18' },
      D: { seed: '7/8', po: 'I',   hi: '9/10',  lo: '23/24' },
      B: { seed: '3/4', po: 'III', hi: '13/14', lo: '19/20' },
      C: { seed: '5/6', po: 'II',  hi: '11/12', lo: '21/22' },
    }
    for (const h of [0, 1]) {
      const base = h * 180
      const hf = add({
        lvl: 'hf', label: `HF ${h + 1}`, title: `Halbfinale ${h + 1}`,
        desc: `Sieger VF ${h * 2 + 1} vs Sieger VF ${h * 2 + 2}`,
        r0: R[0][0], r1: R[0][1], a0: base, a1: base + 180, parent: final.id,
      })
      const qfDef: [string, string][] = [['A', 'D'], ['B', 'C']]
      qfDef.forEach((pair, qi) => {
        const qa = base + qi * 90
        const vfNum = h * 2 + qi + 1
        const afNums = pair.map((_, ki) => h * 4 + qi * 2 + ki + 1)
        const vf = add({
          lvl: 'vf', label: `VF ${vfNum}`, title: `Viertelfinale ${vfNum}`,
          desc: `Sieger AF ${afNums[0]} vs Sieger AF ${afNums[1]}`,
          r0: R[1][0], r1: R[1][1], a0: qa, a1: qa + 90, parent: hf.id,
        })
        pair.forEach((key, ki) => {
          const s = SEC[key]
          const aa = qa + ki * 45
          const afNum = afNums[ki]
          const poNum = h * 4 + ({ IV: 1, I: 2, III: 3, II: 4 } as Record<string, number>)[s.po]
          const af = add({
            lvl: 'af', label: `AF ${afNum}`, title: `Achtelfinale ${afNum}`,
            desc: `Platz ${s.seed} (gesetzt) vs Sieger Playoff ${poNum}`,
            r0: R[2][0], r1: R[2][1], a0: aa, a1: aa + 45, parent: vf.id,
          })
          add({
            lvl: 'entry', label: s.seed, title: `Platz ${s.seed}`,
            desc: `Direkt qualifiziert über die Ligaphase. Eines der beiden Teams steht in dieser Hälfte, das andere in der anderen — per Auslosung.`,
            r0: R[3][0], r1: R[3][1], a0: aa, a1: aa + 22.5, parent: af.id,
          })
          const w = add({
            lvl: 'entry', label: `PO ${poNum}`, title: `Sieger Playoff ${poNum}`,
            desc: `Platz ${s.hi} (gesetzt) vs Platz ${s.lo} · Hin- und Rückspiel`,
            r0: R[3][0], r1: R[3][1], a0: aa + 22.5, a1: aa + 45, parent: af.id,
          })
          add({
            lvl: 'po', label: s.hi, title: `Platz ${s.hi}`,
            desc: 'Gesetzt in den Playoffs, Rückspiel zu Hause',
            r0: R[4][0], r1: R[4][1], a0: aa + 22.5, a1: aa + 33.75, parent: w.id,
          })
          add({
            lvl: 'po', label: s.lo, title: `Platz ${s.lo}`,
            desc: 'Ungesetzt in den Playoffs',
            r0: R[4][0], r1: R[4][1], a0: aa + 33.75, a1: aa + 45, parent: w.id,
          })
        })
      })
    }
  } else {
    // Radien: HF, VF, Teilnehmer VF, Playoff-Teams
    const R = [[70, 124], [128, 182], [186, 244], [248, 306]]
    // Zuordnung wie 2025/26 (Plätze 1–4 direkt ins VF, 5–12 Playoffs)
    const QDEF: { seed: string; hi: string; lo: string }[] = [
      { seed: '1/2', hi: '7/8', lo: '9/10' },
      { seed: '3/4', hi: '5/6', lo: '11/12' },
    ]
    for (const h of [0, 1]) {
      const base = h * 180
      const hf = add({
        lvl: 'hf', label: `HF ${h + 1}`, title: `Halbfinale ${h + 1}`,
        desc: `Sieger VF ${h * 2 + 1} vs Sieger VF ${h * 2 + 2}`,
        r0: R[0][0], r1: R[0][1], a0: base, a1: base + 180, parent: final.id,
      })
      QDEF.forEach((q, qi) => {
        const qa = base + qi * 90
        const vfNum = h * 2 + qi + 1
        const vf = add({
          lvl: 'vf', label: `VF ${vfNum}`, title: `Viertelfinale ${vfNum}`,
          desc: `Platz ${q.seed} (gesetzt) vs Sieger Playoff ${vfNum}`,
          r0: R[1][0], r1: R[1][1], a0: qa, a1: qa + 90, parent: hf.id,
        })
        add({
          lvl: 'entry', label: q.seed, title: `Platz ${q.seed}`,
          desc: 'Direkt qualifiziert über die Ligaphase. Eines der beiden Teams steht in dieser Hälfte, das andere in der anderen — per Auslosung.',
          r0: R[2][0], r1: R[2][1], a0: qa, a1: qa + 45, parent: vf.id,
        })
        const w = add({
          lvl: 'entry', label: `PO ${vfNum}`, title: `Sieger Playoff ${vfNum}`,
          desc: `Platz ${q.hi} (gesetzt) vs Platz ${q.lo} · Hin- und Rückspiel`,
          r0: R[2][0], r1: R[2][1], a0: qa + 45, a1: qa + 90, parent: vf.id,
        })
        add({
          lvl: 'po', label: q.hi, title: `Platz ${q.hi}`,
          desc: 'Gesetzt in den Playoffs, Rückspiel zu Hause',
          r0: R[3][0], r1: R[3][1], a0: qa + 45, a1: qa + 67.5, parent: w.id,
        })
        add({
          lvl: 'po', label: q.lo, title: `Platz ${q.lo}`,
          desc: 'Ungesetzt in den Playoffs',
          r0: R[3][0], r1: R[3][1], a0: qa + 67.5, a1: qa + 90, parent: w.id,
        })
      })
    }
  }
  return nodes
}

export default function UCLKOBracket({ defaultComp = 'ucl' }: { defaultComp?: Comp }) {
  const [comp, setComp] = useState<Comp>(defaultComp)
  const [hover, setHover] = useState<number | null>(null)
  const [selected, setSelected] = useState<number | null>(null)

  const nodes = useMemo(() => buildNodes(comp), [comp])

  const chainOf = (id: number | null): Set<number> => {
    const s = new Set<number>()
    let cur = id === null ? null : nodes[id]
    while (cur) {
      s.add(cur.id)
      cur = cur.parent === null ? null : nodes[cur.parent]
    }
    return s
  }

  const activeId = hover ?? selected
  const chain = chainOf(activeId)
  const sel = selected !== null ? nodes[selected] : null
  const selPath = sel ? [...chainOf(sel.id)].map(i => nodes[i]).reverse().map(n => n.label).join(' → ') : ''

  const switchComp = (c: Comp) => { setComp(c); setHover(null); setSelected(null) }

  const levels: Level[] = comp === 'ucl' ? ['final', 'hf', 'vf', 'af', 'entry', 'po'] : ['final', 'hf', 'vf', 'entry', 'po']

  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      {/* Kopf */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 4 }}>
          {(['ucl', 'uwcl'] as const).map(c => (
            <button key={c} onClick={() => switchComp(c)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                background: comp === c ? (c === 'ucl' ? 'linear-gradient(135deg,#1a237e,#3d5afe)' : 'linear-gradient(135deg,#6a1a6a,#9c27b0)') : 'transparent',
                color: comp === c ? '#fff' : MUTED }}>
              <img src={c === 'ucl' ? '/ucl-badge.png' : '/uwcl-badge.png'} alt="" style={{ width: 18, height: 18, objectFit: 'contain', filter: comp === c ? 'invert(1)' : 'invert(1) brightness(0.6)' }} />
              {c.toUpperCase()}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 12, color: MUTED }}>Fahre über ein Feld für den Weg ins Finale · Klick für Details</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 16 }}>
        {/* Kreis */}
        <div style={{ position: 'relative', borderRadius: 24, background: 'radial-gradient(circle at center, rgba(201,168,76,0.08) 0%, rgba(5,15,60,0.35) 55%, rgba(5,15,60,0.15) 100%)', border: '1px solid rgba(255,255,255,0.08)', padding: 12 }}>
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" style={{ display: 'block', maxWidth: 680, margin: '0 auto', touchAction: 'manipulation' }}
            onMouseLeave={() => setHover(null)} role="img" aria-label={`K.O.-Baum ${comp.toUpperCase()}`}>
            {/* Trennlinie der Hälften */}
            <line x1={CX} y1={CY - 306} x2={CX} y2={CY - (comp === 'ucl' ? 60 : 68)} stroke="rgba(255,255,255,0.12)" strokeWidth={1} strokeDasharray="3 5" />
            <line x1={CX} y1={CY + (comp === 'ucl' ? 60 : 68)} x2={CX} y2={CY + 306} stroke="rgba(255,255,255,0.12)" strokeWidth={1} strokeDasharray="3 5" />

            {nodes.map(n => {
              const st = RING_STYLE[comp][n.lvl]
              const inChain = chain.has(n.id)
              const dimmed = activeId !== null && !inChain
              const fill = inChain && n.lvl !== 'final' ? GOLD : st.fill
              const op = inChain ? (n.lvl === 'final' ? 0.6 : 0.5) : dimmed ? st.op * 0.35 : st.op
              const stroke = inChain ? GOLD_L : 'rgba(255,255,255,0.14)'
              const handlers = {
                onMouseEnter: () => setHover(n.id),
                onClick: () => setSelected(s => s === n.id ? null : n.id),
                style: { cursor: 'pointer', transition: 'fill-opacity 0.15s, fill 0.15s' } as React.CSSProperties,
              }
              if (n.lvl === 'final') {
                return (
                  <g key={n.id}>
                    <circle cx={CX} cy={CY} r={n.r1} fill={GOLD} fillOpacity={op} stroke={GOLD_L} strokeWidth={inChain ? 2 : 1} {...handlers} />
                    {/* Pokal */}
                    <g transform={`translate(${CX - 14} ${CY - 30}) scale(1.15)`} style={{ pointerEvents: 'none' }}>
                      <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V17H9v2h6v-2h-2v-2.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 11.63 21 9.55 21 7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z" fill={GOLD_L} />
                    </g>
                    <text x={CX} y={CY + 18} textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight={800} fill="#fff" style={{ pointerEvents: 'none', letterSpacing: '0.08em' }}>FINALE</text>
                  </g>
                )
              }
              const mid = (n.a0 + n.a1) / 2
              const rMid = (n.r0 + n.r1) / 2
              const [tx, ty] = pt(rMid, mid)
              const small = n.lvl === 'po' || (comp === 'ucl' && n.lvl === 'entry')
              return (
                <g key={n.id}>
                  <path d={sectorPath(n.r0, n.r1, n.a0, n.a1)} fill={fill} fillOpacity={op} stroke={stroke} strokeWidth={inChain ? 1.4 : 0.8} {...handlers} />
                  <text x={tx} y={ty} textAnchor="middle" dominantBaseline="central"
                    fontSize={n.lvl === 'hf' ? 14 : small ? 11 : 12} fontWeight={n.lvl === 'hf' || n.lvl === 'vf' ? 800 : 600}
                    fill={inChain ? '#fff' : dimmed ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.85)'}
                    style={{ pointerEvents: 'none' }}>
                    {n.label}
                  </text>
                </g>
              )
            })}

            {/* Hälften-Beschriftung */}
            <text x={CX + 318} y={CY - 318} textAnchor="end" fontSize={11} fontWeight={700} fill={MUTED} style={{ letterSpacing: '0.12em' }}>HÄLFTE 1</text>
            <text x={CX - 318} y={CY + 326} textAnchor="start" fontSize={11} fontWeight={700} fill={MUTED} style={{ letterSpacing: '0.12em' }}>HÄLFTE 2</text>
          </svg>
        </div>

        {/* Infofeld */}
        <div style={{ borderRadius: 16, background: 'rgba(5,15,60,0.45)', border: `1px solid ${sel ? 'rgba(201,168,76,0.35)' : 'rgba(255,255,255,0.08)'}`, padding: '14px 18px', minHeight: 64 }}>
          {sel ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: 'rgba(201,168,76,0.18)', color: GOLD, letterSpacing: '0.08em' }}>{LEVEL_NAME[sel.lvl].toUpperCase()}</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>{sel.title}</span>
                <span style={{ flex: 1 }} />
                <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: MUTED, fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>×</button>
              </div>
              <p style={{ margin: '0 0 8px', fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5 }}>{sel.desc}</p>
              <p style={{ margin: 0, fontSize: 11, color: MUTED }}>Weg: <span style={{ color: GOLD_L, fontWeight: 700 }}>{selPath}</span></p>
              <p style={{ margin: '8px 0 0', fontSize: 11, color: MUTED, fontStyle: 'italic' }}>Noch nicht ausgelost — Teams und Ergebnisse folgen nach der Ligaphase.</p>
            </>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: MUTED }}>
              {comp === 'ucl'
                ? 'Plätze 1–8 direkt ins Achtelfinale · Plätze 9–24 in die Playoffs · Viertel- und Halbfinale stehen durch den Baum fest.'
                : 'Plätze 1–4 direkt ins Viertelfinale · Plätze 5–12 in die Playoffs · Plätze 13–18 scheiden aus.'}
            </p>
          )}
        </div>

        {/* Legende */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'center' }}>
          {levels.map(l => (
            <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: MUTED }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: RING_STYLE[comp][l].fill, opacity: Math.min(1, RING_STYLE[comp][l].op * 2.2) }} />
              {l === 'entry' ? (comp === 'ucl' ? 'Teilnehmer AF' : 'Teilnehmer VF') : l === 'po' ? 'Playoff-Teams' : LEVEL_NAME[l]}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}