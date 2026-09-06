export default function MikeyPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #ffd6ec 0%, #ffb3d9 35%, #ff8cc8 65%, #ffaad4 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.38)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        border: '1px solid rgba(255,255,255,0.65)',
        borderRadius: '24px',
        padding: '40px 52px',
        textAlign: 'center',
        boxShadow: '0 8px 40px rgba(255,80,160,0.12), inset 0 1px 0 rgba(255,255,255,0.85)',
      }}>
        <p style={{
          fontFamily: '"Playfair Display", Georgia, serif',
          fontStyle: 'italic',
          fontSize: '28px',
          color: 'rgba(150,40,100,0.85)',
        }}>
          hey mikey ✦
        </p>
      </div>
    </div>
  )
}