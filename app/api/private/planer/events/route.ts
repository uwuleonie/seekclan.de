import { resource } from '@/app/lib/private-crud'
import { eventsDef } from '@/app/lib/planner-defs'

// GET  /api/private/planer/events — alle Einträge des eingeloggten Accounts
// POST /api/private/planer/events — neuen Eintrag anlegen
const r = resource(eventsDef)
export const GET = r.list
export const POST = r.create