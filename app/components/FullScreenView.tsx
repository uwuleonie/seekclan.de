'use client'

// Ersetzt das bisherige Popup/Modal-System (kleines Dialogfenster / Portal-Overlay,
// das auch die Navbar verdeckt hat) durch eine echte In-Page-Ansicht: füllt den
// kompletten Inhaltsbereich UNTER der Navbar (die Navbar bleibt immer sichtbar),
// kein Portal, kein document.body-Overlay mehr. Genutzt von: NewConversationModal,
// GroupManagementPanel, ChatLogMenu, EditHistoryModal — alle rendern jetzt direkt
// im normalen Seitenfluss von /chat statt als schwebendes Fenster.

type Props = {
  onClose: () => void
  title: string
  children: React.ReactNode
  maxWidth?: string
}

export default function FullScreenView({ onClose, title, children, maxWidth = '720px' }: Props) {
  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--background)' }}>
      <div className="flex items-center gap-3 px-8 py-5 flex-shrink-0" style={{ borderBottom: '1px solid var(--card-border)' }}>
        <button onClick={onClose}
          className="text-sm flex items-center gap-1 hover:opacity-70 transition-all"
          style={{ color: 'var(--muted)' }}>
          ← Zurück
        </button>
        <span className="w-px h-5" style={{ background: 'var(--card-border)' }} />
        <h1 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>{title}</h1>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-full mx-auto px-8 py-8" style={{ maxWidth }}>
          {children}
        </div>
      </div>
    </div>
  )
}