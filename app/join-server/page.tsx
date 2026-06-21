import Link from 'next/link'

export default function JoinServerPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12" style={{ color: 'var(--foreground)' }}>
      <p className="text-sm font-semibold mb-2" style={{
        background: 'linear-gradient(135deg, #4F46E5, #7C3AED, #C026D3)',
        WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
        letterSpacing: '0.05em',
      }}>
        SO GEHT'S LOS
      </p>
      <h1 className="text-3xl font-bold mb-3">Dem Server beitreten</h1>
      <p className="mb-10" style={{ color: 'var(--muted)' }}>
        Keine Whitelist, kein Bewerbungsprozess — du kannst direkt los. So bist du in wenigen Minuten dabei.
      </p>

      <div className="space-y-4 mb-10">
        <div className="card rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED, #C026D3)', color: 'white' }}>1</span>
            <h2 className="font-bold">Minecraft Java Edition öffnen</h2>
          </div>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Unser Server läuft auf der Java Edition (Bedrock wird aktuell nicht unterstützt). Du brauchst eine reguläre Java-Lizenz.
          </p>
        </div>

        <div className="card rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED, #C026D3)', color: 'white' }}>2</span>
            <h2 className="font-bold">Server hinzufügen</h2>
          </div>
          <p className="text-sm mb-3" style={{ color: 'var(--muted)' }}>
            Unter "Mehrspieler" → "Server hinzufügen" gibst du folgende Adresse ein:
          </p>
          <div className="flex items-center justify-between px-4 py-2.5 rounded-lg" style={{ background: 'var(--muted-bg)' }}>
            <code className="font-bold" style={{ color: 'var(--foreground)' }}>seekclan.de</code>
            <span className="text-xs" style={{ color: 'var(--muted)' }}>Version 1.21.11</span>
          </div>
        </div>

        <div className="card rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED, #C026D3)', color: 'white' }}>3</span>
            <h2 className="font-bold">Verbinden und losspielen</h2>
          </div>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Server doppelklicken, fertig. Es gibt keine Whitelist — du landest direkt in der Welt.
          </p>
        </div>

        <div className="card rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED, #C026D3)', color: 'white' }}>4</span>
            <h2 className="font-bold">Minecraft-Account auf der Website verknüpfen</h2>
          </div>
          <p className="text-sm mb-3" style={{ color: 'var(--muted)' }}>
            Damit du Grundstücke claimen, Berechtigungen verwalten und dein Inventar einsehen kannst, verknüpfe deinen Minecraft-Account mit deinem Website-Konto.
          </p>
          <Link href="/einstellungen" className="text-sm font-medium" style={{
            background: 'linear-gradient(135deg, #4F46E5, #7C3AED, #C026D3)',
            WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
          }}>
            Zu den Einstellungen →
          </Link>
        </div>
      </div>

      <div className="rounded-2xl p-8 text-center" style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED, #C026D3)' }}>
        <p className="text-white font-bold mb-1">Noch Fragen?</p>
        <p className="text-white/80 text-sm mb-4">Auf unserem Discord hilft dir die Community gerne weiter. Ansonsten kannst du dich auch direkt an die Administraton wenden.</p>
        <a href="/discord" target="_blank" rel="noopener noreferrer" className="inline-block bg-white px-6 py-2.5 rounded-full font-medium text-sm" style={{ color: '#4F46E5' }}>
          Discord beitreten
        </a>
      </div>
    </div>
  )
}