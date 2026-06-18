'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  ALL_BLOCKS, BLOCK_CATEGORIES, getGroupsInCategory, getBlocksInGroup,
  BlockCategory, BlockEntry
} from '../lib/blocks'
import { getBlockTexture } from '../lib/blockTextures'

type BlockRankingEntry = { name: string; count: number }

// ===== Block-Textur-Icon =====
function BlockIcon({ blockId, size = 32 }: { blockId: string; size?: number }) {
  const texture = getBlockTexture(blockId)
  return (
    <img
      src={`/block-textures/${texture}.png`}
      alt={blockId}
      width={size}
      height={size}
      style={{ imageRendering: 'pixelated', width: size, height: size }}
      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
    />
  )
}

// ===== Ranking-Modal (für Einzelblock, Gruppe und Kategorie) =====
function RankingModal({
  title, myCount, ranking, onClose
}: {
  title: string
  myCount: number
  ranking: BlockRankingEntry[]
  onClose: () => void
}) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-[var(--card)] border border-[var(--card-border)] shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--card-border)]">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="text-2xl leading-none opacity-60 hover:opacity-100 transition">×</button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
            <div className="text-sm opacity-60 mb-1">Deine Abbaus</div>
            <div className="text-2xl font-bold">{myCount.toLocaleString('de-DE')}</div>
          </div>
          {ranking.length > 0 ? (
            <div>
              <div className="text-sm opacity-60 mb-1.5">Clan-Ranking</div>
              <div className="space-y-1">
                {ranking.slice(0, 10).map((entry, i) => (
                  <div key={entry.name} className="flex items-center justify-between text-sm py-1 px-2 rounded-lg bg-black/5 dark:bg-white/5">
                    <span>#{i + 1} {entry.name}</span>
                    <span className="font-medium">{entry.count.toLocaleString('de-DE')}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm opacity-50">Noch keine Clan-Daten verfügbar.</p>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

// ===== Trophy-Button =====
function TrophyButton({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
  return (
    <span
      onClick={onClick}
      role="button"
      tabIndex={0}
      className="text-base leading-none opacity-50 hover:opacity-100 transition cursor-pointer"
      title="Gesamt-Ranking anzeigen"
    >
      🏆
    </span>
  )
}

// ===== Hauptkomponente =====
type Props = {
  blockBreaks: Record<string, number>
}

type ModalState = {
  title: string
  blockIds: string[]
} | null

export default function BlockStatsSection({ blockBreaks }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<BlockCategory | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [modalState, setModalState] = useState<ModalState>(null)
  const [ranking, setRanking] = useState<BlockRankingEntry[]>([])
  const [rankingLoading, setRankingLoading] = useState(false)

  // Ranking laden wenn Modal geöffnet wird
  useEffect(() => {
    if (!modalState) { setRanking([]); return }
    setRankingLoading(true)
    const types = modalState.blockIds.join(',')
    const url = modalState.blockIds.length === 1
      ? `/api/smp/block-ranking?block_type=${modalState.blockIds[0]}`
      : `/api/smp/block-ranking-group?block_types=${types}`
    fetch(url)
      .then(r => r.json())
      .then(data => { setRanking(data.ranking || []); setRankingLoading(false) })
      .catch(() => { setRanking([]); setRankingLoading(false) })
  }, [modalState])

  const getCount = (blockId: string) =>
    blockBreaks[blockId] || blockBreaks[blockId.toUpperCase()] || 0

  const getTotalCount = (blockIds: string[]) =>
    blockIds.reduce((sum, id) => sum + getCount(id), 0)

  const openRanking = (e: React.MouseEvent, title: string, blockIds: string[]) => {
    e.stopPropagation()
    setModalState({ title, blockIds })
  }

  // ===== Ebene 1: Kategorien =====
  if (!selectedCategory) {
    return (
      <>
        <div className="card rounded-2xl p-6">
          <h2 className="font-bold text-lg mb-4" style={{ color: 'var(--foreground)' }}>Abgebaute Blöcke</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {BLOCK_CATEGORIES.map(category => {
              const blocks = ALL_BLOCKS.filter(b => b.category === category)
              const total = getTotalCount(blocks.map(b => b.id))
              const rep = blocks.find(b => getCount(b.id) > 0) || blocks[0]
              return (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className="relative flex flex-col items-center gap-2 p-4 rounded-xl text-sm font-medium transition hover:opacity-80"
                  style={{ background: total > 0 ? 'rgba(22,163,74,0.08)' : 'var(--muted-bg)', border: '1px solid var(--card-border)' }}
                >
                  <TrophyButton onClick={e => openRanking(e, `Ranking: ${category}`, blocks.map(b => b.id))} />
                  {rep && <BlockIcon blockId={rep.id} size={40} />}
                  <span style={{ color: 'var(--foreground)' }}>{category}</span>
                  <span className="font-bold text-lg" style={{ color: total > 0 ? '#16A34A' : 'var(--muted)' }}>
                    {total.toLocaleString('de-DE')}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {modalState && (
          <RankingModal
            title={modalState.title}
            myCount={getTotalCount(modalState.blockIds)}
            ranking={rankingLoading ? [] : ranking}
            onClose={() => setModalState(null)}
          />
        )}
      </>
    )
  }

  // ===== Ebene 2: Materialgruppen =====
  if (!selectedGroup) {
    const groups = getGroupsInCategory(selectedCategory)
    return (
      <>
        <div className="card rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <button onClick={() => setSelectedCategory(null)} className="text-sm opacity-60 hover:opacity-100 transition">← Zurück</button>
            <h2 className="font-bold text-lg" style={{ color: 'var(--foreground)' }}>{selectedCategory}</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {groups.map(group => {
              const blocks = getBlocksInGroup(selectedCategory, group)
              const total = getTotalCount(blocks.map(b => b.id))
              const rep = blocks.find(b => getCount(b.id) > 0) || blocks[0]
              return (
                <button
                  key={group}
                  onClick={() => setSelectedGroup(group)}
                  className="relative flex flex-col items-center gap-2 p-4 rounded-xl text-sm font-medium transition hover:opacity-80"
                  style={{ background: total > 0 ? 'rgba(22,163,74,0.08)' : 'var(--muted-bg)', border: '1px solid var(--card-border)' }}
                >
                  <TrophyButton onClick={e => openRanking(e, `Ranking: ${group}`, blocks.map(b => b.id))} />
                  {rep && <BlockIcon blockId={rep.id} size={36} />}
                  <span style={{ color: 'var(--foreground)' }}>{group}</span>
                  <span className="font-bold" style={{ color: total > 0 ? '#16A34A' : 'var(--muted)' }}>
                    {total.toLocaleString('de-DE')}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {modalState && (
          <RankingModal
            title={modalState.title}
            myCount={getTotalCount(modalState.blockIds)}
            ranking={rankingLoading ? [] : ranking}
            onClose={() => setModalState(null)}
          />
        )}
      </>
    )
  }

  // ===== Ebene 3: Einzelblöcke =====
  const blocks = getBlocksInGroup(selectedCategory, selectedGroup)
  return (
    <>
      <div className="card rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <button onClick={() => setSelectedGroup(null)} className="text-sm opacity-60 hover:opacity-100 transition">← Zurück</button>
          <h2 className="font-bold text-lg" style={{ color: 'var(--foreground)' }}>{selectedGroup}</h2>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {blocks.map(block => {
            const count = getCount(block.id)
            return (
              <button
                key={block.id}
                onClick={e => openRanking(e, block.name, [block.id])}
                className="flex items-center justify-between px-3 py-2 rounded-lg text-sm text-left hover:opacity-80 transition"
                style={{ background: count > 0 ? 'rgba(22,163,74,0.08)' : 'var(--muted-bg)', border: '1px solid var(--card-border)' }}
              >
                <span className="flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
                  <BlockIcon blockId={block.id} size={24} />
                  {block.name}
                </span>
                <span className="font-bold" style={{ color: count > 0 ? '#16A34A' : 'var(--muted)' }}>
                  {count.toLocaleString('de-DE')}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {modalState && (
        <RankingModal
          title={modalState.title}
          myCount={getTotalCount(modalState.blockIds)}
          ranking={rankingLoading ? [] : ranking}
          onClose={() => setModalState(null)}
        />
      )}
    </>
  )
}