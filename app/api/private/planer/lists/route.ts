import { resource } from '@/app/lib/private-crud'
import { listsDef } from '@/app/lib/planner-defs'

// GET  /api/private/planer/lists — alle Einträge des eingeloggten Accounts
// POST /api/private/planer/lists — neuen Eintrag anlegen
const r = resource(listsDef)
export const GET = r.list
export const POST = r.create