import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

// Wird NICHT mehr per Vercel Cron aufgerufen (das geht auf dem kostenlosen Hobby-Plan
// nur 1x täglich), sondern direkt von der Website angestoßen: NotificationBell.tsx ruft
// diese Route kurz auf, bevor sie die Benachrichtigungen lädt. So wird trotzdem
// regelmäßig geprüft, ohne dass ein Hintergrund-Cron nötig ist.
// Sucht alle Trust-Einträge (Claim, Gruppe/global über claim_trusts, sowie Shulker über
// shulker_trusts), die seit dem letzten Lauf neu erstellt wurden, und benachrichtigt
// den jeweils vertrauten Spieler. Untrust (Entzug) wird absichtlich NICHT erfasst, da es
// technisch keinen zuverlässigen Zeitstempel für Löschungen gibt, ohne das Plugin zu ändern.
//
// Mehrfachaufrufe sind unproblematisch: Es werden nur Trusts NACH dem letzten Lauf-
// Zeitpunkt verarbeitet, der Marker wird danach sofort weitergesetzt.
export async function GET() {
  // Mindestabstand zwischen zwei tatsächlichen Durchläufen, damit nicht bei jedem
  // einzelnen Seitenaufruf unnötig die Datenbank abgefragt wird.
  const MIN_INTERVAL_MS = 60 * 1000 // 1 Minute

  const { data: marker } = await supabaseAdmin
    .from('cron_state')
    .select('last_run_at')
    .eq('job_name', 'check-new-trusts')
    .single()

  const since = marker?.last_run_at || new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const now = new Date().toISOString()

  // Wurde erst vor Kurzem geprüft? Dann nichts tun (spart unnötige DB-Last bei vielen
  // gleichzeitigen Besuchern), aber als Erfolg zurückmelden.
  if (Date.now() - new Date(since).getTime() < MIN_INTERVAL_MS) {
    return NextResponse.json({ success: true, created: 0, skipped: true })
  }

  const [claimTrustsRes, shulkerTrustsRes] = await Promise.all([
    supabaseAdmin.from('claim_trusts').select('*').gt('created_at', since),
    supabaseAdmin.from('shulker_trusts').select('*').gt('created_at', since),
  ])

  const claimTrusts = claimTrustsRes.data || []
  const shulkerTrusts = shulkerTrustsRes.data || []

  let created = 0

  for (const t of claimTrusts) {
    const { data: trustedUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('minecraft_uuid', t.trusted_uuid)
      .single()
    if (!trustedUser) continue

    const scopeLabel = t.scope === 'global' ? 'für alle seine Claims' : 'für einen Claim'
    await supabaseAdmin.from('notifications').insert({
      user_id: trustedUser.id,
      category: 'system',
      title: `${t.owner_name} hat dich vertraut`,
      body: `Du wurdest ${scopeLabel} freigeschaltet.`,
      link: '/smp/claims/trusted',
    })
    created++
  }

  for (const t of shulkerTrusts) {
    const { data: trustedUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('minecraft_uuid', t.trusted_uuid)
      .single()
    if (!trustedUser) continue

    const permLabel = t.permission === 'BREAK' ? 'abbauen' : 'öffnen'
    const scopeLabel = t.scope === 'all' ? 'alle seine Shulkerkisten' : 'eine Shulkerkiste'
    await supabaseAdmin.from('notifications').insert({
      user_id: trustedUser.id,
      category: 'system',
      title: `Du darfst nun ${scopeLabel} ${permLabel}`,
      body: null,
      link: '/smp/shulkers',
    })
    created++
  }

  await supabaseAdmin
    .from('cron_state')
    .upsert({ job_name: 'check-new-trusts', last_run_at: now }, { onConflict: 'job_name' })

  return NextResponse.json({ success: true, created })
}