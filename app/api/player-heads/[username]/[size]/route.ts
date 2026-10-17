import { NextRequest, NextResponse } from 'next/server'
import { getPlayerHead } from '@/app/lib/player-heads'

// Eigener, selbst gehosteter Ersatz für externe Spielerkopf-Dienste (mc-heads.net,
// CreeperNation, ...). URL-Schema entspricht bewusst dem alten mc-heads-Format
// (/USERNAME/GRÖSSE als Pfad-Segmente), damit die Umstellung im restlichen Code nur ein
// einfacher Domain-Austausch ist, ohne Query-Parameter-Umbau.
//
// Beispiel: /api/player-heads/uwuleonie/48

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string; size: string }> }
) {
  const { username, size } = await params
  const parsedSize = parseInt(size, 10) || 48

  const { buffer, isFallback } = await getPlayerHead(username, parsedSize)

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      // Echter Kopf: im Browser 1h cachen — der Server-Cache (24h) ist die eigentliche Quelle der Wahrheit.
      // Steve-Platzhalter (Mojang gerade nicht erreichbar oder zu viele Anfragen): nicht speichern,
      // damit beim nächsten Laden der echte Kopf kommt.
      'Cache-Control': isFallback ? 'no-store' : 'public, max-age=3600',
    },
  })
}