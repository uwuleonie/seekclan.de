import { supabaseAdmin } from './supabase'

// Prüft, ob für eine Gruppe aktuell eine offene Übertragungsanfrage existiert.
// Solange das der Fall ist, darf der aktuelle Owner nichts an der Gruppe ändern.
export async function isGroupLockedByTransfer(groupId: string | number): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('claim_transfers')
    .select('id, expires_at')
    .eq('group_id', groupId)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .limit(1)
  return !!(data && data.length > 0)
}