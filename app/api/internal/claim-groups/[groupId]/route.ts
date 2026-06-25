import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { verifyPluginKey } from '@/app/lib/plugin-auth'

// Löscht eine (jetzt leere) automatische Gruppe. Ersetzt den alten
// SupabaseClient.delete("claim_groups", "id=eq." + fromGroupId) Aufruf aus
// ClaimGroupingService.mergeGroups im Plugin.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ groupId: string }> }) {
  if (!await verifyPluginKey(req)) {
    return NextResponse.json({ error: 'Ungültiger API Key' }, { status: 401 })
  }

  const { groupId } = await params

  try {
    await pool.query('DELETE FROM claim_groups WHERE id = $1', [groupId])
  } catch (err: any) {
    return NextResponse.json({ error: `Gruppe konnte nicht gelöscht werden: ${err.message}` }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}