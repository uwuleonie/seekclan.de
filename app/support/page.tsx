export default function SupportPage() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
      <div className="text-center max-w-md px-8">
        <p className="text-6xl mb-6">🔧</p>
        <h1 className="text-3xl font-bold mb-3" style={{ color: 'var(--foreground)' }}>Kommt bald</h1>
        <p style={{ color: 'var(--muted)' }}>Das Support-System ist gerade in Wartung und erscheint bald. Melde dich in der Zwischenzeit direkt bei uns auf Discord.</p>
      </div>
    </div>
  )
}