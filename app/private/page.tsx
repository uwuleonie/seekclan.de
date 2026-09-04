export default function PrivatePage() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.38)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        border: '1px solid rgba(255,255,255,0.65)',
        borderRadius: '24px',
        padding: '40px 48px',
        boxShadow: '0 8px 40px rgba(255,80,160,0.12), inset 0 1px 0 rgba(255,255,255,0.85)',
      }}>
        <p style={{
          fontFamily: '"Playfair Display", Georgia, serif',
          fontStyle: 'italic',
          fontSize: '28px',
          color: 'rgba(150,40,100,0.85)',
          marginBottom: '8px',
        }}>
          Willkommen ✦
        </p>
        <p style={{
          fontFamily: 'sans-serif',
          fontSize: '12px',
          letterSpacing: '0.08em',
          color: 'rgba(180,60,120,0.4)',
        }}>
          Wähle links einen Bereich aus.
        </p>
      </div>
    </div>
  )
}