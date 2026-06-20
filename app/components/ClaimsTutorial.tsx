'use client'

import { useState } from 'react'

type Slide = {
  icon: string
  title: string
  body: React.ReactNode
}

const SLIDES: Slide[] = [
  {
    icon: '📍',
    title: 'Willkommen beim Claim-System',
    body: (
      <>
        <p>Mit <code>/claim [name]</code> claimst du den 16×16-Chunk, in dem du gerade stehst.</p>
        <p>Standardmäßig ist in einem geclaimten Chunk <strong>alles verboten außer Betreten</strong> — nur du als Owner darfst dort frei agieren.</p>
      </>
    ),
  },
  {
    icon: '🤝',
    title: 'Spieler vertrauen (Trust)',
    body: (
      <>
        <p>Mit <code>/trust &lt;Name&gt; current</code> vertraust du jemandem genau den Chunk, in dem du stehst. Mit <code>/trust &lt;Name&gt; all</code> vertraust du ihm all deine Claims auf einmal.</p>
        <p>Vertraute Spieler dürfen erstmal alles tun, was ein Owner normalerweise auch darf — die feinere Steuerung kommt als Nächstes.</p>
      </>
    ),
  },
  {
    icon: '🎛️',
    title: 'Granulare Berechtigungen',
    body: (
      <>
        <p>Auf der Website kannst du für jeden Chunk ganz genau einstellen, was erlaubt ist: Blöcke abbauen, Truhen öffnen, Redstone, Tiere füttern und 10 weitere Rechte.</p>
        <p>Jedes Recht hat drei Zustände: <strong style={{ color: '#16A34A' }}>Erlaubt</strong>, <strong style={{ color: '#EAB308' }}>Erben</strong> (von einer allgemeineren Regel übernehmen) oder <strong style={{ color: '#EF4444' }}>Verboten</strong>.</p>
      </>
    ),
  },
  {
    icon: '🗂️',
    title: 'Gruppen',
    body: (
      <>
        <p>Claimst du mehrere zusammenhängende Chunks, werden sie automatisch zu einer <strong>Gruppe</strong> zusammengefasst — so musst du Rechte nicht für jeden Chunk einzeln einstellen.</p>
        <p>Du kannst Gruppen auch manuell erstellen und Chunks per Drag &amp; Drop zuordnen, auch wenn sie nicht aneinander grenzen.</p>
      </>
    ),
  },
  {
    icon: '🌍',
    title: 'Globale Einstellungen',
    body: (
      <>
        <p>Unter <strong>Globale Einstellungen</strong> kannst du Regeln festlegen, die für <strong>alle</strong> deine Claims gleichzeitig gelten — als unterste Standard-Ebene.</p>
        <p>Eine Regel auf Chunk- oder Gruppen-Ebene hat dabei immer Vorrang vor der globalen Einstellung.</p>
      </>
    ),
  },
  {
    icon: '🗺️',
    title: 'Große Flächen claimen',
    body: (
      <>
        <p>Für größere Gebiete musst du nicht jeden Chunk einzeln claimen: mit <code>/claimpos1</code> und <code>/claimpos2</code> markierst du zwei Eckpunkte, dann claimt <code>/claimarea [name]</code> das ganze Rechteck auf einmal.</p>
      </>
    ),
  },
  {
    icon: '💾',
    title: 'Konfigurationen speichern',
    body: (
      <>
        <p>Hast du eine Rechte-Kombination eingestellt, die dir gefällt? Speichere sie mit einem Namen als <strong>Vorlage</strong> und wende sie später auf jeden anderen Chunk oder jede andere Gruppe an — ganz ohne alles erneut einzustellen.</p>
      </>
    ),
  },
  {
    icon: '🗑️',
    title: 'Unclaimen & Papierkorb',
    body: (
      <>
        <p>Eine ganze Gruppe lässt sich mit einem Klick komplett unclaimen. Keine Sorge: für <strong>48 Stunden</strong> bleibt sie im Papierkorb wiederherstellbar — inklusive aller Rechte und vertrauten Spieler.</p>
      </>
    ),
  },
  {
    icon: '📤',
    title: 'Gruppen übertragen',
    body: (
      <>
        <p>Du kannst eine Gruppe komplett an einen anderen Spieler übertragen. Er muss die Übertragung erst annehmen und entscheidet dabei, ob er bestehende Rechte und vertraute Spieler übernehmen möchte.</p>
      </>
    ),
  },
  {
    icon: '📦',
    title: 'Shulkerkisten',
    body: (
      <>
        <p>Platzierst du eine Shulkerkiste, wird sie automatisch dir zugeordnet — nur du und vertraute Spieler können sie öffnen.</p>
        <p>Auf der Website stellst du getrennt ein, wer eine Kiste <strong>öffnen</strong> und wer sie <strong>abbauen</strong> darf, und kannst sogar ihren Inhalt einsehen.</p>
      </>
    ),
  },
  {
    icon: '🎉',
    title: 'Bereit zum Claimen!',
    body: (
      <>
        <p>Das war's mit den Grundlagen! Du findest diese Erklärung jederzeit über den Hilfe-Button auf der Claims-Seite wieder.</p>
      </>
    ),
  },
]

export default function ClaimsTutorial({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0)
  const isLast = step === SLIDES.length - 1
  const slide = SLIDES[step]

  const finish = async () => {
    await fetch('/api/smp/claims/tutorial-status', { method: 'POST' })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="rounded-2xl p-6 max-w-md w-full" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-1">
            {SLIDES.map((_, i) => (
              <div key={i} className="h-1.5 rounded-full transition-all"
                style={{ width: i === step ? 20 : 8, background: i <= step ? '#16A34A' : 'var(--muted-bg)' }} />
            ))}
          </div>
          <button onClick={finish} className="text-xs hover:opacity-70" style={{ color: 'var(--muted)' }}>
            Überspringen
          </button>
        </div>

        <div className="text-center mb-2">
          <span className="text-4xl">{slide.icon}</span>
        </div>
        <h2 className="font-bold text-lg text-center mb-3" style={{ color: 'var(--foreground)' }}>
          {slide.title}
        </h2>
        <div className="text-sm space-y-2 mb-6" style={{ color: 'var(--muted)' }}>
          {slide.body}
        </div>

        <div className="flex gap-2">
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)} className="flex-1 text-sm py-2 rounded-lg"
              style={{ background: 'var(--muted-bg)', color: 'var(--foreground)' }}>
              ← Zurück
            </button>
          )}
          {isLast ? (
            <button onClick={finish} className="flex-1 text-sm font-medium py-2 rounded-lg" style={{ background: '#16A34A', color: 'white' }}>
              Verstanden!
            </button>
          ) : (
            <button onClick={() => setStep(s => s + 1)} className="flex-1 text-sm font-medium py-2 rounded-lg" style={{ background: '#16A34A', color: 'white' }}>
              Weiter →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}