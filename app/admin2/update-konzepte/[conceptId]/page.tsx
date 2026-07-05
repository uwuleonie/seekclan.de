'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'

type Output = { id: string, node_id: string, label: string, sort_order: number }
type Node = {
  id: string, title: string, description: string, status: 'offen' | 'in_arbeit' | 'fertig',
  position_x: number, position_y: number, outputs: Output[]
}
type Edge = { id: string, source_output_id: string, target_node_id: string }
type Tag = { id: string, name: string, color: string }
type Concept = {
  id: string, title: string, nodes: Node[], edges: Edge[],
  ownerId: string | null, ownerUsername: string | null, canEdit: boolean, hasPendingRequest: boolean,
  isTextOnly: boolean, contentText: string, isFinished: boolean, tags: Tag[]
}

const STATUS_STYLE: Record<string, { label: string, color: string }> = {
  offen: { label: 'Offen', color: '#6B7280' },
  in_arbeit: { label: 'In Arbeit', color: '#EAB308' },
  fertig: { label: 'Fertig', color: '#A855F7' },
}

// Separate Farb-Zuordnung nur für die Verbindungslinien (nicht identisch mit
// STATUS_STYLE, das für die Node-Kacheln selbst gilt) - hier explizit
// grün/gelb/rot wie gewünscht, unabhängig von der Akzentfarbe der Kacheln.
const EDGE_STATUS_COLOR: Record<string, string> = {
  fertig: '#22C55E',
  in_arbeit: '#EAB308',
  offen: '#EF4444',
}

const NODE_WIDTH = 220

