import { NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

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
  const MIN_INTERVAL_MS = 60 * 1000 // 1 Minute

  const markerResult = await pool.query(
    `SELECT last_run_at FROM cron_state WHERE job_name = 'check-new-trusts'`
  )
  const marker = markerResult.rows[0]

  const since = marker?.last_run_at || new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const now = new Date().toISOString()

  if (Date.now() - new Date(since).getTime() < MIN_INTERVAL_MS) {
    return NextResponse.json({ success: true, created: 0, skipped: true })
  }

  const [claimTrustsRes, shulkerTrustsRes] = await Promise.all([
    pool.query('SELECT * FROM claim_trusts WHERE created_at > $1', [since]),
    pool.query('SELECT * FROM shulker_trusts WHERE created_at > $1', [since]),
  ])

  const claimTrusts = claimTrustsRes.rows || []
  const shulkerTrusts = shulkerTrustsRes.rows || []

  let created = 0

  for (const t of claimTrusts) {
    const trustedUserResult = await pool.query(
      'SELECT id FROM users WHERE minecraft_uuid = $1',
      [t.trusted_uuid]
    )
    const trustedUser = trustedUserResult.rows[0]
    if (!trustedUser) continue

    const scopeLabel = t.scope === 'global' ? 'für alle seine Claims' : 'für einen Claim'
    await pool.query(
      `INSERT INTO notifications (user_id, category, title, body, link) VALUES ($1, $2, $3, $4, $5)`,
      [trustedUser.id, 'system', `${t.owner_name} hat dich vertraut`, `Du wurdest ${scopeLabel} freigeschaltet.`, '/smp/claims/trusted']
    )
    created++
  }

  for (const t of shulkerTrusts) {
    const trustedUserResult = await pool.query(
      'SELECT id FROM users WHERE minecraft_uuid = $1',
      [t.trusted_uuid]
    )
    const trustedUser = trustedUserResult.rows[0]
    if (!trustedUser) continue

    const permLabel = t.permission === 'BREAK' ? 'abbauen' : 'öffnen'
    const scopeLabel = t.scope === 'all' ? 'alle seine Shulkerkisten' : 'eine Shulkerkiste'
    await pool.query(
      `INSERT INTO notifications (user_id, category, title, body, link) VALUES ($1, $2, $3, $4, $5)`,
      [trustedUser.id, 'system', `Du darfst nun ${scopeLabel} ${permLabel}`, null, '/smp/shulkers']
    )
    created++
  }

  await pool.query(
    `INSERT INTO cron_state (job_name, last_run_at) VALUES ('check-new-trusts', $1)
     ON CONFLICT (job_name) DO UPDATE SET last_run_at = EXCLUDED.last_run_at`,
    [now]
  )

  return NextResponse.json({ success: true, created })
}