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

  const { buffer } = await getPlayerHead(username, parsedSize)

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      // Browser-seitig 1h cachen — der Server-Cache (24h) ist die eigentliche Quelle
      // der Wahrheit, das hier verhindert nur unnötig häufige Requests im Browser.
      'Cache-Control': 'public, max-age=3600',
    },
  })
}