import { ImageResponse } from 'next/og'
import { pool } from '@/app/lib/db'

// Vorschaubild für geteilte Ergebnisse (wird z.B. im Chat, bei WhatsApp oder Discord angezeigt)

export const alt = 'Geo-Quiz-Ergebnis auf seekclan.de'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let d: { title: string; accuracy: number; right: number; wrong: number; seconds: number; variant: string; username: string | null } | null = null
  try {
    if (/^[A-Za-z0-9_-]{6,16}$/.test(id)) {
      const r = await pool.query('SELECT s.data, u.username FROM geo_shares s LEFT JOIN users u ON u.id = s.user_id WHERE s.id = $1', [id])
      if (r.rows[0]) d = { ...r.rows[0].data, username: r.rows[0].username }
    }
  } catch { /* Platzhalter */ }

  const big = d ? (d.variant === 'sprint' ? `${d.right}` : `${d.accuracy} %`) : '?'
  const answered = d ? d.right + d.wrong : 0
  const pct = answered ? Math.round((d!.right / answered) * 100) : 0
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 64, background: 'linear-gradient(135deg, #121d28 0%, #17405a 100%)', color: '#f4efe6', fontFamily: 'Georgia, serif' }}>
        <div style={{ display: 'flex', fontSize: 30, color: '#e9b35f', letterSpacing: 4 }}>SEEKCLAN · ATLAS{d?.username ? ` · ${d.username.toUpperCase()}` : ''}</div>
        <div style={{ display: 'flex', fontSize: 64, fontStyle: 'italic', fontWeight: 700, lineHeight: 1.1, maxWidth: 1050 }}>{d?.title ?? 'Geo-Quiz'}</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 48 }}>
          <div style={{ display: 'flex', fontSize: 150, fontWeight: 700, color: '#e9b35f', lineHeight: 1 }}>{big}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 34, paddingBottom: 14 }}>
            <div style={{ display: 'flex' }}>{d ? `${d.right} richtig · ${d.wrong} Fehler` : ''}</div>
            <div style={{ display: 'flex', color: 'rgba(244,239,230,0.7)' }}>{d ? `${fmtTime(d.seconds)} Min.` : ''}</div>
          </div>
        </div>
        <div style={{ display: 'flex', width: '100%', height: 22, borderRadius: 11, overflow: 'hidden', background: 'rgba(240,122,122,0.85)' }}>
          <div style={{ display: 'flex', width: `${pct}%`, height: '100%', background: '#6fcf97' }} />
        </div>
      </div>
    ),
    size,
  )
}