'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'

const SatelliteMap = dynamic(() => import('./SatelliteMap'), { ssr: false })

type Claim = {
  id: number
  owner_uuid: string
  owner_name: string
  world: string
  chunk_x: number
  chunk_z: number
}

type MapMode = 'schema' | 'satellite'
type ViewFilter = 'all' | 'mine' | 'unclaimed'

const CHUNK_SIZE = 24 // px pro Chunk bei Zoom 1

// Deterministische Farbe pro Spieler-Name (damit jeder Owner immer dieselbe Farbe hat)
const PALETTE = ['#7F77DD', '#1D9E75', '#D85A30', '#D4537E', '#378ADD', '#639922', '#EF9F27', '#534AB7']
function colorForOwner(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return PALETTE[hash % PALETTE.length]
}

export default function ClaimMap({ currentUuid }: { currentUuid?: string | null }) {
  const [mode, setMode] = useState<MapMode>('schema')
  const [showPlayers, setShowPlayers] = useState(true)
  const [filter, setFilter] = useState<ViewFilter>('all')
  const [claims, setClaims] = useState<Claim[]>([])
  const [loading, setLoading] = useState(true)
  const [hovered, setHovered] = useState<Claim | null>(null)
  const [selected, setSelected] = useState<Claim | null>(null)

  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const dragRef = useRef<{ startX: number, startY: number, origX: number, origY: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/smp/map').then(r => r.json()).then(data => {
      setClaims(data.claims || [])
      setLoading(false)
    })
  }, [])

  const visibleClaims = claims.filter(c => {
    if (filter === 'mine') return currentUuid && c.owner_uuid === currentUuid
    return true // 'all' und 'unclaimed' zeigen Claims gleich, unclaimed wird über Hintergrund kommuniziert
  })

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setZoom(z => Math.min(3, Math.max(0.3, z + delta)))
  }, [])

  const onMouseDown = (e: React.MouseEvent) => {
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: offset.x, origY: offset.y }
  }
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    setOffset({ x: dragRef.current.origX + dx, y: dragRef.current.origY + dy })
  }
  const onMouseUp = () => { dragRef.current = null }

  const resetView = () => { setZoom(1); setOffset({ x: 0, y: 0 }) }

  const size = CHUNK_SIZE * zoom

  return (
    <div className="card rounded-2xl p-5">
      {/* Header / Controls */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="font-bold" style={{ color: 'var(--foreground)' }}>Livemap</h2>

        <div className="flex items-center gap-2">
          {/* Schema/Satellit Toggle */}
          <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--card-border)' }}>
            <button onClick={() => setMode('schema')}
              className="px-3 py-1.5 text-xs font-medium transition-all"
              style={mode === 'schema' ? { background: '#16A34A', color: 'white' } : { background: 'var(--muted-bg)', color: 'var(--muted)' }}>
              Schema
            </button>
            <button onClick={() => setMode('satellite')}
              className="px-3 py-1.5 text-xs font-medium transition-all"
              style={mode === 'satellite' ? { background: '#16A34A', color: 'white' } : { background: 'var(--muted-bg)', color: 'var(--muted)' }}>
              Satellit
            </button>
          </div>
          {mode === 'satellite' && (
            <button onClick={() => setShowPlayers(p => !p)}
              className="px-3 py-1.5 text-xs font-medium rounded-xl transition-all"
              style={showPlayers ? { background: '#16A34A', color: 'white' } : { background: 'var(--muted-bg)', color: 'var(--muted)' }}>
              {showPlayers ? '👤 Spieler an' : '👤 Spieler aus'}
            </button>
          )}
        </div>
      </div>

      {mode === 'satellite' ? (
        <SatelliteMap claims={claims} showPlayers={showPlayers} myUuid={currentUuid} />
      ) : (
        <>
          {/* Filter */}
          <div className="flex items-center gap-2 mb-3">
            {[
              { id: 'all', label: 'Alle Claims' },
              { id: 'mine', label: 'Meine Claims' },
            ].map(f => (
              <button key={f.id} onClick={() => setFilter(f.id as ViewFilter)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={filter === f.id
                  ? { background: 'rgba(22,163,74,0.15)', border: '1px solid #16A34A', color: '#16A34A' }
                  : { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--muted)' }}>
                {f.label}
              </button>
            ))}
            <div className="flex-1" />
            <button onClick={resetView}
              className="px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--muted)' }}>
              Ansicht zurücksetzen
            </button>
          </div>

          {loading ? (
            <p className="text-sm py-12 text-center" style={{ color: 'var(--muted)' }}>Karte wird geladen...</p>
          ) : (
            <div
              ref={containerRef}
              onWheel={onWheel}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
              className="relative rounded-xl overflow-hidden select-none"
              style={{
                height: '420px',
                background: 'var(--muted-bg)',
                border: '1px solid var(--card-border)',
                cursor: dragRef.current ? 'grabbing' : 'grab',
              }}
            >
              <div
                className="absolute"
                style={{
                  left: '50%',
                  top: '50%',
                  transform: `translate(${offset.x}px, ${offset.y}px)`,
                }}
              >
                {/* Koordinaten-Gitter Hintergrund */}
                <svg
                  width={2000} height={2000}
                  style={{ position: 'absolute', left: -1000, top: -1000, opacity: 0.3 }}
                >
                  {Array.from({ length: 41 }).map((_, i) => (
                    <line key={`v${i}`} x1={i * size} y1={0} x2={i * size} y2={2000}
                      stroke="var(--card-border)" strokeWidth={1} />
                  ))}
                  {Array.from({ length: 41 }).map((_, i) => (
                    <line key={`h${i}`} x1={0} y1={i * size} x2={2000} y2={i * size}
                      stroke="var(--card-border)" strokeWidth={1} />
                  ))}
                </svg>

                {/* Ursprung-Marker (Spawn 0,0) */}
                <div className="absolute rounded-full"
                  style={{ left: -4, top: -4, width: 8, height: 8, background: '#D85A30' }}
                  title="Spawn (0, 0)" />

                {/* Claims */}
                {visibleClaims.map(c => {
                  const isMine = currentUuid && c.owner_uuid === currentUuid
                  const color = colorForOwner(c.owner_name)
                  return (
                    <div key={c.id}
                      onMouseEnter={() => setHovered(c)}
                      onMouseLeave={() => setHovered(null)}
                      onClick={() => setSelected(c)}
                      className="absolute cursor-pointer transition-all"
                      style={{
                        left: c.chunk_x * size,
                        top: c.chunk_z * size,
                        width: size,
                        height: size,
                        background: color + (isMine ? 'cc' : '88'),
                        border: isMine ? '2px solid white' : '1px solid rgba(255,255,255,0.3)',
                        boxSizing: 'border-box',
                      }}
                    />
                  )
                })}
              </div>

              {/* Hover Tooltip */}
              {hovered && (
                <div className="absolute top-3 left-3 px-3 py-2 rounded-lg text-xs pointer-events-none"
                  style={{ background: 'var(--card)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}>
                  <p className="font-bold">{hovered.owner_name}</p>
                  <p style={{ color: 'var(--muted)' }}>Chunk {hovered.chunk_x}, {hovered.chunk_z}</p>
                </div>
              )}

              {/* Zoom Controls */}
              <div className="absolute bottom-3 right-3 flex flex-col gap-1">
                <button onClick={() => setZoom(z => Math.min(3, z + 0.2))}
                  className="w-8 h-8 rounded-lg flex items-center justify-center font-bold"
                  style={{ background: 'var(--card)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}>+</button>
                <button onClick={() => setZoom(z => Math.max(0.3, z - 0.2))}
                  className="w-8 h-8 rounded-lg flex items-center justify-center font-bold"
                  style={{ background: 'var(--card)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}>−</button>
              </div>
            </div>
          )}

          {/* Ausgewählter Claim Info */}
          {selected && (
            <div className="mt-3 p-4 rounded-xl flex items-center justify-between" style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>
              <div className="flex items-center gap-3">
                <img src={`https://mc-heads.net/avatar/${selected.owner_name}/32`} alt="" className="w-8 h-8 rounded-lg" />
                <div>
                  <p className="font-medium text-sm" style={{ color: 'var(--foreground)' }}>{selected.owner_name}</p>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>Chunk {selected.chunk_x}, {selected.chunk_z} · {selected.world}</p>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-xs hover:opacity-70" style={{ color: 'var(--muted)' }}>Schließen</button>
            </div>
          )}

          <p className="text-xs mt-3" style={{ color: 'var(--muted)' }}>
            {visibleClaims.length} {visibleClaims.length === 1 ? 'Chunk' : 'Chunks'} geclaimt · Scrollen zum Zoomen, ziehen zum Verschieben
          </p>
        </>
      )}
    </div>
  )
}