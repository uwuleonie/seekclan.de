import Link from 'next/link'

const TILES = [
  {
    href: '/private/geoguessr/japan',
    emoji: '🗾',
    title: 'Japan',
    sub: 'Regionen & Präfekturen',
    active: true,
  },
]

export default function GeoGuessrPage() {
  return (
    <div>
      <div style={{ marginBottom: '36px' }}>
        <p style={{
          fontFamily: '"Playfair Display", Georgia, serif',
          fontStyle: 'italic',
          fontSize: '28px',
          color: 'rgba(150,40,100,0.85)',
          marginBottom: '6px',
        }}>
          GeoGuessr Lernen
        </p>
        <p style={{
          fontFamily: 'sans-serif',
          fontSize: '11px',
          letterSpacing: '0.1em',
          color: 'rgba(180,60,120,0.4)',
          textTransform: 'uppercase',
        }}>
          Wähle eine Kategorie
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
        {TILES.map(tile => (
          <Link
            key={tile.href}
            href={tile.href}
            style={{
              textDecoration: 'none',
              display: 'block',
              background: 'rgba(255,255,255,0.38)',
              backdropFilter: 'blur(28px)',
              WebkitBackdropFilter: 'blur(28px)',
              border: '1px solid rgba(255,255,255,0.65)',
              borderRadius: '20px',
              padding: '28px 24px',
              boxShadow: '0 8px 40px rgba(255,80,160,0.1), inset 0 1px 0 rgba(255,255,255,0.85)',
              transition: 'all 0.2s',
              cursor: 'pointer',
            }}
          >
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>{tile.emoji}</div>
            <p style={{
              fontFamily: '"Playfair Display", Georgia, serif',
              fontStyle: 'italic',
              fontSize: '20px',
              color: 'rgba(150,40,100,0.85)',
              marginBottom: '4px',
            }}>
              {tile.title}
            </p>
            <p style={{
              fontFamily: 'sans-serif',
              fontSize: '11px',
              letterSpacing: '0.06em',
              color: 'rgba(180,60,120,0.4)',
            }}>
              {tile.sub}
            </p>
          </Link>
        ))}

        {/* Placeholder Kacheln */}
        {['Europa', 'USA', 'Südamerika'].map(name => (
          <div
            key={name}
            style={{
              background: 'rgba(255,255,255,0.15)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '20px',
              padding: '28px 24px',
              opacity: 0.5,
            }}
          >
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>🌍</div>
            <p style={{
              fontFamily: '"Playfair Display", Georgia, serif',
              fontStyle: 'italic',
              fontSize: '20px',
              color: 'rgba(150,40,100,0.6)',
              marginBottom: '4px',
            }}>
              {name}
            </p>
            <p style={{
              fontFamily: 'sans-serif',
              fontSize: '11px',
              letterSpacing: '0.06em',
              color: 'rgba(180,60,120,0.3)',
            }}>
              bald
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}