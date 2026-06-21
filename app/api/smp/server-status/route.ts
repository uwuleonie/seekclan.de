import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

// Wird vom SeekInventory-Plugin alle ~30 Sekunden direkt aktualisiert (siehe
// ServerStatusReporter.java). Ersetzt den vorherigen externen Server-List-Ping, der bei
// diesem Server-Setup zuverlässig 0 Spieler zurückgab (vermutlich, weil unter der
// konfigurierten IP/Port-Kombination ein anderes Netzwerk antwortet als der eigentliche
// SMP-Server).
//
// Gilt als "stale" (Server wahrscheinlich abgestürzt, kein ordentlicher Shutdown mit
// Offline-Meldung), wenn der letzte Report länger als dieses Intervall zurückliegt.
const STALE_AFTER_MS = 2 * 60 * 1000 // 2 Minuten

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('smp_server_status')
    .select('online_count, max_players, updated_at')
    .eq('id', 1)
    .single()

  if (error || !data) {
    return NextResponse.json({ online: false, players: 0, maxPlayers: 0 })
  }

  const isStale = Date.now() - new Date(data.updated_at).getTime() > STALE_AFTER_MS

  if (isStale) {
    return NextResponse.json({ online: false, players: 0, maxPlayers: data.max_players })
  }

  return NextResponse.json({ online: true, players: data.online_count, maxPlayers: data.max_players })
}