import { resource } from '@/app/lib/private-crud'
import { alarmsDef } from '@/app/lib/planner-defs'

// GET  /api/private/planer/alarms — alle Einträge des eingeloggten Accounts
// POST /api/private/planer/alarms — neuen Eintrag anlegen
const r = resource(alarmsDef)
export const GET = r.list
export const POST = r.create