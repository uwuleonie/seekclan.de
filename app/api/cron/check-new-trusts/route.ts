import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

// Wird per Vercel Cron periodisch aufgerufen. Sucht alle Trust-Einträge (Claim,
// Gruppe/global über claim_trusts, sowie Shulker über shulker_trusts), die seit
// dem letzten Lauf neu erstellt wurden, und benachrichtigt den jeweils vertrauten
// Spieler. Untrust (Entzug) wird absichtlich NICHT erfasst, da es technisch keinen
// zuverlässigen Zeitstempel für Löschungen gibt, ohne das Plugin zu ändern.
export async function GET(req: NextRequest) {
  // Schutz: nur Vercel Cron selbst (oder mit korrektem Secret) darf das aufrufen
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Letzten Lauf-Zeitpunkt aus einer einfachen Marker-Zeile lesen (oder Default: vor 10 Minuten)
  const { data: marker } = await supabaseAdmin
    .from('cron_state')
    .select('last_run_at')
    .eq('job_name', 'check-new-trusts')
    .single()

  const since = marker?.last_run_at || new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const now = new Date().toISOString()

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