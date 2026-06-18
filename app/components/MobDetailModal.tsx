'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { MobEntry, getModelFileName, getWikiUrl } from '../lib/mobs'
import MobModelViewer from './MobModelViewer'

type MobDetailModalProps = {
  mob: MobEntry
  myKills: number          // wie oft der aktuelle Nutzer diesen Mob getötet hat
  ranking: { name: string; kills: number }[] // sortiertes Ranking aller Clan-Mitglieder zu diesem Mob
  onClose: () => void
}

const CATEGORY_LABELS: Record<string, string> = {
  Passiv: 'Passiv – greift nicht an',
  Neutral: 'Neutral – greift nur bei Provokation an',
  Feindlich: 'Feindlich – greift sofort an',
  Boss: 'Boss – besonders starker Gegner',
}

export default function MobDetailModal({ mob, myKills, ranking, onClose }: MobDetailModalProps) {
  const hasVariants = !!mob.variants && mob.variants.length > 0
  const [selectedVariant, setSelectedVariant] = useState<string>(
    hasVariants ? mob.variants![0].id : 'normal'
  )

  const modelFileName = getModelFileName(mob.id, selectedVariant)
  const modelAvailable = mob.modelAvailable !== false

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Dunkler Hintergrund */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal-Panel */}
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[var(--card)] border border-[var(--card-border)] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--card-border)]">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{mob.icon}</span>
            <h2 className="text-xl font-bold">{mob.name}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-2xl leading-none opacity-60 hover:opacity-100 transition"
            aria-label="Schließen"
          >
            ×
          </button>
        </div>

        {/* 3D-Vorschau oder Platzhalter */}
        <div className="h-72 bg-black/5 dark:bg-white/5">
          {modelAvailable ? (
            <MobModelViewer modelFileName={modelFileName} />
          ) : (
            <div className="h-full flex items-center justify-center text-center px-8 opacity-60">
              Die Mobvorschau für {mob.name} ist aktuell noch nicht verfügbar.
            </div>
          )}
        </div>

        {/* Varianten-Buttons */}
        {hasVariants && modelAvailable && (
          <div className="flex gap-2 px-6 pt-4">
            {mob.variants!.map(v => (
              <button
                key={v.id}
                onClick={() => setSelectedVariant(v.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  selectedVariant === v.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        )}

        {/* Info-Bereich */}
        <div className="px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="opacity-60 mb-0.5">Verhalten</div>
              <div className="font-medium">{CATEGORY_LABELS[mob.category]}</div>
            </div>
            <div>
              <div className="opacity-60 mb-0.5">Fundort</div>
              <div className="font-medium">{mob.biome}</div>
            </div>
          </div>

          {/* Eigene Stats + Ranking */}
          <div>
            <div className="text-sm opacity-60 mb-1.5">Deine Kills</div>
            <div className="text-2xl font-bold">{myKills.toLocaleString('de-DE')}</div>
          </div>

          {ranking.length > 0 && (
            <div>
              <div className="text-sm opacity-60 mb-1.5">Clan-Ranking</div>
              <div className="space-y-1">
                {ranking.slice(0, 5).map((entry, i) => (
                  <div key={entry.name} className="flex items-center justify-between text-sm py-1 px-2 rounded-lg bg-black/5 dark:bg-white/5">
                    <span>#{i + 1} {entry.name}</span>
                    <span className="font-medium">{entry.kills.toLocaleString('de-DE')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Wiki-Link */}
          <a
            href={getWikiUrl(mob)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Mehr Infos im Minecraft-Wiki →
          </a>
        </div>
      </div>
    </div>,
    document.body
  )
}