export default function ConceptEditorPage() {
  const params = useParams()
  const conceptId = params.conceptId as string

  const [concept, setConcept] = useState<Concept | null>(null)
  const [loading, setLoading] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)

  // Pan/Zoom-Zustand des Canvas selbst
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [panning, setPanning] = useState(false)
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 })

  // Zoom per Mausrad, skaliert um die aktuelle Mausposition herum, damit man
  // "auf einen Punkt zoomt" statt dass sich alles unter der Maus wegbewegt.
  // Bewusst großzügiger Bereich (0.1x bis 2.5x), damit man wirklich weit
  // rauszoomen und viel Platz für große Konzepte haben kann.
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const newZoom = Math.min(2.5, Math.max(0.1, zoom * delta))
    // Weltkoordinate unter der Maus vor dem Zoom
    const worldX = (mouseX - pan.x) / zoom
    const worldY = (mouseY - pan.y) / zoom
    setZoom(newZoom)
    setPan({ x: mouseX - worldX * newZoom, y: mouseY - worldY * newZoom })
  }

  // Node-Drag-Zustand
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null)
  const dragOffset = useRef({ x: 0, y: 0 })

  // Verbindung-ziehen-Zustand: von welchem Output aus wird gerade gezogen
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [addingOutputFor, setAddingOutputFor] = useState<string | null>(null)
  const [newOutputLabel, setNewOutputLabel] = useState('')

  const load = useCallback(() => {
    fetch(`/api/admin2/concepts/${conceptId}`)
      .then(r => r.json())
      .then(data => setConcept(data.concept || null))
      .finally(() => setLoading(false))
  }, [conceptId])

  useEffect(() => { load() }, [load])

  // Öffnet das Text-Formular automatisch, wenn man über den "📝 Als Text
  // schreiben"-Link auf der Übersichtsseite (bei einem noch leeren Konzept)
  // hierher gelangt ist.
  const searchParams = useSearchParams()
  useEffect(() => {
    if (searchParams.get('text') === '1') setShowTextForm(true)
  }, [searchParams])

  const claim = async () => {
    const res = await fetch(`/api/admin2/concepts/${conceptId}/claim`, { method: 'POST' })
    if (res.ok) load()
  }

  const requestAccess = async () => {
    await fetch(`/api/admin2/concepts/${conceptId}/access-requests`, { method: 'POST' })
    load()
  }

  const patchConcept = async (patch: Record<string, unknown>) => {
    await fetch(`/api/admin2/concepts/${conceptId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
  }

  const switchMode = async () => {
    if (!concept) return
    const goingToText = !concept.isTextOnly
    const msg = goingToText
      ? 'Zu Text-Modus wechseln? Die Bausteine bleiben erhalten, werden aber ausgeblendet, bis du zurückwechselst.'
      : 'Zu Baustein-Modus wechseln? Der Text bleibt erhalten, wird aber ausgeblendet, bis du zurückwechselst.'
    if (!confirm(msg)) return
    await patchConcept({ isTextOnly: goingToText })
    load()
  }

  const toggleFinished = async () => {
    if (!concept) return
    await patchConcept({ isFinished: !concept.isFinished })
    load()
  }

  const assignTag = async (tagId: string) => {
    await fetch(`/api/admin2/concepts/${conceptId}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tagId }),
    })
    load()
  }

  const unassignTag = async (tagId: string) => {
    await fetch(`/api/admin2/concepts/${conceptId}/tags/${tagId}`, { method: 'DELETE' })
    load()
  }

  // --- Text-Konzept-Inhalt (is_text_only Modus) ---
  const [textContent, setTextContent] = useState('')
  const [textSaving, setTextSaving] = useState(false)
  const [textSavedAt, setTextSavedAt] = useState<number | null>(null)
  useEffect(() => {
    if (concept?.isTextOnly) setTextContent(concept.contentText || '')
  }, [concept?.id, concept?.isTextOnly])

  const saveTextContent = async () => {
    setTextSaving(true)
    await patchConcept({ contentText: textContent })
    setTextSaving(false)
    setTextSavedAt(Date.now())
  }

  // --- Canvas Pan ---
  const onCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target !== containerRef.current) return
    setPanning(true)
    panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y }
    setSelectedNodeId(null)
  }

  const onMouseMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (rect) setMousePos({ x: (e.clientX - rect.left - pan.x) / zoom, y: (e.clientY - rect.top - pan.y) / zoom })

    if (panning) {
      setPan({ x: panStart.current.panX + (e.clientX - panStart.current.x), y: panStart.current.panY + (e.clientY - panStart.current.y) })
    }
    if (draggingNodeId && concept) {
      const rect2 = containerRef.current?.getBoundingClientRect()
      if (!rect2) return
      const x = (e.clientX - rect2.left - pan.x) / zoom - dragOffset.current.x
      const y = (e.clientY - rect2.top - pan.y) / zoom - dragOffset.current.y
      setConcept({ ...concept, nodes: concept.nodes.map(n => n.id === draggingNodeId ? { ...n, position_x: x, position_y: y } : n) })
    }
  }

  const onMouseUp = async () => {
    setPanning(false)
    if (draggingNodeId && concept) {
      const node = concept.nodes.find(n => n.id === draggingNodeId)
      if (node) {
        await fetch(`/api/admin2/concepts/${conceptId}/nodes/${draggingNodeId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ position_x: node.position_x, position_y: node.position_y }),
        })
      }
    }
    setDraggingNodeId(null)
    // connectingFrom wird bewusst NICHT hier zurückgesetzt - das Verbinden läuft
    // jetzt per Klick-Start/Klick-Ende statt Halten (siehe startConnection /
    // finishConnection), daher darf ein normales Loslassen der Maustaste
    // (z.B. weil man gerade einen Node verschoben hat) eine laufende
    // Verbindung nicht abbrechen.
  }

  // --- Text-zu-Konzept ---
  const [showTextForm, setShowTextForm] = useState(false)
  const [conceptText, setConceptText] = useState('')
  const [parsingText, setParsingText] = useState(false)
  const [textError, setTextError] = useState('')

  const submitText = async () => {
    if (!conceptText.trim()) return
    setParsingText(true)
    setTextError('')
    const res = await fetch(`/api/admin2/concepts/${conceptId}/parse-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: conceptText }),
    })
    if (res.ok) {
      setShowTextForm(false)
      setConceptText('')
      load()
    } else {
      const data = await res.json().catch(() => ({}))
      setTextError(data.error || 'Fehler beim Verarbeiten des Texts')
    }
    setParsingText(false)
  }
  // --- Node erstellen ---
  const [showNewNodeForm, setShowNewNodeForm] = useState(false)
  const [newNodeTitleInput, setNewNodeTitleInput] = useState('')
  const [newNodeHasOutput, setNewNodeHasOutput] = useState(true)

  const confirmAddNode = async () => {
    if (!newNodeTitleInput.trim()) return
    const rect = containerRef.current?.getBoundingClientRect()
    const x = rect ? (rect.width / 2 - pan.x) / zoom - NODE_WIDTH / 2 : 100
    const y = rect ? (rect.height / 2 - pan.y) / zoom - 40 : 100
    const res = await fetch(`/api/admin2/concepts/${conceptId}/nodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newNodeTitleInput.trim(), position_x: x, position_y: y, withOutput: newNodeHasOutput }),
    })
    if (res.ok) {
      setShowNewNodeForm(false)
      setNewNodeTitleInput('')
      setNewNodeHasOutput(true)
      load()
    }
  }

  const startNodeDrag = (e: React.MouseEvent, node: Node) => {
    e.stopPropagation()
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    dragOffset.current = { x: (e.clientX - rect.left - pan.x) / zoom - node.position_x, y: (e.clientY - rect.top - pan.y) / zoom - node.position_y }
    setDraggingNodeId(node.id)
  }

  // --- Verbindungen ---
  const startConnection = (e: React.MouseEvent, outputId: string) => {
    e.stopPropagation()
    setConnectingFrom(outputId)
  }

  const finishConnection = async (e: React.MouseEvent, targetNodeId: string) => {
    e.stopPropagation()
    if (!connectingFrom) return
    await fetch(`/api/admin2/concepts/${conceptId}/connections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_output_id: connectingFrom, target_node_id: targetNodeId }),
    })
    setConnectingFrom(null)
    load()
  }

  const deleteEdge = async (edgeId: string) => {
    await fetch(`/api/admin2/concepts/${conceptId}/connections/${edgeId}`, { method: 'DELETE' })
    load()
  }

  const deleteNode = async (nodeId: string) => {
    if (!confirm('Diesen Baustein wirklich löschen?')) return
    await fetch(`/api/admin2/concepts/${conceptId}/nodes/${nodeId}`, { method: 'DELETE' })
    setSelectedNodeId(null)
    load()
  }

  const addOutput = async (nodeId: string) => {
    if (!newOutputLabel.trim()) return
    await fetch(`/api/admin2/concepts/${conceptId}/nodes/${nodeId}/outputs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: newOutputLabel }),
    })
    setNewOutputLabel('')
    setAddingOutputFor(null)
    load()
  }

  const deleteOutput = async (nodeId: string, outputId: string) => {
    await fetch(`/api/admin2/concepts/${conceptId}/nodes/${nodeId}/outputs/${outputId}`, { method: 'DELETE' })
    load()
  }

  // --- Output-Port-Position im Canvas berechnen (für SVG-Linien) ---
  const getOutputPortPos = (node: Node, outputIndex: number) => {
    const headerHeight = 44
    const rowHeight = 32
    return { x: node.position_x + NODE_WIDTH, y: node.position_y + headerHeight + outputIndex * rowHeight + rowHeight / 2 }
  }
  const getNodeInputPos = (node: Node) => ({ x: node.position_x, y: node.position_y + 22 })

  const bezierPath = (x1: number, y1: number, x2: number, y2: number) => {
    const dx = Math.max(Math.abs(x2 - x1) * 0.5, 40)
    return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`
  }

  if (loading) return <p className="text-sm p-6" style={{ color: 'var(--muted)' }}>Laden...</p>
  if (!concept) return <p className="text-sm p-6" style={{ color: 'var(--muted)' }}>Konzept nicht gefunden.</p>

  const selectedNode = concept.nodes.find(n => n.id === selectedNodeId) || null

  // Gemeinsame Kopfzeilen-Elemente (Besitzer, Zugriff, Tags) für beide Modi
  const HeaderMeta = (
    <div className="flex items-center gap-2 flex-wrap">
      {concept.ownerUsername ? (
        <span className="text-xs px-2.5 py-1 rounded-full inline-flex items-center gap-1"
          style={{ background: 'var(--muted-bg)', color: 'var(--muted)' }}>
          👤 {concept.ownerUsername}
        </span>
      ) : (
        <button onClick={claim}
          className="text-xs px-2.5 py-1 rounded-full hover:opacity-80 transition-all"
          style={{ background: '#7C3AED22', color: '#7C3AED', border: '1px solid #7C3AED55' }}>
          🏳️ Niemand — Claimen
        </button>
      )}
      {concept.ownerUsername && !concept.canEdit && (
        concept.hasPendingRequest ? (
          <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: 'var(--muted-bg)', color: 'var(--muted)' }}>
            Anfrage gesendet
          </span>
        ) : (
          <button onClick={requestAccess}
            className="text-xs px-2.5 py-1 rounded-full hover:opacity-80 transition-all"
            style={{ background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }}>
            Zugriff anfragen
          </button>
        )
      )}
      {concept.isFinished && (
        <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: '#A855F722', color: '#A855F7' }}>
          ✅ Fertig
        </span>
      )}
      <TagBar concept={concept} onAssign={assignTag} onUnassign={unassignTag} />
    </div>
  )

  // --- Text-Modus: einfaches Textdokument statt Baustein-Canvas ---
  if (concept.isTextOnly) {
    return (
      <div className="fixed inset-0 flex flex-col" style={{ background: 'var(--background)' }}>
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0 flex-wrap gap-3" style={{ borderBottom: '1px solid var(--card-border)' }}>
          <div className="flex items-center gap-3 flex-wrap">
            <Link href="/admin2/update-konzepte" className="text-sm hover:opacity-70 transition-all" style={{ color: 'var(--muted)' }}>← Zurück</Link>
            <h1 className="font-bold text-lg" style={{ color: 'var(--foreground)' }}>{concept.title}</h1>
            {HeaderMeta}
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/admin2/update-konzepte/${conceptId}/chat`}
              className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{ background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }}>
              💬 Diskussion
            </Link>
            {concept.canEdit && (
              <>
                <button onClick={toggleFinished}
                  className="px-4 py-2 rounded-xl text-sm font-medium"
                  style={concept.isFinished
                    ? { background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }
                    : { background: '#A855F722', color: '#A855F7', border: '1px solid #A855F755' }}>
                  {concept.isFinished ? 'Als aktiv markieren' : '✅ Als fertig markieren'}
                </button>
                <button onClick={switchMode}
                  className="px-4 py-2 rounded-xl text-sm font-medium"
                  style={{ background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }}>
                  🔀 Zu Baustein-Modus
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full">
          <textarea
            value={textContent}
            onChange={e => setTextContent(e.target.value)}
            onBlur={saveTextContent}
            readOnly={!concept.canEdit}
            placeholder="Konzept als Text schreiben..."
            className="w-full h-full min-h-[70vh] rounded-2xl px-5 py-4 text-sm outline-none resize-none leading-relaxed"
            style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
          />
          <div className="flex justify-end mt-2">
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              {textSaving ? 'Speichert...' : textSavedAt ? 'Gespeichert ✓' : 'Änderungen werden beim Verlassen des Felds gespeichert'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: 'var(--background)' }}>
      <EdgeGlowStyles />
      {/* Kopfzeile */}
      <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--card-border)' }}>
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/admin2/update-konzepte" className="text-sm hover:opacity-70 transition-all" style={{ color: 'var(--muted)' }}>← Zurück</Link>
          <h1 className="font-bold text-lg" style={{ color: 'var(--foreground)' }}>{concept.title}</h1>
          {HeaderMeta}
        </div>
        <div className="flex items-center gap-2">
        <Link href={`/admin2/team-chat/konzept/${conceptId}`}
          className="px-4 py-2 rounded-xl text-sm font-medium"
          style={{ background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }}>
          💬 Diskussion
        </Link>
        {concept.canEdit && (
          <button onClick={switchMode}
            className="px-4 py-2 rounded-xl text-sm font-medium"
            style={{ background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }}>
            🔀 Zu Text-Modus
          </button>
        )}
        <button onClick={() => setShowTextForm(true)}
          className="px-4 py-2 rounded-xl text-sm font-medium"
          style={{ background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }}>
          📝 Textkonzept
        </button>
        <div className="relative">
          <button onClick={() => setShowNewNodeForm(v => !v)} className="btn-gradient text-white px-4 py-2 rounded-xl text-sm font-medium">
            + Baustein
          </button>
          {showNewNodeForm && (
            <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl p-4 shadow-lg z-20"
              style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>
              <input value={newNodeTitleInput} onChange={e => setNewNodeTitleInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') confirmAddNode(); if (e.key === 'Escape') setShowNewNodeForm(false) }}
                autoFocus placeholder="Titel des Bausteins"
                className="w-full rounded-xl px-3 py-2 text-sm outline-none mb-3"
                style={{ background: 'var(--background)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />
              <label className="flex items-center gap-2 mb-4 cursor-pointer text-sm" style={{ color: 'var(--foreground)' }}>
                <input type="checkbox" checked={newNodeHasOutput} onChange={e => setNewNodeHasOutput(e.target.checked)} />
                Hat Output (aus, wenn dies ein Endpunkt ist)
              </label>
              <div className="flex gap-2">
                <button onClick={confirmAddNode} className="btn-gradient text-white px-4 py-2 rounded-xl text-sm font-medium flex-1">
                  Erstellen
                </button>
                <button onClick={() => setShowNewNodeForm(false)} className="px-4 py-2 rounded-xl text-sm" style={{ color: 'var(--muted)' }}>
                  Abbrechen
                </button>
              </div>
            </div>
          )}
        </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 flex overflow-hidden">
        <div
          ref={containerRef}
          className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing select-none"
          style={{
            backgroundImage: 'radial-gradient(circle, var(--card-border) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            backgroundPosition: `${pan.x}px ${pan.y}px`,
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
          onMouseDown={onCanvasMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onWheel={onWheel}
        >
          <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0', position: 'absolute', inset: 0 }}>
            {/* SVG-Layer für Verbindungslinien */}
            <svg className="absolute overflow-visible pointer-events-none" style={{ left: 0, top: 0, width: '100%', height: '100%' }}>
              {concept.edges.map(edge => {
                const sourceNode = concept.nodes.find(n => n.outputs.some(o => o.id === edge.source_output_id))
                const targetNode = concept.nodes.find(n => n.id === edge.target_node_id)
                if (!sourceNode || !targetNode) return null
                const outputIndex = sourceNode.outputs.findIndex(o => o.id === edge.source_output_id)
                const from = getOutputPortPos(sourceNode, outputIndex)
                const to = getNodeInputPos(targetNode)
                // Farbe der Linie richtet sich nach dem Status des ZIEL-Bausteins
                // (macht den Ablauf lesbar: "was kommt als nächstes und wie weit
                // ist es schon"), nicht nach dem Quell-Baustein.
                const color = EDGE_STATUS_COLOR[targetNode.status]
                return (
                  <g key={edge.id} className="pointer-events-auto cursor-pointer" onClick={() => deleteEdge(edge.id)}>
                    <path
                      d={bezierPath(from.x, from.y, to.x, to.y)}
                      stroke={color} strokeWidth={2.5} fill="none"
                      className="edge-glow"
                      style={{ filter: `drop-shadow(0 0 4px ${color})` }}
                    />
                    <circle cx={from.x} cy={from.y} r={4} fill={color} />
                    <circle cx={to.x} cy={to.y} r={4} fill={color} />
                  </g>
                )
              })}
              {/* Live-Vorschau während des Ziehens einer neuen Verbindung */}
              {connectingFrom && concept.nodes.map(n => {
                const idx = n.outputs.findIndex(o => o.id === connectingFrom)
                if (idx === -1) return null
                const from = getOutputPortPos(n, idx)
                return <path key={n.id} d={bezierPath(from.x, from.y, mousePos.x, mousePos.y)} stroke="#10B981" strokeWidth={2} strokeDasharray="5,5" fill="none" opacity={0.5} />
              })}
            </svg>

            {/* Nodes */}
            {concept.nodes.map(node => {
              const s = STATUS_STYLE[node.status]
              return (
                <div key={node.id}
                  className="absolute rounded-xl shadow-lg"
                  style={{ left: node.position_x, top: node.position_y, width: NODE_WIDTH, border: `1px solid ${s.color}77`, background: 'var(--muted-bg)' }}
                  onClick={e => connectingFrom && finishConnection(e, node.id)}
                >
                  <div className="rounded-xl overflow-hidden">
                    <div className="px-3 py-2.5 cursor-move flex items-center justify-center relative"
                      style={{ background: `${s.color}22` }}
                      onMouseDown={e => startNodeDrag(e, node)}
                      onClick={e => { e.stopPropagation(); setSelectedNodeId(node.id) }}>
                      <span className="text-sm font-medium truncate text-center" style={{ color: 'var(--foreground)' }}>{node.title}</span>
                      <span className="w-2 h-2 rounded-full flex-shrink-0 absolute right-3" style={{ background: s.color }} />
                    </div>
                    <div className="py-1">
                      {node.outputs.map(output => (
                        <div key={output.id} className="flex items-center justify-center px-3 h-8 text-xs" style={{ color: 'var(--muted)' }}>
                          <span className="truncate">{output.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Ausgangs-Punkte rechts - AUSSERHALB des overflow-hidden Bereichs oben,
                      damit sie nicht abgeschnitten werden und wirklich klickbar sind. Das war
                      der Grund, warum Verbinden vorher nicht funktioniert hat: der Punkt lag
                      per negativem Margin über dem overflow-hidden Rand und wurde weggeschnitten. */}
                  {node.outputs.map((output, i) => (
                    <span key={output.id}
                      onClick={e => startConnection(e, output.id)}
                      className="absolute w-4 h-4 rounded-full cursor-crosshair hover:scale-125 transition-transform z-10"
                      style={{ background: '#10B981', border: '2px solid var(--background)', right: -8, top: 44 + i * 32 + 16 - 8 }}
                    />
                  ))}
                  {/* Eingangs-Punkt links */}
                  <span className="absolute w-4 h-4 rounded-full z-10" style={{ background: '#10B981', border: '2px solid var(--background)', left: -8, top: 14 }} />
                </div>
              )
            })}
          </div>
        </div>

        {showTextForm && (
          <TextToConceptModal
            text={conceptText}
            setText={setConceptText}
            onSubmit={submitText}
            onClose={() => setShowTextForm(false)}
            submitting={parsingText}
            error={textError}
          />
        )}

        {/* Detail-Panel */}
        {selectedNode && (
          <NodeDetailPanel
            node={selectedNode}
            conceptId={conceptId}
            onClose={() => setSelectedNodeId(null)}
            onChanged={load}
            onDelete={() => deleteNode(selectedNode.id)}
            addingOutput={addingOutputFor === selectedNode.id}
            newOutputLabel={newOutputLabel}
            setNewOutputLabel={setNewOutputLabel}
            onStartAddOutput={() => { setAddingOutputFor(selectedNode.id); setNewOutputLabel('') }}
            onCancelAddOutput={() => setAddingOutputFor(null)}
            onAddOutput={() => addOutput(selectedNode.id)}
            onDeleteOutput={outputId => deleteOutput(selectedNode.id, outputId)}
          />
        )}
      </div>
    </div>
  )
}

function TagBar({ concept, onAssign, onUnassign }: {
  concept: Concept, onAssign: (tagId: string) => void, onUnassign: (tagId: string) => void
}) {
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [showPicker, setShowPicker] = useState(false)

  useEffect(() => {
    if (showPicker && allTags.length === 0) {
      fetch('/api/admin2/concept-tags').then(r => r.json()).then(data => setAllTags(data.tags || []))
    }
  }, [showPicker, allTags.length])

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {concept.tags.map(tag => (
        <span key={tag.id} onClick={() => onUnassign(tag.id)} title="Klicken zum Entfernen"
          className="text-xs px-2.5 py-1 rounded-full cursor-pointer hover:opacity-70 transition-all"
          style={{ background: `${tag.color}22`, color: tag.color, border: `1px solid ${tag.color}55` }}>
          {tag.name} ✕
        </span>
      ))}
      {concept.canEdit && (
        <div className="relative">
          <button onClick={() => setShowPicker(v => !v)}
            className="text-xs px-2.5 py-1 rounded-full hover:opacity-80 transition-all"
            style={{ background: 'var(--muted-bg)', color: 'var(--muted)', border: '1px dashed var(--card-border)' }}>
            + Tag
          </button>
          {showPicker && (
            <div className="absolute left-0 top-full mt-1 w-56 rounded-xl p-2 shadow-lg z-20"
              style={{ background: 'var(--background)', border: '1px solid var(--card-border)' }}>
              {allTags.filter(t => !concept.tags.some(ct => ct.id === t.id)).length === 0 ? (
                <p className="text-xs px-2 py-1" style={{ color: 'var(--muted)' }}>Keine weiteren Tags verfügbar.</p>
              ) : allTags.filter(t => !concept.tags.some(ct => ct.id === t.id)).map(tag => (
                <button key={tag.id} onClick={() => { onAssign(tag.id); setShowPicker(false) }}
                  className="w-full text-left text-xs px-2 py-1.5 rounded-lg hover:opacity-80 flex items-center gap-2"
                  style={{ color: 'var(--foreground)' }}>
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: tag.color }} />
                  {tag.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function EdgeGlowStyles() {
  return (
    <style jsx global>{`
      .edge-glow {
        animation: edge-shimmer 2.2s ease-in-out infinite;
      }
      @keyframes edge-shimmer {
        0%, 100% { opacity: 0.55; }
        50% { opacity: 1; }
      }
    `}</style>
  )
}
function TextToConceptModal({ text, setText, onSubmit, onClose, submitting, error }: {
  text: string, setText: (v: string) => void, onSubmit: () => void, onClose: () => void, submitting: boolean, error: string,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="w-full max-w-2xl rounded-2xl p-6" style={{ background: 'var(--background)', border: '1px solid var(--card-border)' }}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-bold text-lg" style={{ color: 'var(--foreground)' }}>Konzept als Text schreiben</h2>
          <button onClick={onClose} className="text-sm" style={{ color: 'var(--muted)' }}>✕</button>
        </div>
        <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
          Jede Zeile mit <code className="px-1 rounded" style={{ background: 'var(--muted-bg)' }}># Titel</code> wird zu einer neuen Kachel-Überschrift,
          der Text darunter zu ihrer Beschreibung. Die Bausteine werden automatisch in Schreibreihenfolge miteinander verbunden.
        </p>
        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
        <textarea value={text} onChange={e => setText(e.target.value)}
          rows={14}
          placeholder={'# Erster Schritt\nBeschreibung des ersten Schritts...\n\n# Zweiter Schritt\nBeschreibung des zweiten Schritts...'}
          className="w-full rounded-xl px-4 py-3 text-sm outline-none mb-4 resize-none font-mono"
          style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />
        <div className="flex gap-2">
          <button onClick={onSubmit} disabled={submitting || !text.trim()}
            className="btn-gradient text-white px-5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
            {submitting ? 'Wird erstellt...' : 'Bausteine erstellen'}
          </button>
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm" style={{ color: 'var(--muted)' }}>Abbrechen</button>
        </div>
      </div>
    </div>
  )
}
function NodeDetailPanel({
  node, conceptId, onClose, onChanged, onDelete,
  addingOutput, newOutputLabel, setNewOutputLabel, onStartAddOutput, onCancelAddOutput, onAddOutput, onDeleteOutput,
}: {
  node: Node, conceptId: string, onClose: () => void, onChanged: () => void, onDelete: () => void,
  addingOutput: boolean, newOutputLabel: string, setNewOutputLabel: (v: string) => void,
  onStartAddOutput: () => void, onCancelAddOutput: () => void, onAddOutput: () => void, onDeleteOutput: (outputId: string) => void,
}) {
  const [title, setTitle] = useState(node.title)
  const [description, setDescription] = useState(node.description)
  const [status, setStatus] = useState(node.status)
  const [saving, setSaving] = useState(false)

  useEffect(() => { setTitle(node.title); setDescription(node.description); setStatus(node.status) }, [node.id])

  const save = async (patch: Partial<{ title: string, description: string, status: string }>) => {
    setSaving(true)
    await fetch(`/api/admin2/concepts/${conceptId}/nodes/${node.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    onChanged()
    setSaving(false)
  }

  return (
    <div className="w-[340px] flex-shrink-0 p-5 overflow-y-auto" style={{ borderLeft: '1px solid var(--card-border)', background: 'var(--background)' }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold" style={{ color: 'var(--foreground)' }}>Baustein bearbeiten</h2>
        <button onClick={onClose} className="text-sm" style={{ color: 'var(--muted)' }}>✕</button>
      </div>

      <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--muted)' }}>Titel</label>
      <input value={title} onChange={e => setTitle(e.target.value)} onBlur={() => save({ title })}
        className="w-full rounded-xl px-3 py-2 text-sm outline-none mb-4"
        style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />

      <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--muted)' }}>Beschreibung</label>
      <textarea value={description} onChange={e => setDescription(e.target.value)} onBlur={() => save({ description })}
        rows={4}
        className="w-full rounded-xl px-3 py-2 text-sm outline-none mb-4 resize-none"
        style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />

      <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--muted)' }}>Status</label>
      <div className="flex gap-1.5 mb-5">
        {(['offen', 'in_arbeit', 'fertig'] as const).map(s => (
          <button key={s} onClick={() => { setStatus(s); save({ status: s }) }}
            className="flex-1 py-2 rounded-xl text-xs font-medium transition-all"
            style={status === s
              ? { background: `${STATUS_STYLE[s].color}22`, color: STATUS_STYLE[s].color, border: `1px solid ${STATUS_STYLE[s].color}` }
              : { background: 'var(--muted-bg)', color: 'var(--muted)' }}>
            {STATUS_STYLE[s].label}
          </button>
        ))}
      </div>

      <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--muted)' }}>Ausgänge</label>
      <div className="space-y-1.5 mb-3">
        {node.outputs.map(output => (
          <div key={output.id} className="flex items-center justify-between px-3 py-2 rounded-xl text-sm" style={{ background: 'var(--muted-bg)' }}>
            <span style={{ color: 'var(--foreground)' }}>{output.label || '(ohne Namen)'}</span>
            <button onClick={() => onDeleteOutput(output.id)} className="text-xs" style={{ color: '#EF4444' }}>✕</button>
          </div>
        ))}
      </div>
      {addingOutput ? (
        <div className="flex gap-2 mb-5">
          <input value={newOutputLabel} onChange={e => setNewOutputLabel(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onAddOutput(); if (e.key === 'Escape') onCancelAddOutput() }}
            autoFocus placeholder="z.B. true / false"
            className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
            style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />
          <button onClick={onAddOutput} className="btn-gradient text-white px-3 py-2 rounded-xl text-sm">+</button>
        </div>
      ) : (
        <button onClick={onStartAddOutput} className="text-xs underline mb-5" style={{ color: 'var(--muted)' }}>+ Ausgang hinzufügen</button>
      )}

      <button onClick={onDelete} className="text-xs underline" style={{ color: '#EF4444' }}>Baustein löschen</button>
    </div>
  )
}